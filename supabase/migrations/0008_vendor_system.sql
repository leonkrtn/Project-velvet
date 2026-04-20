-- ============================================================
-- Velvet Migration 0008 — Vendor Permission System
-- Adds event_invitations, permissions, module-content tables,
-- join_event_by_code RPC, and vendor-aware RLS policies.
-- Idempotent — safe to re-run.
-- ============================================================


-- ════════════════════════════════════════════════════════════════════════════
-- EVENT_MEMBERS: add joined_at
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE event_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();


-- ════════════════════════════════════════════════════════════════════════════
-- EVENT_INVITATIONS: vendor invitation codes with granular permissions
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS event_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code        TEXT        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  role        user_role   NOT NULL DEFAULT 'dienstleister',
  permissions TEXT[]      NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_by  UUID        NOT NULL REFERENCES profiles(id),
  accepted_by UUID        REFERENCES profiles(id),
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_event_invitations_code     ON event_invitations(code);
CREATE INDEX IF NOT EXISTS idx_event_invitations_event_id ON event_invitations(event_id);

ALTER TABLE event_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "einv_select"        ON event_invitations;
DROP POLICY IF EXISTS "einv_insert"        ON event_invitations;
DROP POLICY IF EXISTS "einv_update"        ON event_invitations;

-- Ersteller und Veranstalter können lesen; angemeldete User dürfen Code nachschlagen
CREATE POLICY "einv_select" ON event_invitations
  FOR SELECT USING (
    created_by = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "einv_insert" ON event_invitations
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    AND created_by = auth.uid()
  );

CREATE POLICY "einv_update" ON event_invitations
  FOR UPDATE USING (auth.uid() IS NOT NULL);


-- ════════════════════════════════════════════════════════════════════════════
-- PERMISSIONS: granulare User × Event × Modul-Berechtigungen
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS permissions (
  user_id    UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id, permission)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user_event ON permissions(user_id, event_id);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perm_own_select"         ON permissions;
DROP POLICY IF EXISTS "perm_veranstalter_manage" ON permissions;

CREATE POLICY "perm_own_select" ON permissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "perm_veranstalter_manage" ON permissions
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));


-- ════════════════════════════════════════════════════════════════════════════
-- HELPER: has_permission — prüft ob aktueller User das Modul freigeschaltet hat
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION has_permission(eid UUID, perm TEXT)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM permissions
    WHERE user_id  = auth.uid()
      AND event_id = eid
      AND permission = perm
  );
$$ LANGUAGE sql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════════════════
-- RPC: preview_invitation_code — Event-Vorschau ohne Beitritt
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION preview_invitation_code(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_inv   event_invitations%ROWTYPE;
  v_event events%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM event_invitations WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ungültiger Code');
  END IF;
  IF v_inv.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Einladung bereits eingelöst');
  END IF;
  IF v_inv.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Einladung abgelaufen');
  END IF;

  SELECT * INTO v_event FROM events WHERE id = v_inv.event_id;

  RETURN jsonb_build_object(
    'event_id',    v_inv.event_id,
    'event_title', v_event.title,
    'event_date',  v_event.date,
    'role',        v_inv.role,
    'permissions', v_inv.permissions,
    'expires_at',  v_inv.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════════════════
-- RPC: join_event_by_code — atomarer Beitritt mit Lock gegen Race Conditions
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION join_event_by_code(p_code TEXT)
RETURNS JSONB AS $$
DECLARE
  v_inv   event_invitations%ROWTYPE;
  v_event events%ROWTYPE;
  v_uid   UUID := auth.uid();
  v_perm  TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Nicht angemeldet');
  END IF;

  -- Zeile sperren um simultane Einlösungen zu verhindern
  SELECT * INTO v_inv
  FROM event_invitations
  WHERE code = p_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Ungültiger Code');
  END IF;
  IF v_inv.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'Einladung bereits eingelöst');
  END IF;
  IF v_inv.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'Einladung abgelaufen');
  END IF;

  -- Bereits Mitglied?
  IF EXISTS (
    SELECT 1 FROM event_members
    WHERE event_id = v_inv.event_id AND user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('error', 'Du bist bereits Mitglied dieses Events');
  END IF;

  -- Mitgliedschaft anlegen
  INSERT INTO event_members (event_id, user_id, role, invite_status, joined_at)
  VALUES (v_inv.event_id, v_uid, v_inv.role, 'confirmed', NOW())
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- Alle Berechtigungen einzeln schreiben
  FOREACH v_perm IN ARRAY v_inv.permissions LOOP
    INSERT INTO permissions (user_id, event_id, permission)
    VALUES (v_uid, v_inv.event_id, v_perm)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Einladung als eingelöst markieren
  UPDATE event_invitations
  SET status      = 'accepted',
      accepted_by = v_uid,
      accepted_at = NOW()
  WHERE id = v_inv.id;

  SELECT * INTO v_event FROM events WHERE id = v_inv.event_id;

  RETURN jsonb_build_object(
    'success',     true,
    'event_id',    v_inv.event_id,
    'event_title', v_event.title,
    'role',        v_inv.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ════════════════════════════════════════════════════════════════════════════
-- MOD_LOCATION: Detaillierte Veranstaltungsort-Informationen
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS location_details (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  parking_info      TEXT        DEFAULT '',
  contact_name      TEXT        DEFAULT '',
  contact_phone     TEXT        DEFAULT '',
  contact_email     TEXT        DEFAULT '',
  access_code       TEXT        DEFAULT '',
  power_connections TEXT        DEFAULT '',
  floor_plan_url    TEXT        DEFAULT '',
  load_in_time      TEXT        DEFAULT '',
  load_out_time     TEXT        DEFAULT '',
  notes             TEXT        DEFAULT '',
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE location_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locdet_veranstalter"   ON location_details;
DROP POLICY IF EXISTS "locdet_vendor_select"  ON location_details;

CREATE POLICY "locdet_veranstalter" ON location_details
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "locdet_vendor_select" ON location_details
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister','trauzeuge']::user_role[])
    AND has_permission(event_id, 'mod_location')
  );


-- ════════════════════════════════════════════════════════════════════════════
-- MOD_PATISSERIE: Hochzeitstorte und Dessert-Buffet
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS patisserie_config (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  cake_description    TEXT        DEFAULT '',
  layers              INT         DEFAULT 3,
  flavors             TEXT[]      DEFAULT '{}',
  dietary_notes       TEXT        DEFAULT '',
  delivery_date       TEXT        DEFAULT '',
  delivery_time       TEXT        DEFAULT '',
  cooling_required    BOOLEAN     DEFAULT false,
  cooling_notes       TEXT        DEFAULT '',
  setup_location      TEXT        DEFAULT '',
  cake_table_provided BOOLEAN     DEFAULT true,
  dessert_buffet      BOOLEAN     DEFAULT false,
  dessert_items       TEXT[]      DEFAULT '{}',
  price               NUMERIC     DEFAULT 0,
  vendor_notes        TEXT        DEFAULT '',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE patisserie_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patiss_veranstalter"  ON patisserie_config;
DROP POLICY IF EXISTS "patiss_vendor_select" ON patisserie_config;

CREATE POLICY "patiss_veranstalter" ON patisserie_config
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "patiss_vendor_select" ON patisserie_config
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_patisserie')
  );


-- ════════════════════════════════════════════════════════════════════════════
-- MOD_MEDIA: Briefing, Shot-Liste, Uploads
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS media_briefing (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID        UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  photo_briefing      TEXT        DEFAULT '',
  video_briefing      TEXT        DEFAULT '',
  photo_restrictions  TEXT        DEFAULT '',
  upload_instructions TEXT        DEFAULT '',
  delivery_deadline   TEXT        DEFAULT '',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media_briefing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mediabr_veranstalter"  ON media_briefing;
DROP POLICY IF EXISTS "mediabr_vendor_select" ON media_briefing;

CREATE POLICY "mediabr_veranstalter" ON media_briefing
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "mediabr_vendor_select" ON media_briefing
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_media')
  );


CREATE TABLE IF NOT EXISTS media_shot_items (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  description TEXT    DEFAULT '',
  type        TEXT    NOT NULL DEFAULT 'must_have' CHECK (type IN ('must_have','optional','forbidden')),
  category    TEXT    DEFAULT 'Allgemein',
  sort_order  INT     DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_media_shots_event ON media_shot_items(event_id);

ALTER TABLE media_shot_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mediash_veranstalter"  ON media_shot_items;
DROP POLICY IF EXISTS "mediash_vendor_select" ON media_shot_items;

CREATE POLICY "mediash_veranstalter" ON media_shot_items
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "mediash_vendor_select" ON media_shot_items
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_media')
  );


CREATE TABLE IF NOT EXISTS media_uploads (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  file_name   TEXT        NOT NULL,
  file_url    TEXT        NOT NULL,
  file_type   TEXT        DEFAULT 'image',
  uploaded_by UUID        REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_uploads_event ON media_uploads(event_id);

ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mediaup_select" ON media_uploads;
DROP POLICY IF EXISTS "mediaup_insert" ON media_uploads;
DROP POLICY IF EXISTS "mediaup_delete" ON media_uploads;

CREATE POLICY "mediaup_select" ON media_uploads
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_media'))
  );

CREATE POLICY "mediaup_insert" ON media_uploads
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_media'))
  );

CREATE POLICY "mediaup_delete" ON media_uploads
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR uploaded_by = auth.uid()
  );


-- ════════════════════════════════════════════════════════════════════════════
-- MOD_MUSIC: Songlisten und technische Anforderungen
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS music_songs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  artist     TEXT DEFAULT '',
  type       TEXT NOT NULL DEFAULT 'wish' CHECK (type IN ('wish','no_go','playlist')),
  moment     TEXT DEFAULT 'Allgemein',
  sort_order INT  DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_music_songs_event ON music_songs(event_id);

ALTER TABLE music_songs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "music_veranstalter"  ON music_songs;
DROP POLICY IF EXISTS "music_vendor_select" ON music_songs;

CREATE POLICY "music_veranstalter" ON music_songs
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "music_vendor_select" ON music_songs
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_music')
  );


CREATE TABLE IF NOT EXISTS music_requirements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  soundcheck_date  TEXT        DEFAULT '',
  soundcheck_time  TEXT        DEFAULT '',
  pa_notes         TEXT        DEFAULT '',
  stage_dimensions TEXT        DEFAULT '',
  microphone_count INT         DEFAULT 2,
  power_required   TEXT        DEFAULT '',
  streaming_needed BOOLEAN     DEFAULT false,
  streaming_notes  TEXT        DEFAULT '',
  notes            TEXT        DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE music_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "musicreq_veranstalter"  ON music_requirements;
DROP POLICY IF EXISTS "musicreq_vendor_select" ON music_requirements;

CREATE POLICY "musicreq_veranstalter" ON music_requirements
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "musicreq_vendor_select" ON music_requirements
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_music')
  );


-- ════════════════════════════════════════════════════════════════════════════
-- MOD_DECOR: Aufbau-Aufgabenliste
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS decor_setup_items (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT    NOT NULL,
  description       TEXT    DEFAULT '',
  location_in_venue TEXT    DEFAULT '',
  setup_by          TEXT    DEFAULT '',
  teardown_at       TEXT    DEFAULT '',
  sort_order        INT     DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_decor_setup_event ON decor_setup_items(event_id);

ALTER TABLE decor_setup_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "decorset_veranstalter"  ON decor_setup_items;
DROP POLICY IF EXISTS "decorset_vendor_select" ON decor_setup_items;

CREATE POLICY "decorset_veranstalter" ON decor_setup_items
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

CREATE POLICY "decorset_vendor_select" ON decor_setup_items
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_decor')
  );


-- ════════════════════════════════════════════════════════════════════════════
-- MOD_FILES: Verträge, Versicherungen, Genehmigungen
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS event_files (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  file_url    TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'sonstiges'
                          CHECK (category IN ('vertrag','versicherung','genehmigung','rider','sonstiges')),
  uploaded_by UUID        REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_files_event ON event_files(event_id);

ALTER TABLE event_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evtfiles_veranstalter"  ON event_files;
DROP POLICY IF EXISTS "evtfiles_vendor_select" ON event_files;

CREATE POLICY "evtfiles_veranstalter" ON event_files
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "evtfiles_vendor_select" ON event_files
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_files')
  );


-- ════════════════════════════════════════════════════════════════════════════
-- BESTEHENDE RLS-POLICIES AKTUALISIEREN
-- Dienstleister erhalten nur noch Zugriff wenn explizite Berechtigung vorhanden
-- ════════════════════════════════════════════════════════════════════════════

-- GUESTS: mod_guests erforderlich
DROP POLICY IF EXISTS "guests_select" ON guests;
CREATE POLICY "guests_select" ON guests
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_guests'))
  );

-- TIMELINE: mod_timeline erforderlich
DROP POLICY IF EXISTS "timeline_select" ON timeline_entries;
CREATE POLICY "timeline_select" ON timeline_entries
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_timeline'))
  );

-- SEATING: mod_seating erforderlich
DROP POLICY IF EXISTS "seating_select" ON seating_tables;
CREATE POLICY "seating_select" ON seating_tables
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_seating'))
  );

DROP POLICY IF EXISTS "seating_assign_all" ON seating_assignments;
CREATE POLICY "seating_assign_all" ON seating_assignments
  FOR ALL USING (
    table_id IN (
      SELECT id FROM seating_tables
      WHERE
        is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_seating'))
    )
  );

-- CATERING: mod_catering erforderlich
DROP POLICY IF EXISTS "catering_select" ON catering_plans;
CREATE POLICY "catering_select" ON catering_plans
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_catering'))
  );

-- CONVERSATIONS: mod_chat erforderlich für Dienstleister
DROP POLICY IF EXISTS "conv_select"           ON conversations;
DROP POLICY IF EXISTS "conversations_select"  ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR (is_event_member(event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(event_id, 'mod_chat'))
  );

DROP POLICY IF EXISTS "msg_select"      ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (
          is_event_member(c.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
          OR (is_event_member(c.event_id, ARRAY['dienstleister']::user_role[]) AND has_permission(c.event_id, 'mod_chat'))
        )
    )
  );

-- 003_new_features.sql
-- Neue Tabellen: Veranstalter-Bewerbung, Dienstleister-System, Trauzeuge-Permissions,
-- Audit-Log, Messaging, Änderungsfreigaben

-- ── Veranstalter-Bewerbungssystem ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizer_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  website      TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected'
  reviewed_by  UUID REFERENCES profiles(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE organizer_applications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "app_select" ON organizer_applications FOR SELECT USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "app_insert" ON organizer_applications FOR INSERT WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Approve/Reject läuft über service_role (Admin-API-Route)

-- ── Globale Dienstleister-Profile ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dienstleister_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  company_name TEXT,
  category     TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  website      TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dienstleister_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "dl_profile_select" ON dienstleister_profiles FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dl_profile_insert" ON dienstleister_profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── User ↔ Dienstleister-Zuordnung ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_dienstleister (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dienstleister_id UUID REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dienstleister_id)
);

ALTER TABLE user_dienstleister ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "ud_select" ON user_dienstleister FOR SELECT USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ud_insert" ON user_dienstleister FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Dienstleister ↔ Event-Verbindung (mit Kategorie + Scopes) ────────────────
CREATE TABLE IF NOT EXISTS event_dienstleister (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_id UUID REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id),
  category         TEXT NOT NULL,
  scopes           TEXT[] DEFAULT '{}',
  -- Scopes: 'catering'|'allergies'|'timeline'|'guests_readonly'|'budget_readonly'|'vendors'|'seating_readonly'
  status           TEXT DEFAULT 'eingeladen',
  -- 'eingeladen' | 'aktiv' | 'beendet'
  invited_by       UUID REFERENCES profiles(id),
  invited_at       TIMESTAMPTZ DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  UNIQUE(event_id, dienstleister_id)
);

ALTER TABLE event_dienstleister ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "ed_select" ON event_dienstleister FOR SELECT
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
      OR user_id = auth.uid()
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ed_insert" ON event_dienstleister FOR INSERT
    WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ed_update" ON event_dienstleister FOR UPDATE
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
      OR user_id = auth.uid()
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "ed_delete" ON event_dienstleister FOR DELETE
    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Trauzeuge-Permissions (dynamisch pro Trauzeuge pro Event) ─────────────────
CREATE TABLE IF NOT EXISTS trauzeuge_permissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  can_view_guests   BOOLEAN DEFAULT true,
  can_edit_guests   BOOLEAN DEFAULT false,
  can_view_seating  BOOLEAN DEFAULT true,
  can_edit_seating  BOOLEAN DEFAULT true,
  can_view_budget   BOOLEAN DEFAULT false,
  can_view_catering BOOLEAN DEFAULT false,
  can_view_timeline BOOLEAN DEFAULT true,
  can_edit_timeline BOOLEAN DEFAULT false,
  can_view_vendors  BOOLEAN DEFAULT false,
  can_manage_deko   BOOLEAN DEFAULT true,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE trauzeuge_permissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "tz_perm_select" ON trauzeuge_permissions FOR SELECT
    USING (
      is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
      OR user_id = auth.uid()
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "tz_perm_write" ON trauzeuge_permissions FOR ALL
    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Audit-Log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES profiles(id),
  actor_role user_role,
  action     TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id  UUID,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "audit_select" ON audit_log FOR SELECT
    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Kein direkter INSERT — nur via SECURITY DEFINER Funktion

CREATE OR REPLACE FUNCTION write_audit_log(
  p_event_id   UUID,
  p_actor_id   UUID,
  p_actor_role user_role,
  p_action     TEXT,
  p_table_name TEXT,
  p_record_id  UUID DEFAULT NULL,
  p_old_data   JSONB DEFAULT NULL,
  p_new_data   JSONB DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO audit_log (event_id, actor_id, actor_role, action, table_name, record_id, old_data, new_data)
  VALUES (p_event_id, p_actor_id, p_actor_role, p_action, p_table_name, p_record_id, p_old_data, p_new_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Messaging (event-scoped) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT,
  participant_roles user_role[] DEFAULT '{}',
  -- Leer = alle Rollen sehen diese Conversation
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "conv_select" ON conversations FOR SELECT
    USING (
      is_event_member(event_id)
      AND (
        array_length(participant_roles, 1) IS NULL
        OR get_event_role(event_id) = ANY(participant_roles)
      )
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "conv_insert" ON conversations FOR INSERT
    WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES profiles(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  edited_at       TIMESTAMPTZ
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "msg_select" ON messages FOR SELECT
    USING (
      conversation_id IN (
        SELECT id FROM conversations
        WHERE is_event_member(event_id)
          AND (
            array_length(participant_roles, 1) IS NULL
            OR get_event_role(event_id) = ANY(participant_roles)
          )
      )
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "msg_insert" ON messages FOR INSERT
    WITH CHECK (
      sender_id = auth.uid()
      AND conversation_id IN (
        SELECT id FROM conversations
        WHERE is_event_member(event_id)
          AND (
            array_length(participant_roles, 1) IS NULL
            OR get_event_role(event_id) = ANY(participant_roles)
          )
      )
    );
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "msg_update" ON messages FOR UPDATE
    USING (sender_id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Realtime für Messaging aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- ── Änderungs-Freigabesystem ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  area          TEXT NOT NULL,
  -- 'catering'|'budget'|'seating'|'dienstleister'|'guests'|'timeline'
  proposed_by   UUID REFERENCES profiles(id),
  proposer_role user_role,
  change_data   JSONB NOT NULL,
  -- { action, table, record_id, description, before: {}, after: {} }
  status        TEXT DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected'
  reviewed_by   UUID REFERENCES profiles(id),
  review_note   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

ALTER TABLE pending_changes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "pc_select" ON pending_changes FOR SELECT
    USING (is_event_member(event_id));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "pc_insert" ON pending_changes FOR INSERT
    WITH CHECK (is_event_member(event_id));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "pc_update" ON pending_changes FOR UPDATE
    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

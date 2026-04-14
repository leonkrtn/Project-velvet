-- ============================================================
-- Velvet Wedding Platform — Complete Database Setup
-- Für leere Datenbank (DROP SCHEMA public CASCADE wurde ausgeführt)
-- Führe diese Datei einmalig im Supabase SQL Editor aus.
-- ============================================================


-- ── Rollen ──────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('veranstalter', 'brautpaar', 'trauzeuge', 'dienstleister');


-- ── Profiles (erweitert auth.users) ─────────────────────────────────────────
CREATE TABLE profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT,
  email                 TEXT,
  is_approved_organizer BOOLEAN DEFAULT false,
  application_status    TEXT DEFAULT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup (keine Rolle mehr aus Metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, is_approved_organizer)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ── Events ───────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL DEFAULT 'Unsere Hochzeit',
  couple_name         TEXT,
  date                TEXT,
  venue               TEXT,
  venue_address       TEXT,
  dresscode           TEXT,
  ceremony_start      TEXT,
  ceremony_end        TEXT,
  reception_start     TEXT,
  reception_end       TEXT,
  children_allowed    BOOLEAN DEFAULT true,
  children_note       TEXT,
  meal_options        TEXT[] DEFAULT '{"fleisch","fisch","vegetarisch","vegan"}',
  max_begleitpersonen INT DEFAULT 2,
  room_length         NUMERIC DEFAULT 12,
  room_width          NUMERIC DEFAULT 8,
  onboarding_complete BOOLEAN DEFAULT false,
  data_freeze_at      TIMESTAMPTZ DEFAULT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ── Event-Mitglieder ─────────────────────────────────────────────────────────
CREATE TABLE event_members (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role     user_role NOT NULL,
  UNIQUE(event_id, user_id)
);


-- ── Invite-Codes ──────────────────────────────────────────────────────────────
CREATE TABLE invite_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  code       TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  role       user_role NOT NULL,
  used       BOOLEAN DEFAULT false,
  used_by    UUID REFERENCES profiles(id),
  metadata   JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);


-- ── Gäste ────────────────────────────────────────────────────────────────────
CREATE TABLE guests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,
  token           TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  status          TEXT DEFAULT 'angelegt',
  phone           TEXT,
  address         TEXT,
  trink_alkohol   BOOLEAN,
  meal_choice     TEXT,
  allergy_tags    TEXT[] DEFAULT '{}',
  allergy_custom  TEXT,
  side            TEXT,
  arrival_date    TEXT,
  arrival_time    TEXT,
  departure_date  TEXT,
  transport_mode  TEXT,
  hotel_room_id   UUID,
  message         TEXT,
  responded_at    TIMESTAMPTZ,
  notes           TEXT,
  sub_event_ids   TEXT[] DEFAULT '{}'
);


-- ── Begleitpersonen ──────────────────────────────────────────────────────────
CREATE TABLE begleitpersonen (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id       UUID REFERENCES guests(id) ON DELETE CASCADE,
  name           TEXT,
  age_category   TEXT,
  trink_alkohol  BOOLEAN,
  meal_choice    TEXT,
  allergy_tags   TEXT[] DEFAULT '{}',
  allergy_custom TEXT
);


-- ── Hotels ───────────────────────────────────────────────────────────────────
CREATE TABLE hotels (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  address  TEXT
);

CREATE TABLE hotel_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  room_type       TEXT NOT NULL,
  total_rooms     INT DEFAULT 0,
  booked_rooms    INT DEFAULT 0,
  price_per_night NUMERIC DEFAULT 0
);


-- ── Timeline ─────────────────────────────────────────────────────────────────
CREATE TABLE timeline_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  time       TEXT,
  title      TEXT,
  location   TEXT,
  sort_order INT DEFAULT 0
);


-- ── Budget ────────────────────────────────────────────────────────────────────
CREATE TABLE budget_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  category       TEXT,
  description    TEXT,
  planned        NUMERIC DEFAULT 0,
  actual         NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'offen',
  notes          TEXT
);


-- ── Dienstleister / Vendors ──────────────────────────────────────────────────
CREATE TABLE vendors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE,
  name         TEXT,
  category     TEXT,
  status       TEXT DEFAULT 'angefragt',
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  price        NUMERIC,
  notes        TEXT
);


-- ── Aufgaben ─────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title    TEXT,
  phase    TEXT,
  done     BOOLEAN DEFAULT false,
  notes    TEXT
);


-- ── Erinnerungen ─────────────────────────────────────────────────────────────
CREATE TABLE reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  type        TEXT,
  title       TEXT,
  target_date TEXT,
  sent        BOOLEAN DEFAULT false,
  notes       TEXT
);


-- ── Sub-Events ────────────────────────────────────────────────────────────────
CREATE TABLE sub_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT,
  date        TEXT,
  time        TEXT,
  venue       TEXT,
  description TEXT
);

CREATE TABLE sub_event_guests (
  sub_event_id UUID REFERENCES sub_events(id) ON DELETE CASCADE,
  guest_id     UUID REFERENCES guests(id) ON DELETE CASCADE,
  PRIMARY KEY (sub_event_id, guest_id)
);


-- ── Sitzplan ─────────────────────────────────────────────────────────────────
CREATE TABLE seating_tables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID REFERENCES events(id) ON DELETE CASCADE,
  name         TEXT,
  capacity     INT,
  shape        TEXT DEFAULT 'rectangular',
  pos_x        NUMERIC DEFAULT 0,
  pos_y        NUMERIC DEFAULT 0,
  rotation     NUMERIC DEFAULT 0,
  table_length NUMERIC DEFAULT 2.0,
  table_width  NUMERIC DEFAULT 0.8
);

CREATE TABLE seating_assignments (
  table_id UUID REFERENCES seating_tables(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  PRIMARY KEY (table_id, guest_id)
);


-- ── Catering-Plan ─────────────────────────────────────────────────────────────
CREATE TABLE catering_plans (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                   UUID UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  service_style              TEXT DEFAULT '',
  location_has_kitchen       BOOLEAN DEFAULT false,
  midnight_snack             BOOLEAN DEFAULT false,
  midnight_snack_note        TEXT DEFAULT '',
  drinks_billing             TEXT DEFAULT 'pauschale',
  drinks_selection           TEXT[] DEFAULT '{}',
  champagne_finger_food      BOOLEAN DEFAULT false,
  champagne_finger_food_note TEXT DEFAULT '',
  service_staff              BOOLEAN DEFAULT false,
  equipment_needed           TEXT[] DEFAULT '{}',
  budget_per_person          NUMERIC DEFAULT 0,
  budget_includes_drinks     BOOLEAN DEFAULT false,
  catering_notes             TEXT DEFAULT '',
  locked_fields              TEXT[] DEFAULT '{}'
);


-- ── Feature-Toggles ──────────────────────────────────────────────────────────
CREATE TABLE feature_toggles (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  enabled  BOOLEAN DEFAULT true,
  PRIMARY KEY (event_id, key)
);


-- ── Veranstalter-Vorschläge ──────────────────────────────────────────────────
CREATE TABLE organizer_vendor_suggestions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  name           TEXT,
  category       TEXT,
  description    TEXT,
  price_estimate NUMERIC DEFAULT 0,
  contact_email  TEXT,
  contact_phone  TEXT,
  status         TEXT DEFAULT 'vorschlag'
);

CREATE TABLE organizer_hotel_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT,
  address         TEXT,
  distance_km     NUMERIC DEFAULT 0,
  price_per_night NUMERIC DEFAULT 0,
  total_rooms     INT DEFAULT 0,
  description     TEXT,
  status          TEXT DEFAULT 'vorschlag'
);

CREATE TABLE organizer_catering_suggestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE,
  name             TEXT,
  style            TEXT,
  description      TEXT,
  price_per_person NUMERIC DEFAULT 0,
  contact_email    TEXT,
  status           TEXT DEFAULT 'vorschlag',
  locked_fields    TEXT[] DEFAULT '{}'
);


-- ── Deko ─────────────────────────────────────────────────────────────────────
CREATE TABLE deko_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  status      TEXT DEFAULT 'vorschlag'
);

CREATE TABLE deko_wishes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  title      TEXT,
  notes      TEXT,
  image_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── Location-Bilder ──────────────────────────────────────────────────────────
CREATE TABLE location_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ── Gäste-Fotos ──────────────────────────────────────────────────────────────
CREATE TABLE guest_photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  uploader_name     TEXT,
  uploader_guest_id UUID REFERENCES guests(id),
  storage_url       TEXT NOT NULL,
  sort_order        INT DEFAULT 0,
  uploaded_at       TIMESTAMPTZ DEFAULT NOW()
);


-- ── Veranstalter-Bewerbungen ─────────────────────────────────────────────────
CREATE TABLE organizer_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  website      TEXT,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  reviewed_by  UUID REFERENCES profiles(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ── Globale Dienstleister-Profile ────────────────────────────────────────────
CREATE TABLE dienstleister_profiles (
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


-- ── User ↔ Dienstleister-Zuordnung ──────────────────────────────────────────
CREATE TABLE user_dienstleister (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dienstleister_id UUID REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dienstleister_id)
);


-- ── Dienstleister ↔ Event ────────────────────────────────────────────────────
CREATE TABLE event_dienstleister (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_id UUID REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id),
  category         TEXT NOT NULL,
  scopes           TEXT[] DEFAULT '{}',
  status           TEXT DEFAULT 'eingeladen',
  invited_by       UUID REFERENCES profiles(id),
  invited_at       TIMESTAMPTZ DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  UNIQUE(event_id, dienstleister_id)
);


-- ── Trauzeuge-Permissions ─────────────────────────────────────────────────────
CREATE TABLE trauzeuge_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
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


-- ── Audit-Log ────────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
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


-- ── Messaging ────────────────────────────────────────────────────────────────
CREATE TABLE conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT,
  participant_roles user_role[] DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES profiles(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  edited_at       TIMESTAMPTZ
);


-- ── Änderungs-Freigaben ───────────────────────────────────────────────────────
CREATE TABLE pending_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  area          TEXT NOT NULL,
  proposed_by   UUID REFERENCES profiles(id),
  proposer_role user_role,
  change_data   JSONB NOT NULL,
  status        TEXT DEFAULT 'pending',
  reviewed_by   UUID REFERENCES profiles(id),
  review_note   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);


-- ════════════════════════════════════════════════════════════════════════════
-- HELPER-FUNKTIONEN
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_event_member(eid UUID, required_roles user_role[] DEFAULT NULL)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_members
    WHERE event_id = eid
      AND user_id = auth.uid()
      AND (required_roles IS NULL OR role = ANY(required_roles))
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_event_role(eid UUID)
RETURNS user_role AS $$
  SELECT role FROM event_members
  WHERE event_id = eid AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_event_frozen(eid UUID)
RETURNS boolean AS $$
  SELECT COALESCE(data_freeze_at IS NOT NULL AND data_freeze_at <= NOW(), false)
  FROM events WHERE id = eid;
$$ LANGUAGE sql SECURITY DEFINER;

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


-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE begleitpersonen                ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rooms                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_entries               ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_events                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_event_guests               ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_tables                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_assignments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_plans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_toggles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_vendor_suggestions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_hotel_suggestions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_catering_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_suggestions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_wishes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_images                ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_photos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dienstleister_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dienstleister             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dienstleister            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trauzeuge_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_changes                ENABLE ROW LEVEL SECURITY;


-- ── Profiles ─────────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- ── Events ────────────────────────────────────────────────────────────────────
CREATE POLICY "events_select" ON events FOR SELECT USING (is_event_member(id));

-- Nur approved Veranstalter darf Events erstellen
CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved_organizer = true)
  );

-- Veranstalter + Brautpaar updaten (nur wenn nicht eingefroren)
CREATE POLICY "events_update" ON events FOR UPDATE
  USING (
    is_event_member(id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(id)
  );

CREATE POLICY "events_delete" ON events FOR DELETE
  USING (is_event_member(id, ARRAY['veranstalter']::user_role[]));

-- ── Event Members ─────────────────────────────────────────────────────────────
CREATE POLICY "members_select" ON event_members FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "members_insert" ON event_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "members_delete" ON event_members FOR DELETE
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]) OR user_id = auth.uid());

-- ── Invite Codes ──────────────────────────────────────────────────────────────
CREATE POLICY "invite_select" ON invite_codes FOR SELECT  USING (is_event_member(event_id));
CREATE POLICY "invite_insert" ON invite_codes FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
CREATE POLICY "invite_update" ON invite_codes FOR UPDATE  USING (auth.uid() IS NOT NULL);

-- ── Guests ────────────────────────────────────────────────────────────────────
CREATE POLICY "guests_select" ON guests FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "guests_insert" ON guests FOR INSERT
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "guests_update" ON guests FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "guests_delete" ON guests FOR DELETE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Begleitpersonen ───────────────────────────────────────────────────────────
CREATE POLICY "begleit_all" ON begleitpersonen FOR ALL
  USING (guest_id IN (SELECT id FROM guests WHERE is_event_member(event_id)));

-- ── Hotels ────────────────────────────────────────────────────────────────────
CREATE POLICY "hotels_select" ON hotels FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "hotels_write"  ON hotels FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "hotel_rooms_all" ON hotel_rooms FOR ALL
  USING (hotel_id IN (SELECT id FROM hotels WHERE is_event_member(event_id)));

-- ── Budget ────────────────────────────────────────────────────────────────────
CREATE POLICY "budget_select" ON budget_items FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "budget_write"  ON budget_items FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Vendors ───────────────────────────────────────────────────────────────────
CREATE POLICY "vendors_select" ON vendors FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "vendors_write"  ON vendors FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE POLICY "tasks_all" ON tasks FOR ALL USING (is_event_member(event_id));

-- ── Reminders ─────────────────────────────────────────────────────────────────
CREATE POLICY "reminders_all" ON reminders FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- ── Sub-Events ────────────────────────────────────────────────────────────────
CREATE POLICY "subevents_select" ON sub_events FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "subevents_write"  ON sub_events FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "subevents_guests_all" ON sub_event_guests FOR ALL
  USING (sub_event_id IN (SELECT id FROM sub_events WHERE is_event_member(event_id)));

-- ── Seating ───────────────────────────────────────────────────────────────────
CREATE POLICY "seating_select"     ON seating_tables      FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "seating_write"      ON seating_tables      FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );
CREATE POLICY "seating_assign_all" ON seating_assignments FOR ALL
  USING (table_id IN (SELECT id FROM seating_tables WHERE is_event_member(event_id)));

-- ── Catering ──────────────────────────────────────────────────────────────────
CREATE POLICY "catering_select" ON catering_plans FOR SELECT
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[]));
CREATE POLICY "catering_write"  ON catering_plans FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Feature Toggles ───────────────────────────────────────────────────────────
CREATE POLICY "ft_select" ON feature_toggles FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "ft_write"  ON feature_toggles FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Organizer Suggestions ─────────────────────────────────────────────────────
CREATE POLICY "org_vendor_s" ON organizer_vendor_suggestions   FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "org_vendor_w" ON organizer_vendor_suggestions   FOR ALL    USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));
CREATE POLICY "org_hotel_s"  ON organizer_hotel_suggestions    FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "org_hotel_w"  ON organizer_hotel_suggestions    FOR ALL    USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));
CREATE POLICY "org_cater_s"  ON organizer_catering_suggestions FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "org_cater_w"  ON organizer_catering_suggestions FOR ALL    USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Deko ──────────────────────────────────────────────────────────────────────
CREATE POLICY "deko_sug_select" ON deko_suggestions FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "deko_sug_write"  ON deko_suggestions FOR ALL    USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));
CREATE POLICY "deko_wish_all"   ON deko_wishes      FOR ALL    USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

-- ── Location Images ───────────────────────────────────────────────────────────
CREATE POLICY "loc_img_select" ON location_images FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "loc_img_write"  ON location_images FOR ALL    USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Guest Photos ──────────────────────────────────────────────────────────────
CREATE POLICY "guest_photos_select" ON guest_photos FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "guest_photos_insert" ON guest_photos FOR INSERT WITH CHECK (is_event_member(event_id));
CREATE POLICY "guest_photos_delete" ON guest_photos FOR DELETE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- ── Timeline ──────────────────────────────────────────────────────────────────
CREATE POLICY "timeline_select" ON timeline_entries FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "timeline_write"  ON timeline_entries FOR ALL
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Organizer Applications ────────────────────────────────────────────────────
-- Jeder (auch nicht eingeloggt) kann eine Bewerbung einreichen
CREATE POLICY "app_select" ON organizer_applications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "app_insert" ON organizer_applications FOR INSERT WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL
);

-- ── Dienstleister Profiles ────────────────────────────────────────────────────
CREATE POLICY "dl_profile_select" ON dienstleister_profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dl_profile_insert" ON dienstleister_profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── User Dienstleister ────────────────────────────────────────────────────────
CREATE POLICY "ud_select" ON user_dienstleister FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ud_insert" ON user_dienstleister FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Event Dienstleister ───────────────────────────────────────────────────────
CREATE POLICY "ed_select" ON event_dienstleister FOR SELECT
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  );
CREATE POLICY "ed_insert" ON event_dienstleister FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
CREATE POLICY "ed_update" ON event_dienstleister FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  );
CREATE POLICY "ed_delete" ON event_dienstleister FOR DELETE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- ── Trauzeuge Permissions ─────────────────────────────────────────────────────
CREATE POLICY "tz_perm_select" ON trauzeuge_permissions FOR SELECT
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  );
CREATE POLICY "tz_perm_write" ON trauzeuge_permissions FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- ── Audit Log ─────────────────────────────────────────────────────────────────
CREATE POLICY "audit_select" ON audit_log FOR SELECT
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));
-- INSERT nur via write_audit_log() SECURITY DEFINER

-- ── Conversations ─────────────────────────────────────────────────────────────
CREATE POLICY "conv_select" ON conversations FOR SELECT
  USING (
    is_event_member(event_id)
    AND (
      array_length(participant_roles, 1) IS NULL
      OR get_event_role(event_id) = ANY(participant_roles)
    )
  );
CREATE POLICY "conv_insert" ON conversations FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

-- ── Messages ──────────────────────────────────────────────────────────────────
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
CREATE POLICY "msg_update" ON messages FOR UPDATE USING (sender_id = auth.uid());

-- ── Pending Changes ───────────────────────────────────────────────────────────
CREATE POLICY "pc_select" ON pending_changes FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "pc_insert" ON pending_changes FOR INSERT WITH CHECK (is_event_member(event_id));
CREATE POLICY "pc_update" ON pending_changes FOR UPDATE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));


-- ════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;


-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- Manuell im Dashboard anlegen: Storage → New bucket
--   • location-images  (private)
--   • deko-images      (private)
--   • guest-photos     (private)
-- ════════════════════════════════════════════════════════════════════════════

// lib/db/schema.ts
// Idempotentes Schema — kann beliebig oft ausgeführt werden (CREATE IF NOT EXISTS / EXCEPTION-Handling)
// Wird via /api/init-db auf den Supabase-Server angewandt.

export const SCHEMA_SQL = /* sql */ `

-- ── Enum-Typ ──────────────────────────────────────────────────────────────────
-- Konditionaler CREATE: nur erstellen wenn noch nicht vorhanden
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('veranstalter', 'brautpaar', 'trauzeuge', 'dienstleister');
  END IF;
END $$;

-- ── Profile ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT,
  role                 user_role NOT NULL DEFAULT 'brautpaar',
  is_approved_organizer BOOLEAN DEFAULT false,
  application_status   TEXT DEFAULT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Events ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by          UUID REFERENCES auth.users(id),
  title               TEXT NOT NULL DEFAULT 'Unsere Hochzeit',
  couple_name         TEXT,
  date                TEXT,
  venue               TEXT,
  venue_address       TEXT,
  dresscode           TEXT,
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
CREATE TABLE IF NOT EXISTS event_members (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role     user_role NOT NULL,
  UNIQUE(event_id, user_id)
);

-- ── Invite-Codes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
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

-- ── Gäste ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS guests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  email          TEXT,
  token          TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  status         TEXT DEFAULT 'angelegt',
  phone          TEXT,
  address        TEXT,
  trink_alkohol  BOOLEAN,
  meal_choice    TEXT,
  allergy_tags   TEXT[] DEFAULT '{}',
  allergy_custom TEXT,
  arrival_date   TEXT,
  arrival_time   TEXT,
  transport_mode TEXT,
  hotel_room_id  TEXT,
  message        TEXT,
  responded_at   TIMESTAMPTZ,
  sub_event_ids  TEXT[] DEFAULT '{}',
  notes          TEXT,
  side           TEXT,
  departure_date TEXT
);

-- ── Begleitpersonen ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS begleitpersonen (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id       UUID REFERENCES guests(id) ON DELETE CASCADE,
  name           TEXT,
  age_category   TEXT,
  trink_alkohol  BOOLEAN,
  meal_choice    TEXT,
  allergy_tags   TEXT[] DEFAULT '{}',
  allergy_custom TEXT
);

-- ── Hotels & Zimmer ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hotels (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  address  TEXT
);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id) ON DELETE CASCADE,
  room_type       TEXT NOT NULL,
  total_rooms     INT DEFAULT 0,
  booked_rooms    INT DEFAULT 0,
  price_per_night NUMERIC DEFAULT 0
);

-- ── Timeline ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timeline_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  time       TEXT,
  title      TEXT,
  location   TEXT,
  sort_order INT DEFAULT 0
);

-- ── Budget ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budget_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID REFERENCES events(id) ON DELETE CASCADE,
  category       TEXT,
  description    TEXT,
  planned        NUMERIC DEFAULT 0,
  actual         NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'offen',
  notes          TEXT
);

-- ── Dienstleister (Event-gebundene Vendor-Records) ───────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
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

-- ── Aufgaben ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title    TEXT,
  phase    TEXT,
  done     BOOLEAN DEFAULT false,
  notes    TEXT
);

-- ── Erinnerungen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  type        TEXT,
  title       TEXT,
  target_date TEXT,
  sent        BOOLEAN DEFAULT false,
  notes       TEXT
);

-- ── Sub-Events ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT,
  date        TEXT,
  time        TEXT,
  venue       TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS sub_event_guests (
  sub_event_id UUID REFERENCES sub_events(id) ON DELETE CASCADE,
  guest_id     UUID REFERENCES guests(id) ON DELETE CASCADE,
  PRIMARY KEY (sub_event_id, guest_id)
);

-- ── Sitzplan ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seating_tables (
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

CREATE TABLE IF NOT EXISTS seating_assignments (
  table_id UUID REFERENCES seating_tables(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  PRIMARY KEY (table_id, guest_id)
);

-- ── Catering-Plan ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_plans (
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

-- ── Feature-Toggles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_toggles (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  enabled  BOOLEAN DEFAULT true,
  PRIMARY KEY (event_id, key)
);

-- ── Veranstalter-Vorschläge ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizer_vendor_suggestions (
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

CREATE TABLE IF NOT EXISTS organizer_hotel_suggestions (
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

CREATE TABLE IF NOT EXISTS organizer_catering_suggestions (
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

-- ── Deko ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deko_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  status      TEXT DEFAULT 'vorschlag'
);

CREATE TABLE IF NOT EXISTS deko_wishes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  title      TEXT,
  notes      TEXT,
  image_url  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Bilder ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guest_photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  uploader_name TEXT,
  storage_url   TEXT NOT NULL,
  uploaded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Veranstalter-Mitarbeiter ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizer_staff (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  responsibilities TEXT,
  role_category    TEXT,
  available_days   TEXT[] DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Personalplanung ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalplanung_days (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT 'Tag',
  date       TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personalplanung_assignments (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id   UUID NOT NULL REFERENCES personalplanung_days(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES organizer_staff(id) ON DELETE CASCADE,
  UNIQUE(day_id, staff_id)
);

CREATE TABLE IF NOT EXISTS personalplanung_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id     UUID NOT NULL REFERENCES personalplanung_days(id) ON DELETE CASCADE,
  staff_id   UUID NOT NULL REFERENCES organizer_staff(id) ON DELETE CASCADE,
  task       TEXT NOT NULL DEFAULT 'Schicht',
  start_hour NUMERIC NOT NULL,
  end_hour   NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
  reviewed_by  UUID REFERENCES profiles(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

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

-- ── User ↔ Dienstleister-Zuordnung ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_dienstleister (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dienstleister_id UUID REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, dienstleister_id)
);

-- ── Dienstleister ↔ Event-Verbindung ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_dienstleister (
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

-- ── Messaging ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT,
  participant_roles user_role[] DEFAULT '{}',
  created_by        UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES profiles(id),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  edited_at       TIMESTAMPTZ
);

-- ── Änderungs-Freigabesystem ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_changes (
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

-- ── Helper-Funktionen ────────────────────────────────────────────────────────
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

-- ── Row Level Security ────────────────────────────────────────────────────────
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
ALTER TABLE profiles                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_staff                ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalplanung_days           ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalplanung_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalplanung_shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dienstleister_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dienstleister             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dienstleister            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trauzeuge_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_changes                ENABLE ROW LEVEL SECURITY;

-- ── Policies ──────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "events_select" ON events FOR SELECT USING (is_event_member(id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (created_by = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "events_update" ON events FOR UPDATE USING (is_event_member(id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "events_delete" ON events FOR DELETE USING (is_event_member(id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "members_select" ON event_members FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "members_insert" ON event_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "members_delete" ON event_members FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]) OR user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "invite_select" ON invite_codes FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invite_insert" ON invite_codes FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invite_update" ON invite_codes FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "guests_select" ON guests FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guests_insert" ON guests FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guests_update" ON guests FOR UPDATE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guests_delete" ON guests FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "begleit_all" ON begleitpersonen FOR ALL USING (guest_id IN (SELECT id FROM guests WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hotels_select" ON hotels FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hotels_write"  ON hotels FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hotel_rooms_all" ON hotel_rooms FOR ALL USING (hotel_id IN (SELECT id FROM hotels WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "budget_select" ON budget_items FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "budget_write"  ON budget_items FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "vendors_select" ON vendors FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "vendors_write"  ON vendors FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "tasks_all" ON tasks FOR ALL USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "reminders_all" ON reminders FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "subevents_select" ON sub_events FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "subevents_write"  ON sub_events FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "subevents_guests_all" ON sub_event_guests FOR ALL USING (sub_event_id IN (SELECT id FROM sub_events WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "seating_select" ON seating_tables FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "seating_write"  ON seating_tables FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "seating_assign_all" ON seating_assignments FOR ALL USING (table_id IN (SELECT id FROM seating_tables WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "catering_select" ON catering_plans FOR SELECT USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "catering_write"  ON catering_plans FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "ft_select" ON feature_toggles FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ft_write"  ON feature_toggles FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "org_vendor_s" ON organizer_vendor_suggestions FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_vendor_w" ON organizer_vendor_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_hotel_s"  ON organizer_hotel_suggestions  FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_hotel_w"  ON organizer_hotel_suggestions  FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_cater_s"  ON organizer_catering_suggestions FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_cater_w"  ON organizer_catering_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "deko_sug_select" ON deko_suggestions FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "deko_sug_write"  ON deko_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "deko_wish_all"   ON deko_wishes FOR ALL        USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "loc_img_select" ON location_images FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "loc_img_write"  ON location_images FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "guest_photos_select" ON guest_photos FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guest_photos_insert" ON guest_photos FOR INSERT WITH CHECK (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guest_photos_delete" ON guest_photos FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "timeline_select" ON timeline_entries FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "timeline_write"  ON timeline_entries FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) AND NOT is_event_frozen(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- organizer_applications: user sieht nur eigene
DO $$ BEGIN CREATE POLICY "app_select" ON organizer_applications FOR SELECT USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "app_insert" ON organizer_applications FOR INSERT WITH CHECK (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- organizer_staff: Veranstalter sieht/verwaltet nur eigene Mitarbeiter
DO $$ BEGIN CREATE POLICY "staff_select" ON organizer_staff FOR SELECT USING (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "staff_insert" ON organizer_staff FOR INSERT WITH CHECK (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "staff_update" ON organizer_staff FOR UPDATE USING (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "staff_delete" ON organizer_staff FOR DELETE USING (organizer_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- personalplanung_days: alle Event-Mitglieder lesen, nur Veranstalter schreiben
DO $$ BEGIN CREATE POLICY "pp_days_select" ON personalplanung_days FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pp_days_write"  ON personalplanung_days FOR ALL   USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- personalplanung_assignments
DO $$ BEGIN CREATE POLICY "pp_assign_select" ON personalplanung_assignments FOR SELECT USING (day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pp_assign_write"  ON personalplanung_assignments FOR ALL   USING (day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id, ARRAY['veranstalter']::user_role[]))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- personalplanung_shifts
DO $$ BEGIN CREATE POLICY "pp_shifts_select" ON personalplanung_shifts FOR SELECT USING (day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pp_shifts_write"  ON personalplanung_shifts FOR ALL   USING (day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id, ARRAY['veranstalter']::user_role[]))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- dienstleister_profiles: alle authentifizierten User können lesen
DO $$ BEGIN CREATE POLICY "dl_profile_select" ON dienstleister_profiles FOR SELECT USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "dl_profile_insert" ON dienstleister_profiles FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- user_dienstleister
DO $$ BEGIN CREATE POLICY "ud_select" ON user_dienstleister FOR SELECT USING (user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ud_insert" ON user_dienstleister FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- event_dienstleister
DO $$ BEGIN CREATE POLICY "ed_select" ON event_dienstleister FOR SELECT USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) OR user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ed_insert" ON event_dienstleister FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ed_update" ON event_dienstleister FOR UPDATE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) OR user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ed_delete" ON event_dienstleister FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- trauzeuge_permissions
DO $$ BEGIN CREATE POLICY "tz_perm_select" ON trauzeuge_permissions FOR SELECT USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]) OR user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "tz_perm_write"  ON trauzeuge_permissions FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_log
DO $$ BEGIN CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- conversations
DO $$ BEGIN CREATE POLICY "conv_select" ON conversations FOR SELECT USING (is_event_member(event_id) AND (array_length(participant_roles, 1) IS NULL OR get_event_role(event_id) = ANY(participant_roles))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "conv_insert" ON conversations FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- messages
DO $$ BEGIN CREATE POLICY "msg_select" ON messages FOR SELECT USING (conversation_id IN (SELECT id FROM conversations WHERE is_event_member(event_id) AND (array_length(participant_roles, 1) IS NULL OR get_event_role(event_id) = ANY(participant_roles)))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "msg_insert" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT id FROM conversations WHERE is_event_member(event_id) AND (array_length(participant_roles, 1) IS NULL OR get_event_role(event_id) = ANY(participant_roles)))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "msg_update" ON messages FOR UPDATE USING (sender_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- pending_changes
DO $$ BEGIN CREATE POLICY "pc_select" ON pending_changes FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pc_insert" ON pending_changes FOR INSERT WITH CHECK (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "pc_update" ON pending_changes FOR UPDATE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

`

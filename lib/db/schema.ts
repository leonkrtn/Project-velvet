// lib/db/schema.ts
// Idempotentes Schema — kann beliebig oft ausgeführt werden (CREATE IF NOT EXISTS / EXCEPTION-Handling)
// Wird via /api/init-db auf den Supabase-Server angewandt.

export const SCHEMA_SQL = /* sql */ `

-- ── Enum-Typ (einmalig erstellen, Fehler ignorieren wenn schon vorhanden) ──
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('organizer', 'brautpaar', 'trauzeuge', 'caterer', 'guest');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Profile ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  role       user_role NOT NULL DEFAULT 'brautpaar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'brautpaar')
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
  sub_event_ids  TEXT[] DEFAULT '{}'
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

-- ── Dienstleister ─────────────────────────────────────────────────────────────
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

-- ── Policies (idempotent mit DO/EXCEPTION) ────────────────────────────────────
DO $$ BEGIN CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "events_select" ON events FOR SELECT USING (is_event_member(id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "events_update" ON events FOR UPDATE USING (is_event_member(id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "events_delete" ON events FOR DELETE USING (is_event_member(id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "members_select" ON event_members FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "members_insert" ON event_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "members_delete" ON event_members FOR DELETE USING (is_event_member(event_id, ARRAY['organizer']::user_role[]) OR user_id = auth.uid()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "invite_select" ON invite_codes FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invite_insert" ON invite_codes FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "invite_update" ON invite_codes FOR UPDATE USING (auth.uid() IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "guests_select" ON guests FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guests_insert" ON guests FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guests_update" ON guests FOR UPDATE USING (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guests_delete" ON guests FOR DELETE USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "begleit_all" ON begleitpersonen FOR ALL USING (guest_id IN (SELECT id FROM guests WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "hotels_select" ON hotels FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hotels_write"  ON hotels FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "hotel_rooms_all" ON hotel_rooms FOR ALL USING (hotel_id IN (SELECT id FROM hotels WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "budget_select" ON budget_items FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "budget_write"  ON budget_items FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "vendors_select" ON vendors FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "vendors_write"  ON vendors FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "tasks_all" ON tasks FOR ALL USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "reminders_all" ON reminders FOR ALL USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "subevents_select" ON sub_events FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "subevents_write"  ON sub_events FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "subevents_guests_all" ON sub_event_guests FOR ALL USING (sub_event_id IN (SELECT id FROM sub_events WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "seating_select" ON seating_tables FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "seating_write"  ON seating_tables FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "seating_assign_all" ON seating_assignments FOR ALL USING (table_id IN (SELECT id FROM seating_tables WHERE is_event_member(event_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "catering_select" ON catering_plans FOR SELECT USING (is_event_member(event_id, ARRAY['organizer','brautpaar','caterer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "catering_write"  ON catering_plans FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "ft_select" ON feature_toggles FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "ft_write"  ON feature_toggles FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "org_vendor_s" ON organizer_vendor_suggestions FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_vendor_w" ON organizer_vendor_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_hotel_s"  ON organizer_hotel_suggestions  FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_hotel_w"  ON organizer_hotel_suggestions  FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_cater_s"  ON organizer_catering_suggestions FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "org_cater_w"  ON organizer_catering_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "deko_sug_select" ON deko_suggestions FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "deko_sug_write"  ON deko_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "deko_wish_all"   ON deko_wishes FOR ALL        USING (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "loc_img_select" ON location_images FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "loc_img_write"  ON location_images FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "guest_photos_select" ON guest_photos FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guest_photos_insert" ON guest_photos FOR INSERT WITH CHECK (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "guest_photos_delete" ON guest_photos FOR DELETE USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE POLICY "timeline_select" ON timeline_entries FOR SELECT USING (is_event_member(event_id)); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "timeline_write"  ON timeline_entries FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[])); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

`

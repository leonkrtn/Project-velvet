-- Velvet Wedding App — Initial Database Schema
-- DSGVO-konform: EU-Region, RLS auf allen Tabellen
-- Version: 001

-- ── Rollen ────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('organizer', 'brautpaar', 'trauzeuge', 'caterer', 'guest');

-- ── Profile (erweitert auth.users) ───────────────────────────────────────
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  role       user_role NOT NULL DEFAULT 'brautpaar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'brautpaar')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── Events ────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL DEFAULT 'Unsere Hochzeit',
  couple_name      TEXT,
  date             TEXT,
  venue            TEXT,
  venue_address    TEXT,
  dresscode        TEXT,
  ceremony_start   TEXT,
  ceremony_end     TEXT,
  reception_start  TEXT,
  reception_end    TEXT,
  children_allowed BOOLEAN DEFAULT true,
  children_note    TEXT,
  meal_options     TEXT[] DEFAULT '{"fleisch","fisch","vegetarisch","vegan"}',
  max_begleitpersonen INT DEFAULT 2,
  room_length      NUMERIC DEFAULT 12,
  room_width       NUMERIC DEFAULT 8,
  onboarding_complete BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Event-Mitglieder (Zuordnung User ↔ Event mit Rolle) ───────────────────
CREATE TABLE event_members (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role     user_role NOT NULL,
  UNIQUE(event_id, user_id)
);

-- ── Invite-Codes (Veranstalter lädt andere ein) ───────────────────────────
CREATE TABLE invite_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID REFERENCES events(id) ON DELETE CASCADE,
  code       TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  role       user_role NOT NULL,
  used       BOOLEAN DEFAULT false,
  used_by    UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ── Gäste ─────────────────────────────────────────────────────────────────
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

-- ── Begleitpersonen ───────────────────────────────────────────────────────
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

-- ── Hotels ────────────────────────────────────────────────────────────────
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

-- ── Timeline ──────────────────────────────────────────────────────────────
CREATE TABLE timeline_entries (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  time     TEXT,
  title    TEXT,
  location TEXT,
  sort_order INT DEFAULT 0
);

-- ── Budget ────────────────────────────────────────────────────────────────
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

-- ── Dienstleister (Vendors) ───────────────────────────────────────────────
CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT,
  category      TEXT,
  status        TEXT DEFAULT 'angefragt',
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  price         NUMERIC,
  notes         TEXT
);

-- ── Aufgaben ──────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  title    TEXT,
  phase    TEXT,
  done     BOOLEAN DEFAULT false,
  notes    TEXT
);

-- ── Erinnerungen ─────────────────────────────────────────────────────────
CREATE TABLE reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  type        TEXT,
  title       TEXT,
  target_date TEXT,
  sent        BOOLEAN DEFAULT false,
  notes       TEXT
);

-- ── Sub-Events ────────────────────────────────────────────────────────────
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

-- ── Sitzplan ──────────────────────────────────────────────────────────────
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

-- ── Catering-Plan ─────────────────────────────────────────────────────────
CREATE TABLE catering_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                    UUID UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  service_style               TEXT DEFAULT '',
  location_has_kitchen        BOOLEAN DEFAULT false,
  midnight_snack              BOOLEAN DEFAULT false,
  midnight_snack_note         TEXT DEFAULT '',
  drinks_billing              TEXT DEFAULT 'pauschale',
  drinks_selection            TEXT[] DEFAULT '{}',
  champagne_finger_food       BOOLEAN DEFAULT false,
  champagne_finger_food_note  TEXT DEFAULT '',
  service_staff               BOOLEAN DEFAULT false,
  equipment_needed            TEXT[] DEFAULT '{}',
  budget_per_person           NUMERIC DEFAULT 0,
  budget_includes_drinks      BOOLEAN DEFAULT false,
  catering_notes              TEXT DEFAULT '',
  -- Locked fields (from organizer suggestion): Brautpaar cannot edit these
  locked_fields               TEXT[] DEFAULT '{}'
);

-- ── Feature-Toggles ───────────────────────────────────────────────────────
CREATE TABLE feature_toggles (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  key      TEXT NOT NULL,
  enabled  BOOLEAN DEFAULT true,
  PRIMARY KEY (event_id, key)
);

-- ── Veranstalter-Vorschläge ───────────────────────────────────────────────
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
  -- Welche Catering-Felder darf das Brautpaar NICHT bearbeiten?
  locked_fields    TEXT[] DEFAULT '{}'
);

-- ── Deko ──────────────────────────────────────────────────────────────────
CREATE TABLE deko_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  image_url   TEXT,  -- Supabase Storage URL
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

-- ── Location-Bilder (Veranstalter-Upload) ────────────────────────────────
CREATE TABLE location_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Gäste-Fotos (Post-Event) ──────────────────────────────────────────────
CREATE TABLE guest_photos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID REFERENCES events(id) ON DELETE CASCADE,
  uploader_name     TEXT,
  uploader_guest_id UUID REFERENCES guests(id),
  storage_url       TEXT NOT NULL,
  uploaded_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: prüft ob auth user Mitglied des Events ist
CREATE OR REPLACE FUNCTION is_event_member(eid UUID, required_roles user_role[] DEFAULT NULL)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_members
    WHERE event_id = eid
      AND user_id = auth.uid()
      AND (required_roles IS NULL OR role = ANY(required_roles))
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper: gibt Rolle des Users für ein Event zurück
CREATE OR REPLACE FUNCTION get_event_role(eid UUID)
RETURNS user_role AS $$
  SELECT role FROM event_members
  WHERE event_id = eid AND user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Aktiviere RLS auf allen Tabellen
ALTER TABLE events                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE begleitpersonen               ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE feature_toggles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_vendor_suggestions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_hotel_suggestions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_catering_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_suggestions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE deko_wishes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_images               ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_photos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                       ENABLE ROW LEVEL SECURITY;

-- Profiles: jeder kann eigenes Profil sehen/bearbeiten
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

-- Events: nur Mitglieder
CREATE POLICY "events_select" ON events FOR SELECT USING (is_event_member(id));
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "events_update" ON events FOR UPDATE USING (is_event_member(id, ARRAY['organizer','brautpaar']::user_role[]));
CREATE POLICY "events_delete" ON events FOR DELETE USING (is_event_member(id, ARRAY['organizer']::user_role[]));

-- Event members
CREATE POLICY "members_select" ON event_members FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "members_insert" ON event_members FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  -- Jeder kann sich selbst hinzufügen (via invite code flow), oder Organizer fügt andere hinzu
);
CREATE POLICY "members_delete" ON event_members FOR DELETE USING (
  is_event_member(event_id, ARRAY['organizer']::user_role[]) OR user_id = auth.uid()
);

-- Invite codes: nur Organizer kann anlegen
CREATE POLICY "invite_select"  ON invite_codes FOR SELECT  USING (is_event_member(event_id));
CREATE POLICY "invite_insert"  ON invite_codes FOR INSERT  WITH CHECK (is_event_member(event_id, ARRAY['organizer']::user_role[]));
CREATE POLICY "invite_update"  ON invite_codes FOR UPDATE  USING (auth.uid() IS NOT NULL);  -- anyone can "use" a code

-- Guests: alle Event-Mitglieder können sehen; Organizer/Brautpaar können schreiben
CREATE POLICY "guests_select" ON guests FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "guests_insert" ON guests FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[]));
CREATE POLICY "guests_update" ON guests FOR UPDATE USING (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[]));
CREATE POLICY "guests_delete" ON guests FOR DELETE USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- Begleitpersonen: wie Gäste
CREATE POLICY "begleit_all" ON begleitpersonen FOR ALL
  USING (guest_id IN (SELECT id FROM guests WHERE is_event_member(event_id)));

-- Hotels: alle sehen, Organizer/Brautpaar schreiben
CREATE POLICY "hotels_select" ON hotels FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "hotels_write"  ON hotels FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

CREATE POLICY "hotel_rooms_all" ON hotel_rooms FOR ALL
  USING (hotel_id IN (SELECT id FROM hotels WHERE is_event_member(event_id)));

-- Budget: Organizer/Brautpaar
CREATE POLICY "budget_select" ON budget_items FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "budget_write"  ON budget_items FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- Vendors: Organizer/Brautpaar
CREATE POLICY "vendors_select" ON vendors FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "vendors_write"  ON vendors FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- Tasks: alle Event-Mitglieder
CREATE POLICY "tasks_all" ON tasks FOR ALL USING (is_event_member(event_id));

-- Reminders: Organizer/Brautpaar
CREATE POLICY "reminders_all" ON reminders FOR ALL USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- Sub-Events: alle sehen, Organizer/Brautpaar schreiben
CREATE POLICY "subevents_select" ON sub_events FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "subevents_write"  ON sub_events FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));
CREATE POLICY "subevents_guests_all" ON sub_event_guests FOR ALL
  USING (sub_event_id IN (SELECT id FROM sub_events WHERE is_event_member(event_id)));

-- Seating: alle sehen, Organizer/Brautpaar/Trauzeuge schreiben
CREATE POLICY "seating_select" ON seating_tables FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "seating_write"  ON seating_tables FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[]));
CREATE POLICY "seating_assign_all" ON seating_assignments FOR ALL
  USING (table_id IN (SELECT id FROM seating_tables WHERE is_event_member(event_id)));

-- Catering: Organizer/Brautpaar/Caterer sehen; Organizer/Brautpaar schreiben
CREATE POLICY "catering_select" ON catering_plans FOR SELECT
  USING (is_event_member(event_id, ARRAY['organizer','brautpaar','caterer']::user_role[]));
CREATE POLICY "catering_write"  ON catering_plans FOR ALL
  USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- Feature toggles: alle sehen, Organizer schreibt
CREATE POLICY "ft_select" ON feature_toggles FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "ft_write"  ON feature_toggles FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[]));

-- Organizer suggestions: alle sehen, Organizer schreibt
CREATE POLICY "org_vendor_s" ON organizer_vendor_suggestions FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "org_vendor_w" ON organizer_vendor_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[]));
CREATE POLICY "org_hotel_s"  ON organizer_hotel_suggestions  FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "org_hotel_w"  ON organizer_hotel_suggestions  FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[]));
CREATE POLICY "org_cater_s"  ON organizer_catering_suggestions FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "org_cater_w"  ON organizer_catering_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[]));

-- Deko
CREATE POLICY "deko_sug_select" ON deko_suggestions FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "deko_sug_write"  ON deko_suggestions FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[]));
CREATE POLICY "deko_wish_all"   ON deko_wishes FOR ALL        USING (is_event_member(event_id, ARRAY['organizer','brautpaar','trauzeuge']::user_role[]));

-- Location images: alle sehen, Organizer schreibt
CREATE POLICY "loc_img_select" ON location_images FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "loc_img_write"  ON location_images FOR ALL   USING (is_event_member(event_id, ARRAY['organizer']::user_role[]));

-- Guest photos: alle sehen, alle Mitglieder können hochladen
CREATE POLICY "guest_photos_select" ON guest_photos FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "guest_photos_insert" ON guest_photos FOR INSERT WITH CHECK (is_event_member(event_id));
CREATE POLICY "guest_photos_delete" ON guest_photos FOR DELETE
  USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- Timeline
CREATE POLICY "timeline_select" ON timeline_entries FOR SELECT USING (is_event_member(event_id));
CREATE POLICY "timeline_write"  ON timeline_entries FOR ALL   USING (is_event_member(event_id, ARRAY['organizer','brautpaar']::user_role[]));

-- ── Supabase Storage Buckets (ausführen im Dashboard oder via CLI) ─────────
-- storage.create_bucket('location-images', public := false);
-- storage.create_bucket('deko-images',     public := false);
-- storage.create_bucket('guest-photos',    public := false);

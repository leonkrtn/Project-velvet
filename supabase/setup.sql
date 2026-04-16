-- ============================================================
-- Velvet Wedding Platform — Production-Ready Database Setup v7
-- Supabase-kompatibel | Idempotent — beliebig oft ausführbar
-- ============================================================

-- !! FULL RESET — diese drei Zeilen auskommentieren wenn die Datenbank
-- !! komplett zurückgesetzt werden soll, danach das gesamte File ausführen.
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ════════════════════════════════════════════════════════════════════════════
-- ENUM TYPEN
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('veranstalter', 'brautpaar', 'trauzeuge', 'dienstleister');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE guest_status_enum AS ENUM ('angelegt', 'eingeladen', 'zugesagt', 'abgesagt', 'vielleicht');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vendor_status_enum AS ENUM ('angefragt', 'bestaetigt', 'abgesagt', 'in_verhandlung');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invite_status_enum AS ENUM ('offen', 'verwendet', 'abgelaufen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status_enum AS ENUM ('offen', 'angezahlt', 'bezahlt', 'storniert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE suggestion_status_enum AS ENUM ('vorschlag', 'akzeptiert', 'abgelehnt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pending_change_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_dienstleister_status_enum AS ENUM ('eingeladen', 'akzeptiert', 'abgelehnt', 'beendet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action_enum AS ENUM ('INSERT', 'UPDATE', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL DEFAULT 'Nutzer',
  email                 TEXT        NOT NULL DEFAULT '',
  is_approved_organizer BOOLEAN     NOT NULL DEFAULT false,
  application_status    application_status_enum DEFAULT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email) WHERE email <> '';

-- Auto-Profil bei neuem Auth-User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, is_approved_organizer)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'),          ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'),     ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      'Nutzer'
    ),
    COALESCE(NULLIF(TRIM(NEW.email), ''), ''),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ════════════════════════════════════════════════════════════════════════════
-- EVENTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS events (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL DEFAULT 'Unsere Hochzeit',
  couple_name         TEXT,
  date                DATE,
  venue               TEXT,
  venue_address       TEXT,
  dresscode           TEXT,
  ceremony_start      TIMESTAMPTZ,
  ceremony_end        TIMESTAMPTZ,
  reception_start     TIMESTAMPTZ,
  reception_end       TIMESTAMPTZ,
  children_allowed    BOOLEAN     NOT NULL DEFAULT true,
  children_note       TEXT,
  meal_options        TEXT[]      NOT NULL DEFAULT '{"fleisch","fisch","vegetarisch","vegan"}',
  max_begleitpersonen INT         NOT NULL DEFAULT 2 CHECK (max_begleitpersonen >= 0),
  room_length         NUMERIC     NOT NULL DEFAULT 12 CHECK (room_length > 0),
  room_width          NUMERIC     NOT NULL DEFAULT 8  CHECK (room_width  > 0),
  onboarding_complete BOOLEAN     NOT NULL DEFAULT false,
  data_freeze_at      TIMESTAMPTZ,
  created_by          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date       ON events(date)       WHERE date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by) WHERE created_by IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- EVENT MEMBERS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS event_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       user_role   NOT NULL,
  invited_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_members_user_id    ON event_members(user_id);
CREATE INDEX IF NOT EXISTS idx_event_members_event_role ON event_members(event_id, role);


-- ════════════════════════════════════════════════════════════════════════════
-- HELPER-FUNKTIONEN (alle NACH den Tabellen die sie referenzieren)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_event_member(
  eid            UUID,
  required_roles user_role[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   event_members
    WHERE  event_id = eid
      AND  user_id  = auth.uid()
      AND  (required_roles IS NULL OR role = ANY(required_roles))
  );
$$;

CREATE OR REPLACE FUNCTION public.get_event_role(eid UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM   event_members
  WHERE  event_id = eid
    AND  user_id  = auth.uid()
  LIMIT  1;
$$;

CREATE OR REPLACE FUNCTION public.is_event_frozen(eid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    data_freeze_at IS NOT NULL AND data_freeze_at <= NOW(),
    false
  )
  FROM events WHERE id = eid;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_member(
  p_event_id    UUID,
  p_target_role user_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   event_members em
    WHERE  em.event_id = p_event_id
      AND  em.user_id  = auth.uid()
      AND  (
        em.role = 'veranstalter'
        OR (em.role = 'brautpaar' AND p_target_role = 'trauzeuge')
      )
  );
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- INVITE CODES
-- (Muss vor get_invite_preview stehen, da diese Funktion LANGUAGE sql ist
--  und invite_codes zur Definitionszeit auflöst)
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invite_codes (
  id         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID               NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code       TEXT               NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  role       user_role          NOT NULL,
  status     invite_status_enum NOT NULL DEFAULT 'offen',
  used_by    UUID               REFERENCES profiles(id) ON DELETE SET NULL,
  used_at    TIMESTAMPTZ,
  created_by UUID               REFERENCES profiles(id) ON DELETE SET NULL,
  metadata   JSONB,
  created_at TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ        NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  CONSTRAINT chk_expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT chk_used_consistency CHECK (
    (used_by IS NULL AND used_at IS NULL) OR
    (used_by IS NOT NULL AND used_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_event_id    ON invite_codes(event_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code_status ON invite_codes(code) WHERE status = 'offen';


-- ════════════════════════════════════════════════════════════════════════════
-- INVITE RPCs
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_invite   invite_codes%ROWTYPE;
  v_existing event_members%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  SELECT * INTO v_invite
  FROM   invite_codes
  WHERE  code = p_code
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CODE_NOT_FOUND_OR_LOCKED');
  END IF;

  IF v_invite.status = 'verwendet' THEN
    IF v_invite.used_by = v_user_id THEN
      RETURN jsonb_build_object(
        'success', true, 'event_id', v_invite.event_id,
        'role', v_invite.role, 'idempotent', true
      );
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_ALREADY_USED');
  END IF;

  IF v_invite.status = 'abgelaufen' OR v_invite.expires_at < NOW() THEN
    UPDATE invite_codes SET status = 'abgelaufen' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'CODE_EXPIRED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_invite.event_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  SELECT * INTO v_existing
  FROM   event_members
  WHERE  event_id = v_invite.event_id AND user_id = v_user_id;

  IF FOUND THEN
    IF v_existing.role <> v_invite.role THEN
      UPDATE event_members
      SET    role = v_invite.role
      WHERE  event_id = v_invite.event_id AND user_id = v_user_id;
    END IF;
    UPDATE invite_codes
    SET    status = 'verwendet', used_by = v_user_id, used_at = NOW()
    WHERE  id = v_invite.id;
    RETURN jsonb_build_object(
      'success', true, 'event_id', v_invite.event_id,
      'role', v_invite.role, 'updated', true
    );
  END IF;

  UPDATE invite_codes
  SET    status = 'verwendet', used_by = v_user_id, used_at = NOW()
  WHERE  id = v_invite.id;

  INSERT INTO event_members (event_id, user_id, role, invited_by)
  VALUES (v_invite.event_id, v_user_id, v_invite.role, v_invite.created_by)
  ON CONFLICT (event_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN jsonb_build_object(
    'success', true, 'event_id', v_invite.event_id, 'role', v_invite.role
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'detail', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invite_code(
  p_event_id   UUID,
  p_role       user_role,
  p_expires_in INTERVAL DEFAULT INTERVAL '7 days',
  p_metadata   JSONB    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_code    TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED');
  END IF;

  IF NOT is_event_member(p_event_id, ARRAY['veranstalter','brautpaar']::user_role[]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  IF get_event_role(p_event_id) = 'brautpaar' AND p_role = 'veranstalter' THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN_ROLE');
  END IF;

  v_code := encode(gen_random_bytes(24), 'base64url');

  INSERT INTO invite_codes (event_id, code, role, created_by, metadata, expires_at)
  VALUES (p_event_id, v_code, p_role, v_user_id, p_metadata, NOW() + p_expires_in);

  RETURN jsonb_build_object(
    'success', true, 'code', v_code,
    'event_id', p_event_id, 'role', p_role,
    'expires_at', NOW() + p_expires_in
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'INTERNAL_ERROR', 'detail', SQLERRM);
END;
$$;

-- LANGUAGE sql → Tabelle muss VOR dieser Funktion existieren (s.o.)
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_code TEXT)
RETURNS TABLE(
  event_id   UUID,
  role       user_role,
  expires_at TIMESTAMPTZ,
  status     invite_status_enum
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event_id, role, expires_at, status
  FROM   invite_codes
  WHERE  code = p_code
    AND  status = 'offen'
    AND  expires_at > NOW();
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- GUESTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS guests (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID              NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name           TEXT              NOT NULL CHECK (TRIM(name) <> ''),
  email          TEXT,
  token          TEXT              UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  status         guest_status_enum NOT NULL DEFAULT 'angelegt',
  phone          TEXT,
  address        TEXT,
  trink_alkohol  BOOLEAN,
  meal_choice    TEXT,
  allergy_tags   TEXT[]            NOT NULL DEFAULT '{}',
  allergy_custom TEXT,
  side           TEXT,
  arrival_date   DATE,
  arrival_time   TIMESTAMPTZ,
  departure_date DATE,
  transport_mode TEXT,
  hotel_room_id  UUID,
  message        TEXT,
  responded_at   TIMESTAMPTZ,
  notes          TEXT,
  created_by     UUID              REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_departure_after_arrival CHECK (
    departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date
  )
);

CREATE INDEX IF NOT EXISTS idx_guests_event_id     ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_token        ON guests(token)         WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_event_status ON guests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_guests_hotel_room   ON guests(hotel_room_id) WHERE hotel_room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_created_by   ON guests(created_by)   WHERE created_by IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- BEGLEITPERSONEN
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS begleitpersonen (
  id             UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id       UUID   NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  name           TEXT,
  age_category   TEXT,
  trink_alkohol  BOOLEAN,
  meal_choice    TEXT,
  allergy_tags   TEXT[] NOT NULL DEFAULT '{}',
  allergy_custom TEXT
);

CREATE INDEX IF NOT EXISTS idx_begleitpersonen_guest_id ON begleitpersonen(guest_id);


-- ════════════════════════════════════════════════════════════════════════════
-- HOTELS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS hotels (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL CHECK (TRIM(name) <> ''),
  address    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotels_event_id ON hotels(event_id);

CREATE TABLE IF NOT EXISTS hotel_rooms (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID        NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_type       TEXT        NOT NULL,
  total_rooms     INT         NOT NULL DEFAULT 0 CHECK (total_rooms  >= 0),
  booked_rooms    INT         NOT NULL DEFAULT 0 CHECK (booked_rooms >= 0),
  price_per_night NUMERIC     NOT NULL DEFAULT 0 CHECK (price_per_night >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_booked_lte_total CHECK (booked_rooms <= total_rooms)
);

CREATE INDEX IF NOT EXISTS idx_hotel_rooms_hotel_id ON hotel_rooms(hotel_id);


-- ════════════════════════════════════════════════════════════════════════════
-- TIMELINE
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS timeline_entries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  time       TIMESTAMPTZ,
  title      TEXT,
  location   TEXT,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_event_sort ON timeline_entries(event_id, sort_order);


-- ════════════════════════════════════════════════════════════════════════════
-- BUDGET
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS budget_items (
  id             UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID                NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category       TEXT,
  description    TEXT,
  planned        NUMERIC             NOT NULL DEFAULT 0 CHECK (planned >= 0),
  actual         NUMERIC             NOT NULL DEFAULT 0 CHECK (actual  >= 0),
  payment_status payment_status_enum NOT NULL DEFAULT 'offen',
  notes          TEXT,
  created_at     TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_items_event_id ON budget_items(event_id);


-- ════════════════════════════════════════════════════════════════════════════
-- VENDORS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vendors (
  id           UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID               NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name         TEXT,
  category     TEXT,
  status       vendor_status_enum NOT NULL DEFAULT 'angefragt',
  contact_name TEXT,
  phone        TEXT,
  email        TEXT,
  price        NUMERIC            CHECK (price IS NULL OR price >= 0),
  notes        TEXT,
  created_at   TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_event_id ON vendors(event_id);


-- ════════════════════════════════════════════════════════════════════════════
-- TASKS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tasks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title      TEXT,
  phase      TEXT,
  done       BOOLEAN     NOT NULL DEFAULT false,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_event_id   ON tasks(event_id);
CREATE INDEX IF NOT EXISTS idx_tasks_event_done ON tasks(event_id, done);


-- ════════════════════════════════════════════════════════════════════════════
-- REMINDERS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reminders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type        TEXT,
  title       TEXT,
  target_date DATE,
  sent        BOOLEAN     NOT NULL DEFAULT false,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_event_id    ON reminders(event_id);
CREATE INDEX IF NOT EXISTS idx_reminders_unsent_date ON reminders(target_date)
  WHERE sent = false AND target_date IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- SUB-EVENTS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sub_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT,
  date        DATE,
  time        TIMESTAMPTZ,
  venue       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_event_id ON sub_events(event_id);

CREATE TABLE IF NOT EXISTS sub_event_guests (
  sub_event_id UUID NOT NULL REFERENCES sub_events(id) ON DELETE CASCADE,
  guest_id     UUID NOT NULL REFERENCES guests(id)     ON DELETE CASCADE,
  PRIMARY KEY (sub_event_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_sub_event_guests_guest     ON sub_event_guests(guest_id);
CREATE INDEX IF NOT EXISTS idx_sub_event_guests_sub_event ON sub_event_guests(sub_event_id);


-- ════════════════════════════════════════════════════════════════════════════
-- SEATING
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS seating_tables (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name         TEXT,
  capacity     INT         CHECK (capacity IS NULL OR capacity > 0),
  shape        TEXT        NOT NULL DEFAULT 'rectangular',
  pos_x        NUMERIC     NOT NULL DEFAULT 0,
  pos_y        NUMERIC     NOT NULL DEFAULT 0,
  rotation     NUMERIC     NOT NULL DEFAULT 0,
  table_length NUMERIC     NOT NULL DEFAULT 2.0 CHECK (table_length > 0),
  table_width  NUMERIC     NOT NULL DEFAULT 0.8 CHECK (table_width  > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seating_tables_event_id ON seating_tables(event_id);

CREATE TABLE IF NOT EXISTS seating_assignments (
  table_id UUID NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id)         ON DELETE CASCADE,
  PRIMARY KEY (table_id, guest_id)
);

CREATE INDEX IF NOT EXISTS idx_seating_assignments_guest ON seating_assignments(guest_id);
CREATE INDEX IF NOT EXISTS idx_seating_assignments_table ON seating_assignments(table_id);


-- ════════════════════════════════════════════════════════════════════════════
-- CATERING
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catering_plans (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                   UUID        NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  service_style              TEXT        NOT NULL DEFAULT '',
  location_has_kitchen       BOOLEAN     NOT NULL DEFAULT false,
  midnight_snack             BOOLEAN     NOT NULL DEFAULT false,
  midnight_snack_note        TEXT        NOT NULL DEFAULT '',
  drinks_billing             TEXT        NOT NULL DEFAULT 'pauschale',
  drinks_selection           TEXT[]      NOT NULL DEFAULT '{}',
  champagne_finger_food      BOOLEAN     NOT NULL DEFAULT false,
  champagne_finger_food_note TEXT        NOT NULL DEFAULT '',
  service_staff              BOOLEAN     NOT NULL DEFAULT false,
  equipment_needed           TEXT[]      NOT NULL DEFAULT '{}',
  budget_per_person          NUMERIC     NOT NULL DEFAULT 0 CHECK (budget_per_person >= 0),
  budget_includes_drinks     BOOLEAN     NOT NULL DEFAULT false,
  catering_notes             TEXT        NOT NULL DEFAULT '',
  locked_fields              TEXT[]      NOT NULL DEFAULT '{}',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════════════════
-- FEATURE TOGGLES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feature_toggles (
  event_id UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  key      TEXT    NOT NULL CHECK (TRIM(key) <> ''),
  enabled  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (event_id, key)
);


-- ════════════════════════════════════════════════════════════════════════════
-- ORGANIZER SUGGESTIONS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizer_vendor_suggestions (
  id             UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID                   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name           TEXT,
  category       TEXT,
  description    TEXT,
  price_estimate NUMERIC                NOT NULL DEFAULT 0 CHECK (price_estimate >= 0),
  contact_email  TEXT,
  contact_phone  TEXT,
  status         suggestion_status_enum NOT NULL DEFAULT 'vorschlag',
  created_at     TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_vendor_sugg_event ON organizer_vendor_suggestions(event_id);

CREATE TABLE IF NOT EXISTS organizer_hotel_suggestions (
  id              UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID                   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name            TEXT,
  address         TEXT,
  distance_km     NUMERIC                NOT NULL DEFAULT 0 CHECK (distance_km     >= 0),
  price_per_night NUMERIC                NOT NULL DEFAULT 0 CHECK (price_per_night >= 0),
  total_rooms     INT                    NOT NULL DEFAULT 0 CHECK (total_rooms      >= 0),
  description     TEXT,
  status          suggestion_status_enum NOT NULL DEFAULT 'vorschlag',
  created_at      TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_hotel_sugg_event ON organizer_hotel_suggestions(event_id);

CREATE TABLE IF NOT EXISTS organizer_catering_suggestions (
  id               UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID                   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name             TEXT,
  style            TEXT,
  description      TEXT,
  price_per_person NUMERIC                NOT NULL DEFAULT 0 CHECK (price_per_person >= 0),
  contact_email    TEXT,
  status           suggestion_status_enum NOT NULL DEFAULT 'vorschlag',
  locked_fields    TEXT[]                 NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_catering_sugg_event ON organizer_catering_suggestions(event_id);


-- ════════════════════════════════════════════════════════════════════════════
-- DEKO
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deko_suggestions (
  id          UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID                   NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  status      suggestion_status_enum NOT NULL DEFAULT 'vorschlag',
  created_at  TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deko_suggestions_event ON deko_suggestions(event_id);

CREATE TABLE IF NOT EXISTS deko_wishes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title      TEXT,
  notes      TEXT,
  image_url  TEXT,
  created_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deko_wishes_event      ON deko_wishes(event_id);
CREATE INDEX IF NOT EXISTS idx_deko_wishes_created_by ON deko_wishes(created_by) WHERE created_by IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- LOCATION IMAGES / GUEST PHOTOS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS location_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  storage_url TEXT        NOT NULL CHECK (TRIM(storage_url) <> ''),
  uploaded_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_images_event ON location_images(event_id);

CREATE TABLE IF NOT EXISTS guest_photos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_name     TEXT,
  uploader_guest_id UUID        REFERENCES guests(id) ON DELETE SET NULL,
  storage_url       TEXT        NOT NULL CHECK (TRIM(storage_url) <> ''),
  sort_order        INT         NOT NULL DEFAULT 0,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_photos_event ON guest_photos(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_photos_guest ON guest_photos(uploader_guest_id)
  WHERE uploader_guest_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- DIENSTLEISTER
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS dienstleister_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (TRIM(name) <> ''),
  company_name TEXT,
  category     TEXT        NOT NULL,
  email        TEXT,
  phone        TEXT,
  website      TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dienstleister_category ON dienstleister_profiles(category);

CREATE TABLE IF NOT EXISTS user_dienstleister (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id)               ON DELETE CASCADE,
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dienstleister_id)
);

CREATE INDEX IF NOT EXISTS idx_user_dl_user ON user_dienstleister(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dl_dl   ON user_dienstleister(dienstleister_id);

CREATE TABLE IF NOT EXISTS event_dienstleister (
  id               UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID                            NOT NULL REFERENCES events(id)                ON DELETE CASCADE,
  dienstleister_id UUID                            NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  user_id          UUID                            REFERENCES profiles(id) ON DELETE SET NULL,
  category         TEXT                            NOT NULL,
  scopes           TEXT[]                          NOT NULL DEFAULT '{}',
  status           event_dienstleister_status_enum NOT NULL DEFAULT 'eingeladen',
  invited_by       UUID                            REFERENCES profiles(id) ON DELETE SET NULL,
  invited_at       TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
  accepted_at      TIMESTAMPTZ,
  UNIQUE (event_id, dienstleister_id)
);

CREATE INDEX IF NOT EXISTS idx_event_dl_event ON event_dienstleister(event_id);
CREATE INDEX IF NOT EXISTS idx_event_dl_user  ON event_dienstleister(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_dl_dl    ON event_dienstleister(dienstleister_id);


-- ════════════════════════════════════════════════════════════════════════════
-- TRAUZEUGE PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trauzeuge_permissions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view_guests   BOOLEAN     NOT NULL DEFAULT true,
  can_edit_guests   BOOLEAN     NOT NULL DEFAULT false,
  can_view_seating  BOOLEAN     NOT NULL DEFAULT true,
  can_edit_seating  BOOLEAN     NOT NULL DEFAULT true,
  can_view_budget   BOOLEAN     NOT NULL DEFAULT false,
  can_view_catering BOOLEAN     NOT NULL DEFAULT false,
  can_view_timeline BOOLEAN     NOT NULL DEFAULT true,
  can_edit_timeline BOOLEAN     NOT NULL DEFAULT false,
  can_view_vendors  BOOLEAN     NOT NULL DEFAULT false,
  can_manage_deko   BOOLEAN     NOT NULL DEFAULT true,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tz_perm_event_user ON trauzeuge_permissions(event_id, user_id);


-- ════════════════════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID              REFERENCES events(id)   ON DELETE CASCADE,
  actor_id   UUID              REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role user_role,
  action     audit_action_enum NOT NULL,
  table_name TEXT              NOT NULL,
  record_id  UUID,
  old_data   JSONB,
  new_data   JSONB,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_event_time ON audit_log(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_record     ON audit_log(record_id)   WHERE record_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_actor      ON audit_log(actor_id)    WHERE actor_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_table      ON audit_log(table_name, created_at DESC);

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_event_id   UUID,
  p_actor_id   UUID,
  p_actor_role user_role,
  p_action     audit_action_enum,
  p_table_name TEXT,
  p_record_id  UUID  DEFAULT NULL,
  p_old_data   JSONB DEFAULT NULL,
  p_new_data   JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    event_id, actor_id, actor_role, action,
    table_name, record_id, old_data, new_data
  ) VALUES (
    p_event_id, p_actor_id, p_actor_role, p_action,
    p_table_name, p_record_id, p_old_data, p_new_data
  );
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- MESSAGING
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT,
  participant_roles user_role[] NOT NULL DEFAULT '{}',
  created_by        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_event   ON conversations(event_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES events(id)        ON DELETE CASCADE,
  sender_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  content         TEXT        NOT NULL CHECK (TRIM(content) <> ''),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at       TIMESTAMPTZ,
  CONSTRAINT chk_edited_after_created CHECK (edited_at IS NULL OR edited_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_time  ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_event_time ON messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender     ON messages(sender_id)  WHERE sender_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_event_conv ON messages(event_id, conversation_id);

CREATE OR REPLACE FUNCTION public.messages_set_event_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id
  FROM   conversations
  WHERE  id = NEW.conversation_id
  LIMIT  1;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION
      'messages_set_event_id: conversation % nicht gefunden', NEW.conversation_id;
  END IF;

  NEW.event_id := v_event_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_set_event_id_trigger ON messages;
CREATE TRIGGER messages_set_event_id_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE PROCEDURE public.messages_set_event_id();


-- ════════════════════════════════════════════════════════════════════════════
-- PENDING CHANGES
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pending_changes (
  id            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID                       NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  area          TEXT                       NOT NULL,
  proposed_by   UUID                       REFERENCES profiles(id) ON DELETE SET NULL,
  proposer_role user_role,
  change_data   JSONB                      NOT NULL,
  status        pending_change_status_enum NOT NULL DEFAULT 'pending',
  reviewed_by   UUID                       REFERENCES profiles(id) ON DELETE SET NULL,
  review_note   TEXT,
  created_at    TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  CONSTRAINT chk_resolved_after_created CHECK (
    resolved_at IS NULL OR resolved_at >= created_at
  )
);

CREATE INDEX IF NOT EXISTS idx_pending_changes_event_status ON pending_changes(event_id, status);

CREATE OR REPLACE FUNCTION public.set_pending_change_proposer_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.proposed_by IS NOT NULL THEN
    SELECT role INTO NEW.proposer_role
    FROM   event_members
    WHERE  event_id = NEW.event_id AND user_id = NEW.proposed_by
    LIMIT  1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_pending_change_insert ON pending_changes;
CREATE TRIGGER before_pending_change_insert
  BEFORE INSERT ON pending_changes
  FOR EACH ROW EXECUTE PROCEDURE public.set_pending_change_proposer_role();


-- ════════════════════════════════════════════════════════════════════════════
-- GUESTS AUDIT TRIGGER
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guests_audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_actor_id   UUID;
  v_actor_role user_role;
  v_record_id  UUID;
  v_old_data   JSONB;
  v_new_data   JSONB;
  v_action     audit_action_enum;
BEGIN
  v_actor_id := auth.uid();

  CASE TG_OP
    WHEN 'INSERT' THEN
      v_action    := 'INSERT';
      v_event_id  := NEW.event_id;
      v_record_id := NEW.id;
      v_old_data  := NULL;
      v_new_data  := to_jsonb(NEW);
    WHEN 'UPDATE' THEN
      v_action    := 'UPDATE';
      v_event_id  := NEW.event_id;
      v_record_id := NEW.id;
      v_old_data  := to_jsonb(OLD);
      v_new_data  := to_jsonb(NEW);
    WHEN 'DELETE' THEN
      v_action    := 'DELETE';
      v_event_id  := OLD.event_id;
      v_record_id := OLD.id;
      v_old_data  := to_jsonb(OLD);
      v_new_data  := NULL;
    ELSE
      RETURN NEW;
  END CASE;

  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role
    FROM   event_members
    WHERE  event_id = v_event_id AND user_id = v_actor_id
    LIMIT  1;
  END IF;

  BEGIN
    PERFORM public.write_audit_log(
      v_event_id, v_actor_id, v_actor_role,
      v_action, 'guests', v_record_id, v_old_data, v_new_data
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'guests_audit_trigger: Audit fehlgeschlagen: %', SQLERRM;
  END;

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS guests_audit_trigger ON guests;
CREATE TRIGGER guests_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON guests
  FOR EACH ROW EXECUTE PROCEDURE public.guests_audit_trigger_fn();


-- ════════════════════════════════════════════════════════════════════════════
-- NEW FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════

-- Veranstalter erstellt Event + Mitgliedschaft atomar
CREATE OR REPLACE FUNCTION public.create_event_with_organizer(
  p_title              TEXT,
  p_date               DATE,
  p_venue              TEXT,
  p_venue_address      TEXT,
  p_dresscode          TEXT,
  p_children_allowed   BOOLEAN,
  p_children_note      TEXT,
  p_meal_options       TEXT[],
  p_max_begleitpersonen INT,
  p_ceremony_start     TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_event_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_user_id AND is_approved_organizer = true
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: not an approved organizer' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO events (
    title, date, venue, venue_address, dresscode,
    children_allowed, children_note, meal_options,
    max_begleitpersonen, ceremony_start, created_by
  ) VALUES (
    p_title, p_date, p_venue, p_venue_address, p_dresscode,
    p_children_allowed, p_children_note, p_meal_options,
    p_max_begleitpersonen, p_ceremony_start, v_user_id
  )
  RETURNING id INTO v_event_id;

  INSERT INTO event_members (event_id, user_id, role)
  VALUES (v_event_id, v_user_id, 'veranstalter');

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_event_with_organizer(
  TEXT, DATE, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_event_with_organizer(
  TEXT, DATE, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT[], INT, TIMESTAMPTZ
) TO authenticated;


-- Setzt is_approved_organizer = true — nur via service_role aufrufbar
CREATE OR REPLACE FUNCTION public.approve_organizer(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET is_approved_organizer = true WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_organizer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_organizer(UUID) TO service_role;


-- Custom Access Token Hook — schreibt is_approved_organizer in app_metadata des JWT
-- Nach SQL-Ausführung manuell aktivieren:
--   Supabase Dashboard → Authentication → Hooks → Custom Access Token
--   → Funktion: public.custom_access_token_hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_organizer BOOLEAN;
  v_user_id      UUID;
BEGIN
  v_user_id := (event->>'user_id')::UUID;

  SELECT is_approved_organizer INTO v_is_organizer
  FROM profiles
  WHERE id = v_user_id;

  RETURN jsonb_set(
    event,
    '{claims,app_metadata,is_approved_organizer}',
    to_jsonb(COALESCE(v_is_organizer, false))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;


-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — aktivieren
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
ALTER TABLE dienstleister_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_dienstleister             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dienstleister            ENABLE ROW LEVEL SECURITY;
ALTER TABLE trauzeuge_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_changes                ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════════

-- ── Profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── Events ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_select" ON events;
CREATE POLICY "events_select" ON events
  FOR SELECT USING (is_event_member(id));

DROP POLICY IF EXISTS "events_insert" ON events;
CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_approved_organizer = true
    )
  );

DROP POLICY IF EXISTS "events_update" ON events;
CREATE POLICY "events_update" ON events
  FOR UPDATE
  USING (
    is_event_member(id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(id)
  )
  WITH CHECK (
    is_event_member(id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(id)
  );

DROP POLICY IF EXISTS "events_delete" ON events;
CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    is_event_member(id, ARRAY['veranstalter']::user_role[])
    OR created_by = auth.uid()
  );

-- ── Event Members ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "members_select" ON event_members;
CREATE POLICY "members_select" ON event_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_event_member(event_members.event_id)
  );

DROP POLICY IF EXISTS "members_insert" ON event_members;
CREATE POLICY "members_insert" ON event_members
  FOR INSERT WITH CHECK (
    can_manage_member(event_members.event_id, event_members.role)
  );

DROP POLICY IF EXISTS "members_update" ON event_members;
CREATE POLICY "members_update" ON event_members
  FOR UPDATE
  USING     (can_manage_member(event_members.event_id, event_members.role))
  WITH CHECK (can_manage_member(event_members.event_id, event_members.role));

DROP POLICY IF EXISTS "members_delete" ON event_members;
CREATE POLICY "members_delete" ON event_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR can_manage_member(event_members.event_id, event_members.role)
  );

-- ── Invite Codes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "invite_select" ON invite_codes;
CREATE POLICY "invite_select" ON invite_codes
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "invite_insert" ON invite_codes;
CREATE POLICY "invite_insert" ON invite_codes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "invite_update" ON invite_codes;
CREATE POLICY "invite_update" ON invite_codes
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "invite_delete" ON invite_codes;
CREATE POLICY "invite_delete" ON invite_codes
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Guests ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "guests_select" ON guests;
CREATE POLICY "guests_select" ON guests
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "guests_insert" ON guests;
CREATE POLICY "guests_insert" ON guests
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "guests_update" ON guests;
CREATE POLICY "guests_update" ON guests
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "guests_delete" ON guests;
CREATE POLICY "guests_delete" ON guests
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Begleitpersonen ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "begleit_select" ON begleitpersonen;
CREATE POLICY "begleit_select" ON begleitpersonen
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM guests g
      WHERE g.id = begleitpersonen.guest_id AND is_event_member(g.event_id))
  );

DROP POLICY IF EXISTS "begleit_insert" ON begleitpersonen;
CREATE POLICY "begleit_insert" ON begleitpersonen
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM guests g
      WHERE g.id = begleitpersonen.guest_id
        AND is_event_member(g.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(g.event_id))
  );

DROP POLICY IF EXISTS "begleit_update" ON begleitpersonen;
CREATE POLICY "begleit_update" ON begleitpersonen
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM guests g
      WHERE g.id = begleitpersonen.guest_id
        AND is_event_member(g.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(g.event_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM guests g
      WHERE g.id = begleitpersonen.guest_id
        AND is_event_member(g.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(g.event_id))
  );

DROP POLICY IF EXISTS "begleit_delete" ON begleitpersonen;
CREATE POLICY "begleit_delete" ON begleitpersonen
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM guests g
      WHERE g.id = begleitpersonen.guest_id
        AND is_event_member(g.event_id, ARRAY['veranstalter','brautpaar']::user_role[])
        AND NOT is_event_frozen(g.event_id))
  );

-- ── Hotels ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "hotels_select" ON hotels;
CREATE POLICY "hotels_select" ON hotels
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "hotels_insert" ON hotels;
CREATE POLICY "hotels_insert" ON hotels
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "hotels_update" ON hotels;
CREATE POLICY "hotels_update" ON hotels
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "hotels_delete" ON hotels;
CREATE POLICY "hotels_delete" ON hotels
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "hotel_rooms_select" ON hotel_rooms;
CREATE POLICY "hotel_rooms_select" ON hotel_rooms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM hotels h
      WHERE h.id = hotel_rooms.hotel_id AND is_event_member(h.event_id))
  );

DROP POLICY IF EXISTS "hotel_rooms_insert" ON hotel_rooms;
CREATE POLICY "hotel_rooms_insert" ON hotel_rooms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM hotels h
      WHERE h.id = hotel_rooms.hotel_id
        AND is_event_member(h.event_id, ARRAY['veranstalter','brautpaar']::user_role[])
        AND NOT is_event_frozen(h.event_id))
  );

DROP POLICY IF EXISTS "hotel_rooms_update" ON hotel_rooms;
CREATE POLICY "hotel_rooms_update" ON hotel_rooms
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM hotels h
      WHERE h.id = hotel_rooms.hotel_id
        AND is_event_member(h.event_id, ARRAY['veranstalter','brautpaar']::user_role[])
        AND NOT is_event_frozen(h.event_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM hotels h
      WHERE h.id = hotel_rooms.hotel_id
        AND is_event_member(h.event_id, ARRAY['veranstalter','brautpaar']::user_role[])
        AND NOT is_event_frozen(h.event_id))
  );

DROP POLICY IF EXISTS "hotel_rooms_delete" ON hotel_rooms;
CREATE POLICY "hotel_rooms_delete" ON hotel_rooms
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM hotels h
      WHERE h.id = hotel_rooms.hotel_id
        AND is_event_member(h.event_id, ARRAY['veranstalter','brautpaar']::user_role[]))
  );

-- ── Budget ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "budget_select" ON budget_items;
CREATE POLICY "budget_select" ON budget_items
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "budget_insert" ON budget_items;
CREATE POLICY "budget_insert" ON budget_items
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "budget_update" ON budget_items;
CREATE POLICY "budget_update" ON budget_items
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "budget_delete" ON budget_items;
CREATE POLICY "budget_delete" ON budget_items
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Vendors ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vendors_select" ON vendors;
CREATE POLICY "vendors_select" ON vendors
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "vendors_insert" ON vendors;
CREATE POLICY "vendors_insert" ON vendors
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "vendors_update" ON vendors;
CREATE POLICY "vendors_update" ON vendors
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "vendors_delete" ON vendors;
CREATE POLICY "vendors_delete" ON vendors
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

-- ── Tasks ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Reminders ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reminders_select" ON reminders;
CREATE POLICY "reminders_select" ON reminders
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "reminders_insert" ON reminders;
CREATE POLICY "reminders_insert" ON reminders
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "reminders_update" ON reminders;
CREATE POLICY "reminders_update" ON reminders
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

DROP POLICY IF EXISTS "reminders_delete" ON reminders;
CREATE POLICY "reminders_delete" ON reminders
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Sub-Events ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subevents_select" ON sub_events;
CREATE POLICY "subevents_select" ON sub_events
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "subevents_insert" ON sub_events;
CREATE POLICY "subevents_insert" ON sub_events
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "subevents_update" ON sub_events;
CREATE POLICY "subevents_update" ON sub_events
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "subevents_delete" ON sub_events;
CREATE POLICY "subevents_delete" ON sub_events
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "subevents_guests_select" ON sub_event_guests;
CREATE POLICY "subevents_guests_select" ON sub_event_guests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sub_events se
      WHERE se.id = sub_event_guests.sub_event_id AND is_event_member(se.event_id))
  );

DROP POLICY IF EXISTS "subevents_guests_insert" ON sub_event_guests;
CREATE POLICY "subevents_guests_insert" ON sub_event_guests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sub_events se
      WHERE se.id = sub_event_guests.sub_event_id
        AND is_event_member(se.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(se.event_id))
  );

DROP POLICY IF EXISTS "subevents_guests_delete" ON sub_event_guests;
CREATE POLICY "subevents_guests_delete" ON sub_event_guests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM sub_events se
      WHERE se.id = sub_event_guests.sub_event_id
        AND is_event_member(se.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(se.event_id))
  );

-- ── Seating ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "seating_select" ON seating_tables;
CREATE POLICY "seating_select" ON seating_tables
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "seating_insert" ON seating_tables;
CREATE POLICY "seating_insert" ON seating_tables
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "seating_update" ON seating_tables;
CREATE POLICY "seating_update" ON seating_tables
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "seating_delete" ON seating_tables;
CREATE POLICY "seating_delete" ON seating_tables
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "seating_assign_select" ON seating_assignments;
CREATE POLICY "seating_assign_select" ON seating_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM seating_tables st
      WHERE st.id = seating_assignments.table_id AND is_event_member(st.event_id))
  );

DROP POLICY IF EXISTS "seating_assign_insert" ON seating_assignments;
CREATE POLICY "seating_assign_insert" ON seating_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM seating_tables st
      WHERE st.id = seating_assignments.table_id
        AND is_event_member(st.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(st.event_id))
  );

DROP POLICY IF EXISTS "seating_assign_delete" ON seating_assignments;
CREATE POLICY "seating_assign_delete" ON seating_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM seating_tables st
      WHERE st.id = seating_assignments.table_id
        AND is_event_member(st.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
        AND NOT is_event_frozen(st.event_id))
  );

-- ── Catering ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "catering_select" ON catering_plans;
CREATE POLICY "catering_select" ON catering_plans
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','dienstleister']::user_role[])
  );

DROP POLICY IF EXISTS "catering_insert" ON catering_plans;
CREATE POLICY "catering_insert" ON catering_plans
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "catering_update" ON catering_plans;
CREATE POLICY "catering_update" ON catering_plans
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "catering_delete" ON catering_plans;
CREATE POLICY "catering_delete" ON catering_plans
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );

-- ── Feature Toggles ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ft_select" ON feature_toggles;
CREATE POLICY "ft_select" ON feature_toggles
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "ft_insert" ON feature_toggles;
CREATE POLICY "ft_insert" ON feature_toggles
  FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "ft_update" ON feature_toggles;
CREATE POLICY "ft_update" ON feature_toggles
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "ft_delete" ON feature_toggles;
CREATE POLICY "ft_delete" ON feature_toggles
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Organizer Suggestions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "org_vendor_select" ON organizer_vendor_suggestions;
CREATE POLICY "org_vendor_select" ON organizer_vendor_suggestions
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "org_vendor_insert" ON organizer_vendor_suggestions;
CREATE POLICY "org_vendor_insert" ON organizer_vendor_suggestions
  FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_vendor_update" ON organizer_vendor_suggestions;
CREATE POLICY "org_vendor_update" ON organizer_vendor_suggestions
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_vendor_delete" ON organizer_vendor_suggestions;
CREATE POLICY "org_vendor_delete" ON organizer_vendor_suggestions
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_hotel_select" ON organizer_hotel_suggestions;
CREATE POLICY "org_hotel_select" ON organizer_hotel_suggestions
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "org_hotel_insert" ON organizer_hotel_suggestions;
CREATE POLICY "org_hotel_insert" ON organizer_hotel_suggestions
  FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_hotel_update" ON organizer_hotel_suggestions;
CREATE POLICY "org_hotel_update" ON organizer_hotel_suggestions
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_hotel_delete" ON organizer_hotel_suggestions;
CREATE POLICY "org_hotel_delete" ON organizer_hotel_suggestions
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_cater_select" ON organizer_catering_suggestions;
CREATE POLICY "org_cater_select" ON organizer_catering_suggestions
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "org_cater_insert" ON organizer_catering_suggestions;
CREATE POLICY "org_cater_insert" ON organizer_catering_suggestions
  FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_cater_update" ON organizer_catering_suggestions;
CREATE POLICY "org_cater_update" ON organizer_catering_suggestions
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "org_cater_delete" ON organizer_catering_suggestions;
CREATE POLICY "org_cater_delete" ON organizer_catering_suggestions
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Deko ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "deko_sug_select" ON deko_suggestions;
CREATE POLICY "deko_sug_select" ON deko_suggestions
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "deko_sug_insert" ON deko_suggestions;
CREATE POLICY "deko_sug_insert" ON deko_suggestions
  FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "deko_sug_update" ON deko_suggestions;
CREATE POLICY "deko_sug_update" ON deko_suggestions
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "deko_sug_delete" ON deko_suggestions;
CREATE POLICY "deko_sug_delete" ON deko_suggestions
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "deko_wish_select" ON deko_wishes;
CREATE POLICY "deko_wish_select" ON deko_wishes
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  );

DROP POLICY IF EXISTS "deko_wish_insert" ON deko_wishes;
CREATE POLICY "deko_wish_insert" ON deko_wishes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  );

DROP POLICY IF EXISTS "deko_wish_update" ON deko_wishes;
CREATE POLICY "deko_wish_update" ON deko_wishes
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  )
  WITH CHECK (
    created_by = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "deko_wish_delete" ON deko_wishes;
CREATE POLICY "deko_wish_delete" ON deko_wishes
  FOR DELETE USING (
    created_by = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Location Images ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "loc_img_select" ON location_images;
CREATE POLICY "loc_img_select" ON location_images
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "loc_img_insert" ON location_images;
CREATE POLICY "loc_img_insert" ON location_images
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );

DROP POLICY IF EXISTS "loc_img_delete" ON location_images;
CREATE POLICY "loc_img_delete" ON location_images
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Guest Photos ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "guest_photos_select" ON guest_photos;
CREATE POLICY "guest_photos_select" ON guest_photos
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "guest_photos_insert" ON guest_photos;
CREATE POLICY "guest_photos_insert" ON guest_photos
  FOR INSERT WITH CHECK (is_event_member(event_id));

DROP POLICY IF EXISTS "guest_photos_delete" ON guest_photos;
CREATE POLICY "guest_photos_delete" ON guest_photos
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Timeline ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "timeline_select" ON timeline_entries;
CREATE POLICY "timeline_select" ON timeline_entries
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "timeline_insert" ON timeline_entries;
CREATE POLICY "timeline_insert" ON timeline_entries
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "timeline_update" ON timeline_entries;
CREATE POLICY "timeline_update" ON timeline_entries
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    AND NOT is_event_frozen(event_id)
  );

DROP POLICY IF EXISTS "timeline_delete" ON timeline_entries;
CREATE POLICY "timeline_delete" ON timeline_entries
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Dienstleister Profiles ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "dl_profile_select" ON dienstleister_profiles;
CREATE POLICY "dl_profile_select" ON dienstleister_profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "dl_profile_insert" ON dienstleister_profiles;
CREATE POLICY "dl_profile_insert" ON dienstleister_profiles
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "dl_profile_update" ON dienstleister_profiles;
CREATE POLICY "dl_profile_update" ON dienstleister_profiles
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM user_dienstleister ud
      WHERE ud.dienstleister_id = dienstleister_profiles.id AND ud.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_dienstleister ud
      WHERE ud.dienstleister_id = dienstleister_profiles.id AND ud.user_id = auth.uid())
  );

-- ── User Dienstleister ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ud_select" ON user_dienstleister;
CREATE POLICY "ud_select" ON user_dienstleister
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ud_insert" ON user_dienstleister;
CREATE POLICY "ud_insert" ON user_dienstleister
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ud_delete" ON user_dienstleister;
CREATE POLICY "ud_delete" ON user_dienstleister
  FOR DELETE USING (user_id = auth.uid());

-- ── Event Dienstleister ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ed_select" ON event_dienstleister;
CREATE POLICY "ed_select" ON event_dienstleister
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "ed_insert" ON event_dienstleister;
CREATE POLICY "ed_insert" ON event_dienstleister
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "ed_update" ON event_dienstleister;
CREATE POLICY "ed_update" ON event_dienstleister
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "ed_delete" ON event_dienstleister;
CREATE POLICY "ed_delete" ON event_dienstleister
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Trauzeuge Permissions ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tz_perm_select" ON trauzeuge_permissions;
CREATE POLICY "tz_perm_select" ON trauzeuge_permissions
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "tz_perm_insert" ON trauzeuge_permissions;
CREATE POLICY "tz_perm_insert" ON trauzeuge_permissions
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "tz_perm_update" ON trauzeuge_permissions;
CREATE POLICY "tz_perm_update" ON trauzeuge_permissions
  FOR UPDATE
  USING     (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

DROP POLICY IF EXISTS "tz_perm_delete" ON trauzeuge_permissions;
CREATE POLICY "tz_perm_delete" ON trauzeuge_permissions
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- ── Audit Log — nur lesbar, Writes via SECURITY DEFINER ──────────────────────
DROP POLICY IF EXISTS "audit_select" ON audit_log;
CREATE POLICY "audit_select" ON audit_log
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

-- ── Conversations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conv_select" ON conversations;
CREATE POLICY "conv_select" ON conversations
  FOR SELECT USING (
    is_event_member(event_id)
    AND (
      cardinality(participant_roles) = 0
      OR get_event_role(event_id) = ANY(participant_roles)
    )
  );

DROP POLICY IF EXISTS "conv_insert" ON conversations;
CREATE POLICY "conv_insert" ON conversations
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
  );

DROP POLICY IF EXISTS "conv_update" ON conversations;
CREATE POLICY "conv_update" ON conversations
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  )
  WITH CHECK (
    created_by = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );

-- ── Messages ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "msg_select" ON messages;
CREATE POLICY "msg_select" ON messages
  FOR SELECT USING (
    is_event_member(event_id)
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.event_id = messages.event_id
        AND (
          cardinality(c.participant_roles) = 0
          OR get_event_role(event_id) = ANY(c.participant_roles)
        )
    )
  );

DROP POLICY IF EXISTS "msg_insert" ON messages;
CREATE POLICY "msg_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_event_member(event_id)
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND c.event_id = messages.event_id
        AND (
          cardinality(c.participant_roles) = 0
          OR get_event_role(event_id) = ANY(c.participant_roles)
        )
    )
  );

DROP POLICY IF EXISTS "msg_update" ON messages;
CREATE POLICY "msg_update" ON messages
  FOR UPDATE
  USING     (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "msg_delete" ON messages;
CREATE POLICY "msg_delete" ON messages
  FOR DELETE USING (
    sender_id = auth.uid()
    OR is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );

-- ── Pending Changes ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pc_select" ON pending_changes;
CREATE POLICY "pc_select" ON pending_changes
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "pc_insert" ON pending_changes;
CREATE POLICY "pc_insert" ON pending_changes
  FOR INSERT WITH CHECK (
    proposed_by = auth.uid()
    AND is_event_member(event_id)
  );

DROP POLICY IF EXISTS "pc_update" ON pending_changes;
CREATE POLICY "pc_update" ON pending_changes
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  )
  WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS "pc_delete" ON pending_changes;
CREATE POLICY "pc_delete" ON pending_changes
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
  );


-- ════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;


-- ════════════════════════════════════════════════════════════════════════════
-- GRANTS — Least Privilege
-- ════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- anon: Minimum für unauthentifizierte Flows
GRANT EXECUTE ON FUNCTION public.get_invite_preview(TEXT) TO anon;

-- authenticated: volle CRUD — RLS schränkt weiter ein
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE
  ON ALL ROUTINES IN SCHEMA public TO authenticated;

-- service_role: uneingeschränkt
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

-- Default Privileges für zukünftige Objekte
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE                        ON ROUTINES  TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES  TO service_role;

-- RPC-Funktionen explizit absichern
REVOKE ALL    ON FUNCTION public.redeem_invite_code(TEXT)                              FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.create_invite_code(UUID, user_role, INTERVAL, JSONB)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invite_code(TEXT)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invite_code(UUID, user_role, INTERVAL, JSONB)  TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- Manuell im Dashboard anlegen: Storage → New bucket
--   • location-images  (private)
--   • deko-images      (private)
--   • guest-photos     (private)
-- ════════════════════════════════════════════════════════════════════════════

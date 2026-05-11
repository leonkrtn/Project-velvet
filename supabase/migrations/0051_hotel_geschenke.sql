-- 0051_hotel_geschenke.sql
-- Adds stars/website/notes to hotels, description to hotel_rooms,
-- and creates geschenk_wuensche + geschenk_beitraege tables.

-- ── Hotels: new metadata fields ───────────────────────────────────────────────
ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS stars   INTEGER CHECK (stars BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS notes   TEXT;

-- ── Hotel Rooms: description ──────────────────────────────────────────────────
ALTER TABLE hotel_rooms
  ADD COLUMN IF NOT EXISTS description TEXT;

-- ── Geschenk-Wünsche (wishlist) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geschenk_wuensche (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID         NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title            TEXT         NOT NULL,
  description      TEXT,
  price            NUMERIC(10,2),
  priority         TEXT         NOT NULL DEFAULT 'mittel'
                                CHECK (priority IN ('hoch', 'mittel', 'niedrig')),
  link             TEXT,
  is_money_wish    BOOLEAN      NOT NULL DEFAULT FALSE,
  money_target     NUMERIC(10,2),
  status           TEXT         NOT NULL DEFAULT 'verfuegbar'
                                CHECK (status IN ('verfuegbar', 'vergeben')),
  claimed_by_token TEXT,
  sort_order       INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── Geschenk-Beiträge (anonymous money contributions) ────────────────────────
CREATE TABLE IF NOT EXISTS geschenk_beitraege (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  wish_id      UUID          NOT NULL REFERENCES geschenk_wuensche(id) ON DELETE CASCADE,
  guest_token  TEXT          NOT NULL,
  amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (wish_id, guest_token)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE geschenk_wuensche  ENABLE ROW LEVEL SECURITY;
ALTER TABLE geschenk_beitraege ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_rooms         ENABLE ROW LEVEL SECURITY;

-- Wishlist: brautpaar + veranstalter full CRUD
DROP POLICY IF EXISTS "geschenk_wuensche_members" ON geschenk_wuensche;
CREATE POLICY "geschenk_wuensche_members" ON geschenk_wuensche
  FOR ALL USING (
    is_event_member(event_id, ARRAY['brautpaar','veranstalter']::user_role[])
  );

-- Beiträge: members can read (write happens via service-role RSVP API)
DROP POLICY IF EXISTS "geschenk_beitraege_members_read" ON geschenk_beitraege;
CREATE POLICY "geschenk_beitraege_members_read" ON geschenk_beitraege
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM geschenk_wuensche gw
      WHERE gw.id = wish_id
        AND is_event_member(gw.event_id, ARRAY['brautpaar','veranstalter']::user_role[])
    )
  );

-- Hotels: brautpaar + veranstalter full CRUD
DROP POLICY IF EXISTS "hotels_members" ON hotels;
CREATE POLICY "hotels_members" ON hotels
  FOR ALL USING (
    is_event_member(event_id, ARRAY['brautpaar','veranstalter']::user_role[])
  );

DROP POLICY IF EXISTS "hotel_rooms_members" ON hotel_rooms;
CREATE POLICY "hotel_rooms_members" ON hotel_rooms
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hotels h
      WHERE h.id = hotel_id
        AND is_event_member(h.event_id, ARRAY['brautpaar','veranstalter']::user_role[])
    )
  );

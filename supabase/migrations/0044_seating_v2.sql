-- 0044_seating_v2.sql
-- Replaces old seating_tables + seating_assignments with a new schema that
-- supports guests, begleitpersonen, and brautpaar (two slots).
-- Also adds table_pool JSONB to event_room_configs for the step-3 configurator.

-- ── Drop old tables ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS seating_assignments CASCADE;
DROP TABLE IF EXISTS seating_tables CASCADE;

-- ── seating_tables ─────────────────────────────────────────────────────────
CREATE TABLE seating_tables (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  shape         TEXT    NOT NULL DEFAULT 'rectangular'
                        CHECK (shape IN ('round', 'rectangular')),
  capacity      INT     NOT NULL DEFAULT 8 CHECK (capacity > 0),
  pos_x         NUMERIC NOT NULL DEFAULT 0,
  pos_y         NUMERIC NOT NULL DEFAULT 0,
  rotation      NUMERIC NOT NULL DEFAULT 0,
  -- For rectangular: length = longer side, width = shorter side
  -- For round: length = diameter (width is ignored)
  table_length  NUMERIC NOT NULL DEFAULT 2.0 CHECK (table_length > 0),
  table_width   NUMERIC NOT NULL DEFAULT 0.8 CHECK (table_width > 0),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_seating_tables_event ON seating_tables(event_id);

ALTER TABLE seating_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read seating_tables"
  ON seating_tables FOR SELECT
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

CREATE POLICY "veranstalter brautpaar insert seating_tables"
  ON seating_tables FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "veranstalter brautpaar update seating_tables"
  ON seating_tables FOR UPDATE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "veranstalter brautpaar delete seating_tables"
  ON seating_tables FOR DELETE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- ── seating_assignments ────────────────────────────────────────────────────
-- Exactly one of guest_id, begleitperson_id, or brautpaar_slot must be set.
-- Uniqueness indices ensure each person appears in at most one seat.
CREATE TABLE seating_assignments (
  id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id          UUID     NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE,
  event_id          UUID     NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id          UUID     REFERENCES guests(id) ON DELETE CASCADE,
  begleitperson_id  UUID     REFERENCES begleitpersonen(id) ON DELETE CASCADE,
  brautpaar_slot    SMALLINT CHECK (brautpaar_slot IN (1, 2)),
  CONSTRAINT exactly_one_person CHECK (
    (guest_id IS NOT NULL)::int +
    (begleitperson_id IS NOT NULL)::int +
    (brautpaar_slot IS NOT NULL)::int = 1
  )
);

-- Each person can only sit at one table per event
CREATE UNIQUE INDEX uq_seat_guest
  ON seating_assignments(event_id, guest_id)
  WHERE guest_id IS NOT NULL;

CREATE UNIQUE INDEX uq_seat_begleit
  ON seating_assignments(event_id, begleitperson_id)
  WHERE begleitperson_id IS NOT NULL;

CREATE UNIQUE INDEX uq_seat_brautpaar
  ON seating_assignments(event_id, brautpaar_slot)
  WHERE brautpaar_slot IS NOT NULL;

CREATE INDEX idx_seating_assignments_table ON seating_assignments(table_id);
CREATE INDEX idx_seating_assignments_event ON seating_assignments(event_id);

ALTER TABLE seating_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read seating_assignments"
  ON seating_assignments FOR SELECT
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[]));

CREATE POLICY "veranstalter brautpaar insert seating_assignments"
  ON seating_assignments FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "veranstalter brautpaar update seating_assignments"
  ON seating_assignments FOR UPDATE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

CREATE POLICY "veranstalter brautpaar delete seating_assignments"
  ON seating_assignments FOR DELETE
  USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- ── table_pool on event_room_configs ───────────────────────────────────────
-- Stores the pool of available table types (count + default dimensions).
-- Shape: { round: { count, diameter }, rect: { count, length, width } }
ALTER TABLE event_room_configs
  ADD COLUMN IF NOT EXISTS table_pool JSONB
  DEFAULT '{"round":{"count":0,"diameter":1.5},"rect":{"count":0,"length":2.0,"width":0.8}}';

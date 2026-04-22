-- Veranstalterkosten: flexible Kostenpositionen pro Event
-- Kein fester Spalten-Katalog — category ist ein freier Textstring (fix oder benutzerdefiniert)

CREATE TABLE event_organizer_costs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category    TEXT        NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX event_organizer_costs_event_id_idx ON event_organizer_costs(event_id);

-- RLS
ALTER TABLE event_organizer_costs ENABLE ROW LEVEL SECURITY;

-- Nur Veranstalter des zugehörigen Events dürfen lesen/schreiben
CREATE POLICY "veranstalter_select_costs" ON event_organizer_costs
  FOR SELECT USING (is_event_member(event_id, ARRAY['veranstalter']::text[]));

CREATE POLICY "veranstalter_insert_costs" ON event_organizer_costs
  FOR INSERT WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::text[]));

CREATE POLICY "veranstalter_update_costs" ON event_organizer_costs
  FOR UPDATE USING (is_event_member(event_id, ARRAY['veranstalter']::text[]));

CREATE POLICY "veranstalter_delete_costs" ON event_organizer_costs
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter']::text[]));

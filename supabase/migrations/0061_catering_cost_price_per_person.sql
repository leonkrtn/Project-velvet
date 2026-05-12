-- Kosten pro Person statt Gesamtbetrag
-- amount bleibt in DB (backward-compat), wird aber nicht mehr aus UI befüllt
ALTER TABLE event_organizer_costs
  ADD COLUMN IF NOT EXISTS price_per_person NUMERIC(10, 2) NOT NULL DEFAULT 0;

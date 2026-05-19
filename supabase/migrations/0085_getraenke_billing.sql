-- Add billing mode for beverages to catering_plans
-- 'honorar' = included in organizer fee (cost to organizer)
-- 'einzeln' = billed separately to couple (organizer earns BP-Preis − Kalkulation)

ALTER TABLE catering_plans
  ADD COLUMN IF NOT EXISTS getraenke_billing TEXT NOT NULL DEFAULT 'honorar'
  CHECK (getraenke_billing IN ('honorar', 'einzeln'));

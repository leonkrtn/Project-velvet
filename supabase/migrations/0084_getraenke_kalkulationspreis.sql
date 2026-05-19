-- Add internal cost price (Kalkulationspreis) to beverage items and cocktails
-- price_per_unit = customer-facing price (shown to Brautpaar)
-- kalkulationspreis = internal purchase/cost price for organizer calculation

ALTER TABLE getraenke_artikel
  ADD COLUMN IF NOT EXISTS kalkulationspreis NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE getraenke_cocktails
  ADD COLUMN IF NOT EXISTS kalkulationspreis NUMERIC(10,2) NOT NULL DEFAULT 0;

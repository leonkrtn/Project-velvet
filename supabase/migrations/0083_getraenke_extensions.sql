-- Add is_alcoholic to kategorien (default true for existing data)
ALTER TABLE getraenke_kategorien
  ADD COLUMN IF NOT EXISTS is_alcoholic BOOLEAN NOT NULL DEFAULT TRUE;

-- Add price_per_unit to cocktails for budget tracking
ALTER TABLE getraenke_cocktails
  ADD COLUMN IF NOT EXISTS price_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0;

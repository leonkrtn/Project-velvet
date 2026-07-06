-- 0135_review_photos_offer_budget.sql
-- (1) Bewertungs-Fotos: R2-Keys direkt an der Bewertung (Upload via Presigned PUT,
--     Anzeige via Presigned GET — Keys sind nie öffentlich).
ALTER TABLE marketplace_reviews
  ADD COLUMN IF NOT EXISTS photo_r2_keys TEXT[] NOT NULL DEFAULT '{}';

-- (2) Budget-Verknüpfung angenommener Angebote: budget_items.source_offer_id
--     verhindert doppelte Übernahme desselben Angebots ins Budget.
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS source_offer_id UUID REFERENCES vendor_offers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_items_source_offer
  ON budget_items(source_offer_id) WHERE source_offer_id IS NOT NULL;

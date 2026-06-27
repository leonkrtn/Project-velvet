-- ============================================================
-- Forevr Migration 0121 — Vendor Offer Variants (optional)
--
-- OPTIONALE Zusatzfunktion: Ein Angebot (vendor_offers) kann zusaetzlich mehrere
-- Varianten haben (z. B. „Gut / Besser / Premium"). Der Standardfall bleibt EIN
-- Angebot ohne Varianten — Varianten werden nur genutzt, wenn der Dienstleister
-- sie aktiv anlegt. Jede Variante hat eigene line_items + Summen; Steuer/Waehrung
-- werden vom Eltern-Angebot uebernommen. Das Brautpaar erhaelt pro Variante ein
-- eigenes PDF und nimmt genau EINE Variante an (is_selected + Kopie ins Angebot).
--
-- Schreiben ausschliesslich ueber Service-Role-APIs (WITH CHECK false), Lesen wie
-- beim Eltern-Angebot (Vendor immer; Brautpaar ab Status <> 'draft').
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_offer_variants (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id     UUID        NOT NULL REFERENCES vendor_offers(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL DEFAULT 'Variante',
  line_items   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  subtotal     NUMERIC     NOT NULL DEFAULT 0,
  tax_amount   NUMERIC     NOT NULL DEFAULT 0,
  total        NUMERIC     NOT NULL DEFAULT 0,
  sort_order   INT         NOT NULL DEFAULT 0,
  is_selected  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vov_offer ON vendor_offer_variants(offer_id);

ALTER TABLE vendor_offer_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vov_select" ON vendor_offer_variants;
CREATE POLICY "vov_select" ON vendor_offer_variants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM vendor_offers o
    WHERE o.id = offer_id AND (
      is_marketplace_vendor_user(o.dienstleister_id)
      OR (o.status <> 'draft'
          AND is_event_member(o.event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[]))
    )
  )
);

DROP POLICY IF EXISTS "vov_no_write" ON vendor_offer_variants;
CREATE POLICY "vov_no_write" ON vendor_offer_variants FOR INSERT WITH CHECK (false);

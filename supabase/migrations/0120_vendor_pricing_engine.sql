-- ============================================================
-- Forevr Migration 0120 — Vendor Pricing Engine
--
-- Erweitert den Dienstleister-Fragebogen (vendor_questionnaires) um eine
-- flexiblere Preislogik fuer Auto-Angebote:
--   • guest_tiers   — Mengenstaffeln auf die Gaestezahl (Pro-Gast-Preis je Stufe)
--   • season_rules  — Saison-/Datumsregeln (Auf-/Abschlag % oder Pauschale)
--   • travel_*      — Anfahrt/Reisekosten (PLZ-Zonen + km-Pauschale)
--   • consult_mode  — Beratungs-Modus: KEIN Auto-Angebot, stattdessen oeffnet die
--                     Anfrage einen Chat + Terminvorschlag (Erstgespraech).
--
-- Mengenstaffeln pro Frage liegen in vendor_questionnaire_questions.pricing
-- (JSONB, Schluessel `tiers`) — dafuer ist keine Schema-Aenderung noetig.
--
-- WICHTIG: alle neuen Felder sind Preisinformationen und duerfen NIE an das
-- Brautpaar gehen (stripPricing in lib/vendor/questionnaire.ts entfernt sie).
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE vendor_questionnaires
  -- [{ minGuests:int, maxGuests:int|null, perGuestPrice:number }]
  ADD COLUMN IF NOT EXISTS guest_tiers            JSONB   NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, label, from:'YYYY-MM-DD'|'MM-DD', to:'…', mode:'percent'|'flat', value:number }]
  ADD COLUMN IF NOT EXISTS season_rules           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  -- 'none' | 'zones' | 'km' | 'both'
  ADD COLUMN IF NOT EXISTS travel_mode            TEXT    NOT NULL DEFAULT 'none',
  -- [{ plzPrefix:'10', label:'Berlin', price:number }]
  ADD COLUMN IF NOT EXISTS travel_zones           JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS travel_km_price        NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_free_radius_km  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_base_postal_code TEXT   NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS consult_mode           BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE vendor_questionnaires
    ADD CONSTRAINT vq_travel_mode_chk CHECK (travel_mode IN ('none','zones','km','both'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN vendor_questionnaires.guest_tiers IS 'Mengenstaffeln Pro-Gast-Preis: [{minGuests,maxGuests|null,perGuestPrice}]';
COMMENT ON COLUMN vendor_questionnaires.season_rules IS 'Saison-/Datumsregeln: [{id,label,from,to,mode:percent|flat,value}]';
COMMENT ON COLUMN vendor_questionnaires.travel_mode IS 'Anfahrtskosten-Modus: none|zones|km|both';
COMMENT ON COLUMN vendor_questionnaires.consult_mode IS 'Beratungs-Modus: kein Auto-Angebot, Anfrage oeffnet Chat + Terminvorschlag';

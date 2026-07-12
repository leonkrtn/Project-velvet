-- ============================================================
-- Forevr Migration 0138 — Vendor E-Mail-Vorlagen (Brautpaar-Mails)
--
-- Anpassbare Vorlagen fuer die E-Mails, die Forevr im NAMEN des Dienstleisters
-- an das Brautpaar versendet. Genau drei Typen (template_key):
--   offer_released   — „Angebot freigegeben" (bei jeder Freigabe, lib/vendor/offer-notify.ts)
--   followup_offer   — „Offenes Angebot nachfassen" (Automatik, lib/vendor/automation-tick.ts)
--   review_request   — „Bewertung anfragen" (Automatik, lib/vendor/automation-tick.ts)
--
-- Fehlt eine Zeile, greift die eingebaute Standard-Vorlage (lib/vendor/email-templates.ts).
-- Anrede + Signatur werden ZENTRAL am Profil gepflegt und in allen drei Mails verwendet.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Zentrale Anrede + Signatur am Vendor-Profil ───────────────────────────
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS email_greeting  TEXT;
ALTER TABLE dienstleister_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- ── 2. Vorlagen-Tabelle (eine Zeile je Vendor + Typ) ─────────────────────────
CREATE TABLE IF NOT EXISTS vendor_email_templates (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  template_key     TEXT        NOT NULL,
  subject          TEXT        NOT NULL DEFAULT '',
  heading          TEXT        NOT NULL DEFAULT '',
  body             TEXT        NOT NULL DEFAULT '',
  cta_label        TEXT        NOT NULL DEFAULT '',
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dienstleister_id, template_key)
);

DO $$ BEGIN
  ALTER TABLE vendor_email_templates ADD CONSTRAINT vet_key_chk
    CHECK (template_key IN ('offer_released','followup_offer','review_request'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_vet_dl ON vendor_email_templates(dienstleister_id);

ALTER TABLE vendor_email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vet_own" ON vendor_email_templates;
CREATE POLICY "vet_own" ON vendor_email_templates FOR ALL TO authenticated
  USING (dienstleister_id IN (SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()))
  WITH CHECK (dienstleister_id IN (SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()));

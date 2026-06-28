-- ============================================================
-- Forevr Migration 0123 — Vendor Automations + Review Invites
--
-- Konfigurierbare Automatisierungen pro Dienstleister, taeglich ausgefuehrt vom
-- Scheduler-Tick (siehe lib/vendor/automation-tick.ts, aufgerufen von
-- /api/cron/tick; Verdrahtung via pg_cron in 0124).
--
--   vendor_automations      — Regeln (reminder | review_request | followup_offer | followup_lead)
--   vendor_automation_log   — Idempotenz: verhindert doppeltes Feuern
--   review_invites          — Token-basierte Bewertungseinladung (ohne Login)
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ── 1. Automatisierungs-Regeln ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_automations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  kind             TEXT        NOT NULL,
  event_type       TEXT        NOT NULL DEFAULT 'all',
  -- reminder: Tage VOR Event · review_request/followup_offer: Tage NACH Event/Freigabe
  -- followup_lead: Tage Inaktivitaet
  offset_days      INT         NOT NULL DEFAULT 0,
  label            TEXT        NOT NULL DEFAULT '',
  enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE vendor_automations ADD CONSTRAINT va_kind_chk
    CHECK (kind IN ('reminder','review_request','followup_offer','followup_lead'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_va_dl ON vendor_automations(dienstleister_id);

ALTER TABLE vendor_automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "va_own" ON vendor_automations;
CREATE POLICY "va_own" ON vendor_automations FOR ALL TO authenticated
  USING (dienstleister_id IN (SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()))
  WITH CHECK (dienstleister_id IN (SELECT dienstleister_id FROM user_dienstleister WHERE user_id = auth.uid()));

-- ── 2. Idempotenz-Log (nur Service-Role) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_automation_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL,
  kind             TEXT        NOT NULL,
  target_type      TEXT        NOT NULL,
  target_id        TEXT        NOT NULL,
  fire_key         TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dienstleister_id, kind, target_type, target_id, fire_key)
);
CREATE INDEX IF NOT EXISTS idx_val_dl ON vendor_automation_log(dienstleister_id);

ALTER TABLE vendor_automation_log ENABLE ROW LEVEL SECURITY;
-- keine Policy: nur Service-Role (Tick) schreibt/liest.

-- ── 3. Token-Bewertungseinladung (ohne Login) ────────────────────────────────
CREATE TABLE IF NOT EXISTS review_invites (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token            TEXT        NOT NULL UNIQUE,
  email            TEXT        NOT NULL DEFAULT '',
  status           TEXT        NOT NULL DEFAULT 'sent',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ri_dl ON review_invites(dienstleister_id);

DO $$ BEGIN
  ALTER TABLE review_invites ADD CONSTRAINT ri_status_chk CHECK (status IN ('sent','used'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE review_invites ENABLE ROW LEVEL SECURITY;
-- keine Policy: Zugriff nur ueber Service-Role-APIs (Token-Validierung serverseitig).

-- ── 4. marketplace_reviews: Token-Quelle erlauben ────────────────────────────
-- author_user_id darf bei Token-Bewertungen NULL sein (kein Login). Falls die
-- Spalte NOT NULL ist, lockern; ansonsten No-op.
DO $$ BEGIN
  ALTER TABLE marketplace_reviews ALTER COLUMN author_user_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL; WHEN others THEN NULL; END $$;

ALTER TABLE marketplace_reviews ADD COLUMN IF NOT EXISTS via_token BOOLEAN NOT NULL DEFAULT FALSE;

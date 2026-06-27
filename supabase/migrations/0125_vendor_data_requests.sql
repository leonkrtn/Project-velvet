-- ============================================================
-- Forevr Migration 0125 — Vendor Data Requests (A3)
--
-- Strukturierte Daten-Anfrage: Der Dienstleister fordert gezielt fehlende
-- Infos an (z. B. finale Gaestezahl, Anfahrtsadresse). Die Anfrage erscheint
-- zusaetzlich als Chat-Nachricht; die Antwort wird strukturiert gespeichert
-- UND als Chat-Nachricht gepostet ("Chat + strukturiert").
--
-- Zugriff ausschliesslich ueber Service-Role-APIs (die Auth/Mitgliedschaft
-- selbst pruefen) — daher RLS aktiv, aber ohne User-Policy.
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_data_requests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_id UUID        NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  conversation_id  UUID,
  -- [{ key, label, value }]
  fields           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT        NOT NULL DEFAULT 'open',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_vdr_event ON vendor_data_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_vdr_dl    ON vendor_data_requests(dienstleister_id);

DO $$ BEGIN
  ALTER TABLE vendor_data_requests ADD CONSTRAINT vdr_status_chk CHECK (status IN ('open','answered'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE vendor_data_requests ENABLE ROW LEVEL SECURITY;
-- keine User-Policy: Zugriff nur ueber Service-Role-APIs mit eigener Pruefung.

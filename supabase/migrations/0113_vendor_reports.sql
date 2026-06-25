-- Migration 0113: vendor_reports — Kunden können Anbieter melden
-- Jeder authentifizierte Nutzer kann einen Bericht einreichen.
-- Admins können Berichte einsehen und bearbeiten.

CREATE TABLE IF NOT EXISTS vendor_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  reason         TEXT NOT NULL CHECK (reason IN ('falsche_angaben', 'unangemessene_bilder', 'betrug', 'spam')),
  comment        TEXT,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  admin_note     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendor_reports ENABLE ROW LEVEL SECURITY;

-- Authentifizierte Nutzer können Meldungen einreichen
CREATE POLICY "auth_insert_vendor_reports"
  ON vendor_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Admins (service role) können alle Meldungen lesen und bearbeiten — via admin client
-- Normale Nutzer können ihre eigenen Meldungen lesen
CREATE POLICY "own_select_vendor_reports"
  ON vendor_reports FOR SELECT
  TO authenticated
  USING (reporter_user_id = auth.uid());

-- Update Trigger für updated_at
CREATE OR REPLACE FUNCTION update_vendor_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_vendor_reports_updated_at
  BEFORE UPDATE ON vendor_reports
  FOR EACH ROW EXECUTE FUNCTION update_vendor_reports_updated_at();

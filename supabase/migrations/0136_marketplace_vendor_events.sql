-- ============================================================
-- Forevr Migration 0136 — Marktplatz-Interaktions-Tracking pro Anbieter
--
-- Zaehlt Interaktionen mit einem Anbieter-Listing: Profilaufrufe, Klicks auf
-- Kontakt (E-Mail/Telefon), Website/Social und gestellte Anfragen. Rein
-- serverseitig gezaehlt (cookielos, ohne Personenbezug) -> keine Einwilligung
-- noetig. Auswertung im Admin-Panel (pro Anbieter + gesamt) und in der
-- Anbieter-Statistik.
--
-- RLS aktiv OHNE User-Policy: Schreiben/Lesen ausschliesslich ueber
-- Service-Role-APIs (Muster wie vendor_data_requests).
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS marketplace_vendor_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dienstleister_id UUID NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'profile_view', 'contact_email', 'contact_phone', 'website', 'social', 'request'
                   )),
  -- Optionaler Bezug (z. B. marketplace_requests.id bei 'request') + Zusatzinfo (z. B. Social-Plattform).
  ref_id           UUID,
  meta             JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mvevents_vendor_type_date
  ON marketplace_vendor_events (dienstleister_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mvevents_date
  ON marketplace_vendor_events (created_at DESC);

ALTER TABLE marketplace_vendor_events ENABLE ROW LEVEL SECURITY;
-- Keine User-Policies: Zugriff nur ueber Service-Role (Track-/Stats-APIs).

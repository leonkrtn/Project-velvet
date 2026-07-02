-- ============================================================
-- Forevr Migration 0132 — Opt-in: neue Marktplatz-Anfrage per E-Mail
--
-- Dienstleister koennen zusaetzlich zur Anzeige im Dashboard eine E-Mail
-- mit Excel-Anhang (alle Anfrage-Daten) erhalten, sobald ein Brautpaar eine
-- Marktplatz-Anfrage stellt (POST /api/marketplace/requests). Standardmaessig
-- deaktiviert — der Dienstleister schaltet es in /vendor/automatisierungen ein
-- (app/api/vendor/notifications/route.ts).
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE dienstleister_profiles
  ADD COLUMN IF NOT EXISTS notify_new_request_email BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0091: Gäste-Einladungs-Tracking + Sammel-Link (offene Selbstregistrierung)
--
-- 1. guests.invited_at      — Zeitpunkt, zu dem der Einladungslink geteilt/
--                             kopiert wurde (Status wechselt dabei in der App
--                             von 'angelegt' auf den bestehenden Enum-Wert
--                             'eingeladen').
-- 2. guests.pending_approval — Gäste, die sich selbst über den Sammel-Link
--                             registriert haben, erscheinen erst nach
--                             Bestätigung durch das Brautpaar als vollwertige
--                             Gäste (Bestätigungs-Schritt).
-- 3. events.open_invite_token/enabled — Sammel-Link pro Event. Der Token wird
--                             in der App generiert; die öffentliche
--                             Registrierung läuft über eine Service-Role-API
--                             (keine anon-RLS nötig).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS open_invite_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS open_invite_enabled BOOLEAN NOT NULL DEFAULT false;

-- Schneller Lookup des Events über den Sammel-Link-Token (öffentliche Route)
CREATE INDEX IF NOT EXISTS idx_events_open_invite_token
  ON events (open_invite_token)
  WHERE open_invite_token IS NOT NULL;

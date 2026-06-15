-- ============================================================
-- Forevr Migration 0101 — Anzeigeeinstellungen (Personalisierung)
-- Pro-Event personalisierbares Erscheinungsbild (Akzentfarbe,
-- Schrift, Form, Textur, Monogramm, Theme-Preset). Wird im
-- Brautpaar-Portal und auf den Gast-Seiten angewendet.
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS event_display_settings (
  event_id   UUID        PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  settings   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_display_settings ENABLE ROW LEVEL SECURITY;

-- Mitglieder mit Admin-Rechten dürfen lesen + schreiben
DROP POLICY IF EXISTS "eds_admin_all" ON event_display_settings;
CREATE POLICY "eds_admin_all" ON event_display_settings
  FOR ALL
  USING      (is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter','brautpaar','brautpaar_solo']::user_role[]));

-- Alle Event-Mitglieder dürfen die Einstellungen lesen (Theming gilt für alle Rollen)
DROP POLICY IF EXISTS "eds_member_select" ON event_display_settings;
CREATE POLICY "eds_member_select" ON event_display_settings
  FOR SELECT USING (is_event_member(event_id));
-- Gast-Seiten (RSVP/Einladung) lesen per service-role (token-basiert).

-- ─────────────────────────────────────────────────────────────────────────────
-- 0129: Sammel-Link (offene Gast-Selbstregistrierung) vollständig entfernen
--
-- Der Sammel-Link (ein einziger, allgemeiner Einladungslink für die
-- Selbstregistrierung mehrerer Gäste) wird durch die Hochzeitswebsite (RSVP)
-- ersetzt und ist nicht mehr Teil der App. Diese Migration entfernt die dafür
-- in 0091 angelegten Event-Spalten + den zugehörigen Index.
--
-- Hinweis: guests.pending_approval / guests.invited_at (ebenfalls aus 0091)
-- bleiben bestehen — invited_at wird weiterhin allgemein für das Versand-
-- Tracking persönlicher Einladungslinks verwendet. pending_approval wurde nur
-- vom Sammel-Link gesetzt und ist nun zwar funktionslos (immer false für neue
-- Gäste), bleibt aber als Spalte erhalten, um bestehende Datensätze nicht zu
-- verändern und das Risiko ungeprüfter Seiteneffekte zu vermeiden.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS idx_events_open_invite_token;

ALTER TABLE events
  DROP COLUMN IF EXISTS open_invite_token,
  DROP COLUMN IF EXISTS open_invite_enabled;

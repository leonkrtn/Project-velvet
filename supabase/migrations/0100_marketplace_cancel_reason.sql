-- ============================================================
-- Forevr Migration 0100 — Marktplatz: Begründung beim Beenden
-- Speichert den Grund, wenn eine bereits angenommene Anfrage vom
-- Brautpaar beendet wird ("Zusammenarbeit beenden").
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE marketplace_requests ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

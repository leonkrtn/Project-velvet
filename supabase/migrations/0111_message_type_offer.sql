-- ============================================================
-- Forevr Migration 0111 — Chat-Nachrichtentyp 'offer'
--
-- Erlaubt es, ein freigegebenes Angebot (vendor_offers) als eigene
-- Chat-Nachricht zu posten. Die Bubble rendert eine Angebots-Karte; das
-- Brautpaar nimmt das Angebot final direkt aus dem Chat an.
-- metadata: { request_id, offer_id, total, currency, vendor_name }
-- Idempotent — safe to re-run.
-- ============================================================

-- Die CHECK-Constraint aus 0105 (text|file|data_share) um 'offer' erweitern.
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'file', 'data_share', 'offer'));

-- ════════════════════════════════════════════════════════════════════════════
-- 0052_brautpaar_gaeste_columns.sql
-- Adds columns required by the brautpaar guest portal.
-- Run manually in Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. guests: attending + plus_one_allowed ──────────────────────────────────
-- The portal uses 'attending' (ja/nein/ausstehend) instead of the legacy
-- guest_status_enum stored in 'status'.
ALTER TABLE guests ADD COLUMN IF NOT EXISTS attending TEXT NOT NULL DEFAULT 'ausstehend';
ALTER TABLE guests ADD COLUMN IF NOT EXISTS plus_one_allowed BOOLEAN NOT NULL DEFAULT false;

-- Populate attending from existing status values
UPDATE guests
SET attending = CASE
  WHEN status = 'zugesagt'  THEN 'ja'
  WHEN status = 'abgesagt'  THEN 'nein'
  ELSE 'ausstehend'
END
WHERE attending = 'ausstehend';


-- ── 2. hotel_rooms: room_number + max_occupancy ──────────────────────────────
ALTER TABLE hotel_rooms ADD COLUMN IF NOT EXISTS room_number TEXT;
ALTER TABLE hotel_rooms ADD COLUMN IF NOT EXISTS max_occupancy INT NOT NULL DEFAULT 2;

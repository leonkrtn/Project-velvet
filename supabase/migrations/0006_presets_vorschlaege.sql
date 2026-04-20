ALTER TABLE organizer_presets
  DROP COLUMN IF EXISTS venue_address,
  ADD COLUMN IF NOT EXISTS hotel_notes       TEXT,
  ADD COLUMN IF NOT EXISTS dienstleister_notes TEXT,
  ADD COLUMN IF NOT EXISTS deko_notes        TEXT;

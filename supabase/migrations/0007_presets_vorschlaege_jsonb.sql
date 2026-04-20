ALTER TABLE organizer_presets
  DROP COLUMN IF EXISTS hotel_notes,
  DROP COLUMN IF EXISTS dienstleister_notes,
  DROP COLUMN IF EXISTS deko_notes,
  ADD COLUMN IF NOT EXISTS preset_vendors JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS preset_hotels  JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS preset_deko    JSONB DEFAULT '[]';

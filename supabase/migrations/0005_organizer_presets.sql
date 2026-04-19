-- Organizer presets: default values auto-filled when creating a new event
CREATE TABLE IF NOT EXISTS organizer_presets (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  venue               TEXT,
  venue_address       TEXT,
  location_name       TEXT,
  location_street     TEXT,
  location_zip        TEXT,
  location_city       TEXT,
  location_website    TEXT,
  dresscode           TEXT,
  children_allowed    BOOLEAN     DEFAULT true,
  children_note       TEXT,
  max_begleitpersonen INT         DEFAULT 2,
  meal_options        TEXT[]      DEFAULT '{fleisch,fisch,vegetarisch,vegan}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organizer_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_presets_self"
  ON organizer_presets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Extend catering_plans with new fields for the organizer catering page
ALTER TABLE catering_plans
  ADD COLUMN IF NOT EXISTS sektempfang              BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sektempfang_note         TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS weinbegleitung           BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS weinbegleitung_note      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS kinder_meal_options      TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS menu_courses             JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS plan_guest_count_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_guest_count         INTEGER DEFAULT 0;

-- Mark organizer costs by source so catering costs can be managed separately
ALTER TABLE event_organizer_costs
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'allgemein';

-- Existing rows keep source = 'allgemein'
UPDATE event_organizer_costs SET source = 'allgemein' WHERE source IS NULL;

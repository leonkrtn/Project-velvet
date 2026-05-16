-- Migration 0075: Multi-day ablaufplan support
-- Adds ablaufplan_days table for per-day configuration (name, start/end hour)
-- Adds day_index to timeline_entries to associate entries with a specific day

-- Day configuration table
CREATE TABLE IF NOT EXISTS ablaufplan_days (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day_index   INT         NOT NULL DEFAULT 0,
  name        TEXT        NOT NULL DEFAULT 'Tag 1',
  start_hour  INT         NOT NULL DEFAULT 7,   -- 7  = 07:00
  end_hour    INT         NOT NULL DEFAULT 25,  -- 25 = 01:00 next day
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, day_index)
);

-- Add day_index to existing timeline_entries (default 0 = Tag 1)
ALTER TABLE timeline_entries
  ADD COLUMN IF NOT EXISTS day_index INT NOT NULL DEFAULT 0;

-- RLS
ALTER TABLE ablaufplan_days ENABLE ROW LEVEL SECURITY;

-- Veranstalter: full CRUD
CREATE POLICY "ablaufplan_days_veranstalter_all" ON ablaufplan_days
  FOR ALL
  USING  (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- Brautpaar: SELECT
CREATE POLICY "ablaufplan_days_brautpaar_select" ON ablaufplan_days
  FOR SELECT
  USING (is_event_member(event_id, ARRAY['brautpaar', 'trauzeuge']::user_role[]));

-- Brautpaar: INSERT
CREATE POLICY "ablaufplan_days_brautpaar_insert" ON ablaufplan_days
  FOR INSERT
  WITH CHECK (is_event_member(event_id, ARRAY['brautpaar']::user_role[]));

-- Brautpaar: UPDATE
CREATE POLICY "ablaufplan_days_brautpaar_update" ON ablaufplan_days
  FOR UPDATE
  USING  (is_event_member(event_id, ARRAY['brautpaar']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['brautpaar']::user_role[]));

-- Dienstleister: read-only if tab access granted
CREATE POLICY "ablaufplan_days_dl_select" ON ablaufplan_days
  FOR SELECT
  USING (dl_has_tab_access(event_id, 'ablaufplan', 'read'));

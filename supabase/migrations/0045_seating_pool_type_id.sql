-- 0045_seating_pool_type_id.sql
-- Adds pool_type_id to seating_tables so each placed table can reference
-- its source type in the event_room_configs.table_pool JSON array.
-- Also updates the table_pool default to the new multi-type array format.

ALTER TABLE seating_tables
  ADD COLUMN IF NOT EXISTS pool_type_id TEXT;

-- Update the default for new event_room_configs rows to the new array format.
-- Existing rows keep their old value (JSONB, so both formats coexist until
-- the configurator saves a new value).
ALTER TABLE event_room_configs
  ALTER COLUMN table_pool SET DEFAULT '{"types":[]}';

-- 0056_fix_guests_arrival_time.sql
-- arrival_time was TIMESTAMPTZ but RSVP stores it as a plain time string ("23:48").
-- Change to TEXT so the column accepts time strings directly.
-- Existing data was never written correctly (always errored), so all rows are NULL.

ALTER TABLE guests DROP COLUMN IF EXISTS arrival_time;
ALTER TABLE guests ADD COLUMN arrival_time TEXT;

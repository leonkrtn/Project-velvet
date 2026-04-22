-- 0018_staff_hourly_rate.sql
-- Stundenlohn auf organizer_staff für Kostenplanung in der Personalplanung

ALTER TABLE organizer_staff ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;

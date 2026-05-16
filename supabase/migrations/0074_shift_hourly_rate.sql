-- Add per-shift hourly rate override to personalplanung_shifts.
-- If NULL, falls back to organizer_staff.hourly_rate for cost calculations.
ALTER TABLE personalplanung_shifts
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10, 2);

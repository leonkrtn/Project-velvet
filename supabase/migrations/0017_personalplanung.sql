-- 0017_personalplanung.sql
-- Personalplanung: neue Felder auf organizer_staff + 3 Planungs-Tabellen

-- Neue Felder auf organizer_staff
ALTER TABLE organizer_staff ADD COLUMN IF NOT EXISTS role_category TEXT;
ALTER TABLE organizer_staff ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT '{}';

-- Planungstage pro Event (manuell vom Veranstalter angelegt)
CREATE TABLE IF NOT EXISTS personalplanung_days (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label      TEXT NOT NULL DEFAULT 'Tag',
  date       TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Einteilung: welcher Mitarbeiter arbeitet an welchem Tag?
-- Zeile vorhanden = arbeitet; keine Zeile = nicht eingeteilt
CREATE TABLE IF NOT EXISTS personalplanung_assignments (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id   UUID NOT NULL REFERENCES personalplanung_days(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES organizer_staff(id) ON DELETE CASCADE,
  UNIQUE(day_id, staff_id)
);

-- Schichten: Zeitblock für einen Mitarbeiter an einem Tag
CREATE TABLE IF NOT EXISTS personalplanung_shifts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id     UUID NOT NULL REFERENCES personalplanung_days(id) ON DELETE CASCADE,
  staff_id   UUID NOT NULL REFERENCES organizer_staff(id) ON DELETE CASCADE,
  task       TEXT NOT NULL DEFAULT 'Schicht',
  start_hour NUMERIC NOT NULL,
  end_hour   NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE personalplanung_days        ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalplanung_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalplanung_shifts      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_days_select" ON personalplanung_days;
CREATE POLICY "pp_days_select" ON personalplanung_days
  FOR SELECT USING (is_event_member(event_id));

DROP POLICY IF EXISTS "pp_days_write" ON personalplanung_days;
CREATE POLICY "pp_days_write" ON personalplanung_days
  FOR ALL USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

DROP POLICY IF EXISTS "pp_assign_select" ON personalplanung_assignments;
CREATE POLICY "pp_assign_select" ON personalplanung_assignments
  FOR SELECT USING (
    day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id))
  );

DROP POLICY IF EXISTS "pp_assign_write" ON personalplanung_assignments;
CREATE POLICY "pp_assign_write" ON personalplanung_assignments
  FOR ALL USING (
    day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  );

DROP POLICY IF EXISTS "pp_shifts_select" ON personalplanung_shifts;
CREATE POLICY "pp_shifts_select" ON personalplanung_shifts
  FOR SELECT USING (
    day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id))
  );

DROP POLICY IF EXISTS "pp_shifts_write" ON personalplanung_shifts;
CREATE POLICY "pp_shifts_write" ON personalplanung_shifts
  FOR ALL USING (
    day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  );

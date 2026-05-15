-- 0071_mitarbeiter_auth.sql
-- Mitarbeiter portal: auth link, Vertretungsplan backup field, and shift swap requests.

-- organizer_staff: link to Supabase auth + forced password change flag
ALTER TABLE organizer_staff
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

-- personalplanung_shifts: Vertreter (backup person per shift)
ALTER TABLE personalplanung_shifts
  ADD COLUMN IF NOT EXISTS backup_staff_id UUID REFERENCES organizer_staff(id) ON DELETE SET NULL;

-- Shift swap requests
CREATE TABLE IF NOT EXISTS personalplanung_shift_swaps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id       UUID NOT NULL REFERENCES personalplanung_shifts(id) ON DELETE CASCADE,
  from_staff_id  UUID NOT NULL REFERENCES organizer_staff(id),
  to_staff_id    UUID REFERENCES organizer_staff(id),   -- NULL = open to anyone
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id   UUID NOT NULL REFERENCES auth.users(id),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','approved','rejected','cancelled')),
  notes          TEXT,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at   TIMESTAMPTZ,
  approved_at    TIMESTAMPTZ
);
ALTER TABLE personalplanung_shift_swaps ENABLE ROW LEVEL SECURITY;

-- Helper: is the current auth user linked to this organizer_staff record?
CREATE OR REPLACE FUNCTION is_own_staff_member(p_staff_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM organizer_staff WHERE id = p_staff_id AND auth_user_id = auth.uid())
$$;

-- Update personalplanung RLS to allow staff members to read their own data

-- pp_days_select: nur organizer-check — staff nutzt admin client, braucht kein RLS
-- (kein subquery auf personalplanung_assignments, verhindert zirkuläre RLS-Abhängigkeit)
DROP POLICY IF EXISTS "pp_days_select"   ON personalplanung_days;
CREATE POLICY "pp_days_select" ON personalplanung_days FOR SELECT
  USING (is_event_member(event_id));

-- pp_assign_select: organizer via days (kein circular ref da pp_days_select simpel ist),
-- oder der Mitarbeiter selbst
DROP POLICY IF EXISTS "pp_assign_select" ON personalplanung_assignments;
CREATE POLICY "pp_assign_select" ON personalplanung_assignments FOR SELECT
  USING (
    day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id))
    OR staff_id IN (SELECT id FROM organizer_staff WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pp_shifts_select" ON personalplanung_shifts;
CREATE POLICY "pp_shifts_select" ON personalplanung_shifts FOR SELECT
  USING (
    day_id IN (SELECT id FROM personalplanung_days WHERE is_event_member(event_id))
    OR is_own_staff_member(staff_id)
  );

-- organizer_staff: staff members can read their own record
DROP POLICY IF EXISTS "staff_own_select" ON organizer_staff;
CREATE POLICY "staff_own_select" ON organizer_staff
  FOR SELECT USING (organizer_id = auth.uid() OR auth_user_id = auth.uid());

-- Swap RLS
CREATE POLICY "swaps_select" ON personalplanung_shift_swaps FOR SELECT
  USING (
    organizer_id = auth.uid()
    OR from_staff_id IN (SELECT id FROM organizer_staff WHERE auth_user_id = auth.uid())
    OR to_staff_id   IN (SELECT id FROM organizer_staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "swaps_insert" ON personalplanung_shift_swaps FOR INSERT
  WITH CHECK (
    from_staff_id IN (SELECT id FROM organizer_staff WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "swaps_update" ON personalplanung_shift_swaps FOR UPDATE
  USING (
    organizer_id = auth.uid()
    OR from_staff_id IN (SELECT id FROM organizer_staff WHERE auth_user_id = auth.uid())
    OR to_staff_id   IN (SELECT id FROM organizer_staff WHERE auth_user_id = auth.uid())
  );

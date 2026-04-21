-- 0016_organizer_staff.sql
-- Mitarbeiter des Veranstalters — gehören zu einem Veranstalter (organizer_id → profiles)

CREATE TABLE IF NOT EXISTS organizer_staff (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  responsibilities TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE organizer_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizer_staff_select" ON organizer_staff;
CREATE POLICY "organizer_staff_select"
  ON organizer_staff FOR SELECT
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "organizer_staff_insert" ON organizer_staff;
CREATE POLICY "organizer_staff_insert"
  ON organizer_staff FOR INSERT
  WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "organizer_staff_update" ON organizer_staff;
CREATE POLICY "organizer_staff_update"
  ON organizer_staff FOR UPDATE
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "organizer_staff_delete" ON organizer_staff;
CREATE POLICY "organizer_staff_delete"
  ON organizer_staff FOR DELETE
  USING (organizer_id = auth.uid());

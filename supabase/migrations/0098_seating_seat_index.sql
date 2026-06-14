-- 0098_seating_seat_index.sql
-- Genaue Sitzordnung: Position pro Person an einem Tisch (0-basiert).
-- Erlaubt das Anzeigen einzelner Sitz-Kreise um den Tisch und das Vertauschen
-- zweier Personen (Tausch der seat_index-Werte). NULL = noch nicht positioniert.

ALTER TABLE public.seating_assignments
  ADD COLUMN IF NOT EXISTS seat_index INT;

COMMENT ON COLUMN public.seating_assignments.seat_index IS
  'Sitzposition am Tisch (0-basiert). Tausch = Austausch der seat_index zweier Zuweisungen am selben Tisch.';

-- Vendors with catering read access need guest data for meal counts and allergy stats.
-- Previously only gaesteliste and sitzplan vendors could read guests.

DROP POLICY IF EXISTS "guests_dl_catering_select" ON guests;
CREATE POLICY "guests_dl_catering_select" ON guests
  FOR SELECT USING (dl_has_tab_access(event_id, 'catering', 'read'));

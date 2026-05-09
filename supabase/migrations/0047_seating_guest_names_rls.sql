-- 0047_seating_guest_names_rls.sql
-- Vendors with sitzplan read access need to resolve guest/begleitperson names
-- in the seating view, independent of whether they have gaesteliste access.

-- ── guests ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "guests_dl_sitzplan_select" ON guests;
CREATE POLICY "guests_dl_sitzplan_select" ON guests
  FOR SELECT USING (dl_has_tab_access(event_id, 'sitzplan', 'read'));

-- ── begleitpersonen ───────────────────────────────────────────────────────────
-- No event_id column — resolve via the parent guest row.

DROP POLICY IF EXISTS "begleit_dl_sitzplan_select" ON begleitpersonen;
CREATE POLICY "begleit_dl_sitzplan_select" ON begleitpersonen
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guests g
      WHERE g.id = begleitpersonen.guest_id
        AND dl_has_tab_access(g.event_id, 'sitzplan', 'read')
    )
  );

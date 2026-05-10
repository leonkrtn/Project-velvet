-- 0046_seating_dienstleister_rls.sql
-- Grants Dienstleister read access to seating-related tables when they
-- have 'sitzplan' tab permission (read or write) for the event.
--
-- Root cause: migration 0044 created seating_tables/seating_assignments with
-- policies restricted to veranstalter/brautpaar/trauzeuge only, and
-- 0038_room_config restricted event_room_configs to veranstalter and
-- organizer_room_configs to the owner — all blocking vendor read access.

-- ── seating_tables ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "seating_tables_dl_select" ON seating_tables;
CREATE POLICY "seating_tables_dl_select"
  ON seating_tables FOR SELECT
  USING (dl_has_tab_access(event_id, 'sitzplan', 'read'));

-- ── seating_assignments ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "seating_assignments_dl_select" ON seating_assignments;
CREATE POLICY "seating_assignments_dl_select"
  ON seating_assignments FOR SELECT
  USING (dl_has_tab_access(event_id, 'sitzplan', 'read'));

-- ── event_room_configs ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "event_room_configs_dl_select" ON event_room_configs;
CREATE POLICY "event_room_configs_dl_select"
  ON event_room_configs FOR SELECT
  USING (dl_has_tab_access(event_id, 'sitzplan', 'read'));

-- ── organizer_room_configs ────────────────────────────────────────────────────
-- No direct event_id column — resolve via events.created_by.

DROP POLICY IF EXISTS "organizer_room_configs_dl_select" ON organizer_room_configs;
CREATE POLICY "organizer_room_configs_dl_select"
  ON organizer_room_configs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.created_by = organizer_room_configs.user_id
        AND dl_has_tab_access(e.id, 'sitzplan', 'read')
    )
  );

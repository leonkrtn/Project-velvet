-- RLS helper: check if current Dienstleister has at least the given access level on a tab
CREATE OR REPLACE FUNCTION dl_has_tab_access(
  p_event_id UUID,
  p_tab_key  TEXT,
  p_min_access TEXT DEFAULT 'read'
) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dienstleister_permissions
    WHERE event_id              = p_event_id
      AND dienstleister_user_id = auth.uid()
      AND tab_key               = p_tab_key
      AND item_id               IS NULL
      AND (
        (p_min_access = 'read'  AND access IN ('read', 'write'))
        OR (p_min_access = 'write' AND access = 'write')
      )
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- catering_plans: Dienstleister SELECT + INSERT/UPDATE with write access
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "catering_select" ON catering_plans;
CREATE POLICY "catering_select" ON catering_plans
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'catering', 'read')
  );

DROP POLICY IF EXISTS "catering_dl_write" ON catering_plans;
CREATE POLICY "catering_dl_write" ON catering_plans
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'catering', 'write')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- musik_songs: Dienstleister read + write
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "musiksong_select" ON musik_songs;
CREATE POLICY "musiksong_select" ON musik_songs
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'musik', 'read')
  );

DROP POLICY IF EXISTS "musiksong_veranstalter" ON musik_songs;
DROP POLICY IF EXISTS "musiksong_dl_write" ON musik_songs;
CREATE POLICY "musiksong_dl_write" ON musik_songs
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[])
    OR dl_has_tab_access(event_id, 'musik', 'write')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- decor_setup_items + deko_wishes: Dienstleister read + write
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "decorset_veranstalter" ON decor_setup_items;
DROP POLICY IF EXISTS "decorset_vendor_select" ON decor_setup_items;
DROP POLICY IF EXISTS "decorset_select" ON decor_setup_items;
DROP POLICY IF EXISTS "decorset_dl_write" ON decor_setup_items;

CREATE POLICY "decorset_select" ON decor_setup_items
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'dekoration', 'read')
  );
CREATE POLICY "decorset_dl_write" ON decor_setup_items
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'dekoration', 'write')
  );

DROP POLICY IF EXISTS "deko_wishes_vendor_update" ON deko_wishes;
DROP POLICY IF EXISTS "dekowish_select" ON deko_wishes;
DROP POLICY IF EXISTS "dekowish_dl_write" ON deko_wishes;

CREATE POLICY "dekowish_select" ON deko_wishes
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'dekoration', 'read')
  );
CREATE POLICY "dekowish_dl_write" ON deko_wishes
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'dekoration', 'write')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- media_shot_items: Dienstleister read + write
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "mediash_veranstalter" ON media_shot_items;
DROP POLICY IF EXISTS "mediash_vendor_select" ON media_shot_items;
DROP POLICY IF EXISTS "mediash_select" ON media_shot_items;
DROP POLICY IF EXISTS "mediash_dl_write" ON media_shot_items;

CREATE POLICY "mediash_select" ON media_shot_items
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'medien', 'read')
  );
CREATE POLICY "mediash_dl_write" ON media_shot_items
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'medien', 'write')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- timeline_items: Dienstleister read + write
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "timeline_select" ON timeline_items;
DROP POLICY IF EXISTS "timeline_dl_write" ON timeline_items;

CREATE POLICY "timeline_select" ON timeline_items
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'ablaufplan', 'read')
  );
CREATE POLICY "timeline_dl_write" ON timeline_items
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'ablaufplan', 'write')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- seating_tables + seating_assignments: Dienstleister read + write
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "seating_select" ON seating_tables;
DROP POLICY IF EXISTS "seating_dl_write" ON seating_tables;

CREATE POLICY "seating_select" ON seating_tables
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'sitzplan', 'read')
  );
CREATE POLICY "seating_dl_write" ON seating_tables
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'sitzplan', 'write')
  );

-- seating_assignments
DROP POLICY IF EXISTS "seat_assign_select" ON seating_assignments;
DROP POLICY IF EXISTS "seat_assign_dl_write" ON seating_assignments;

CREATE POLICY "seat_assign_select" ON seating_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM seating_tables st WHERE st.id = seating_assignments.table_id
      AND (is_event_member(st.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
           OR dl_has_tab_access(st.event_id, 'sitzplan', 'read')))
  );
CREATE POLICY "seat_assign_dl_write" ON seating_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM seating_tables st WHERE st.id = seating_assignments.table_id
      AND (is_event_member(st.event_id, ARRAY['veranstalter']::user_role[])
           OR dl_has_tab_access(st.event_id, 'sitzplan', 'write')))
  );

-- ═══════════════════════════════════════════════════════════════════════
-- guests: Dienstleister read (via gaesteliste tab)
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "guests_dl_select" ON guests;
CREATE POLICY "guests_dl_select" ON guests
  FOR SELECT USING (
    dl_has_tab_access(event_id, 'gaesteliste', 'read')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- location_details: Dienstleister read via allgemein tab
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "locdet_dl_select" ON location_details;
CREATE POLICY "locdet_dl_select" ON location_details
  FOR SELECT USING (
    dl_has_tab_access(event_id, 'allgemein', 'read')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- patisserie_orders: Dienstleister read + write
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "patisserie_dl_select" ON patisserie_orders;
DROP POLICY IF EXISTS "patisserie_dl_write" ON patisserie_orders;

CREATE POLICY "patisserie_dl_select" ON patisserie_orders
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'patisserie', 'read')
  );
CREATE POLICY "patisserie_dl_write" ON patisserie_orders
  FOR ALL USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
    OR dl_has_tab_access(event_id, 'patisserie', 'write')
  );

-- ═══════════════════════════════════════════════════════════════════════
-- events: Dienstleister SELECT for basic info (needed by allgemein, uebersicht, catering)
-- Already handled by existing policies, but ensure DL with any tab access can read event basics
-- ═══════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "events_dl_select" ON events;
CREATE POLICY "events_dl_select" ON events
  FOR SELECT USING (
    is_event_member(id, ARRAY['dienstleister']::user_role[])
  );

-- conversations + messages: use new permission system
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR dl_has_tab_access(event_id, 'chats', 'read')
  );

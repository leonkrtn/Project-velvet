-- Unified permission table for Dienstleister: replaces string-based permissions + dienstleister_item_permissions
-- tab_key: 'uebersicht' | 'allgemein' | 'catering' | 'chats' | 'vorschlaege' | 'ablaufplan'
--         | 'musik' | 'patisserie' | 'dekoration' | 'medien' | 'sitzplan'
-- item_id: NULL = tab-level permission; non-NULL = item-level override (inherits tab-level if missing)
-- access:  'none' | 'read' | 'write'

CREATE TABLE IF NOT EXISTS dienstleister_permissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tab_key               TEXT NOT NULL,
  item_id               TEXT DEFAULT NULL,
  access                TEXT NOT NULL DEFAULT 'none' CHECK (access IN ('none', 'read', 'write')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (event_id, dienstleister_user_id, tab_key, item_id)
);

ALTER TABLE dienstleister_permissions ENABLE ROW LEVEL SECURITY;

-- Veranstalter: full CRUD for their events
CREATE POLICY "veranstalter_manage_dienstleister_permissions"
  ON dienstleister_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM event_members
      WHERE event_members.event_id = dienstleister_permissions.event_id
        AND event_members.user_id  = auth.uid()
        AND event_members.role     = 'veranstalter'
    )
  );

-- Dienstleister: read own permissions only
CREATE POLICY "dienstleister_read_own_permissions"
  ON dienstleister_permissions
  FOR SELECT
  USING (dienstleister_user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_dienstleister_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dienstleister_permissions_updated_at
  BEFORE UPDATE ON dienstleister_permissions
  FOR EACH ROW EXECUTE FUNCTION update_dienstleister_permissions_updated_at();

-- Migrate existing permissions from old string-based system
-- Maps mod_X strings → tab_key + access level
INSERT INTO dienstleister_permissions (event_id, dienstleister_user_id, tab_key, item_id, access)
SELECT event_id, user_id, tab_key, NULL, access
FROM (
  SELECT
    p.event_id,
    p.user_id,
    CASE p.permission
      WHEN 'mod_chat'            THEN 'chats'
      WHEN 'mod_timeline'        THEN 'ablaufplan'
      WHEN 'mod_timeline_read'   THEN 'ablaufplan'
      WHEN 'mod_seating'         THEN 'sitzplan'
      WHEN 'mod_seating_read'    THEN 'sitzplan'
      WHEN 'mod_catering'        THEN 'catering'
      WHEN 'mod_catering_read'   THEN 'catering'
      WHEN 'mod_music'           THEN 'musik'
      WHEN 'mod_music_read'      THEN 'musik'
      WHEN 'mod_patisserie'      THEN 'patisserie'
      WHEN 'mod_patisserie_read' THEN 'patisserie'
      WHEN 'mod_decor'           THEN 'dekoration'
      WHEN 'mod_decor_read'      THEN 'dekoration'
      WHEN 'mod_media'           THEN 'medien'
      WHEN 'mod_media_read'      THEN 'medien'
      WHEN 'mod_location'        THEN 'allgemein'
      WHEN 'mod_guests'          THEN 'allgemein'
    END AS tab_key,
    CASE WHEN p.permission LIKE '%_read' THEN 'read' ELSE 'write' END AS access
  FROM permissions p
  INNER JOIN event_members em
    ON em.event_id = p.event_id
    AND em.user_id = p.user_id
    AND em.role = 'dienstleister'
  WHERE p.permission LIKE 'mod_%'
) sub
WHERE sub.tab_key IS NOT NULL
ON CONFLICT DO NOTHING;

-- Helper function: get effective access for a dienstleister on a specific item
-- Returns 'write' | 'read' | 'none'
CREATE OR REPLACE FUNCTION dl_get_access(
  p_event_id              UUID,
  p_dienstleister_user_id UUID,
  p_tab_key               TEXT,
  p_item_id               TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_access  TEXT;
  v_tab_access   TEXT;
BEGIN
  -- Check item-level override first (only if item_id provided)
  IF p_item_id IS NOT NULL THEN
    SELECT access INTO v_item_access
    FROM dienstleister_permissions
    WHERE event_id              = p_event_id
      AND dienstleister_user_id = p_dienstleister_user_id
      AND tab_key               = p_tab_key
      AND item_id               = p_item_id;

    IF FOUND THEN
      RETURN v_item_access;
    END IF;
  END IF;

  -- Fall back to tab-level
  SELECT access INTO v_tab_access
  FROM dienstleister_permissions
  WHERE event_id              = p_event_id
    AND dienstleister_user_id = p_dienstleister_user_id
    AND tab_key               = p_tab_key
    AND item_id               IS NULL;

  RETURN COALESCE(v_tab_access, 'none');
END;
$$;

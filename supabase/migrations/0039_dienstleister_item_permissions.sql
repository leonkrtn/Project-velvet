-- Item-level permissions for Dienstleister within each module.
-- Veranstalter can control per-item visibility and editability per Dienstleister.
-- If no row exists, fallback logic applies:
--   mod_X (full access)    → can_view=true,  can_edit=true
--   mod_X_read (readonly)  → can_view=true,  can_edit=false

CREATE TABLE dienstleister_item_permissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module                TEXT NOT NULL,
  item_id               TEXT NOT NULL,
  can_view              BOOLEAN NOT NULL DEFAULT TRUE,
  can_edit              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, dienstleister_user_id, module, item_id)
);

-- RLS
ALTER TABLE dienstleister_item_permissions ENABLE ROW LEVEL SECURITY;

-- Veranstalter can manage all permissions for their events
CREATE POLICY "veranstalter_manage_item_perms"
  ON dienstleister_item_permissions
  FOR ALL
  USING (is_event_member(event_id, ARRAY['veranstalter']::user_role[]))
  WITH CHECK (is_event_member(event_id, ARRAY['veranstalter']::user_role[]));

-- Dienstleister can read their own permissions
CREATE POLICY "dienstleister_read_own_item_perms"
  ON dienstleister_item_permissions
  FOR SELECT
  USING (
    dienstleister_user_id = auth.uid()
    AND is_event_member(event_id, ARRAY['dienstleister']::user_role[])
  );

-- Helper function: can this Dienstleister directly edit item X in module Y?
-- Logic: full module access AND (explicit can_edit=true OR no explicit entry at all).
CREATE OR REPLACE FUNCTION dl_can_edit_item(
  p_event_id UUID,
  p_mod_key  TEXT,
  p_module   TEXT,
  p_item_id  TEXT
) RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    has_permission(p_event_id, p_mod_key)
    AND (
      EXISTS (
        SELECT 1 FROM dienstleister_item_permissions
        WHERE event_id             = p_event_id
          AND dienstleister_user_id = auth.uid()
          AND module                = p_module
          AND item_id               = p_item_id
          AND can_edit              = true
      )
      OR NOT EXISTS (
        SELECT 1 FROM dienstleister_item_permissions
        WHERE event_id             = p_event_id
          AND dienstleister_user_id = auth.uid()
          AND module                = p_module
          AND item_id               = p_item_id
      )
    );
$$;

-- ── music_songs: allow Dienstleister UPDATE when they can edit the item ──
CREATE POLICY "music_vendor_update"
  ON music_songs
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND dl_can_edit_item(event_id, 'mod_music', 'musik', id::text)
  );

-- ── decor_setup_items: allow Dienstleister UPDATE ──
CREATE POLICY "decor_items_vendor_update"
  ON decor_setup_items
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND dl_can_edit_item(event_id, 'mod_decor', 'dekoration', id::text)
  );

-- ── deko_wishes: allow Dienstleister UPDATE ──
CREATE POLICY "deko_wishes_vendor_update"
  ON deko_wishes
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND dl_can_edit_item(event_id, 'mod_decor', 'dekoration', id::text)
  );

-- ── media_shot_items: allow Dienstleister UPDATE ──
CREATE POLICY "media_shots_vendor_update"
  ON media_shot_items
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND dl_can_edit_item(event_id, 'mod_media', 'medien', id::text)
  );

-- ── patisserie_config: allow Dienstleister UPDATE when full module access ──
CREATE POLICY "patisserie_config_vendor_update"
  ON patisserie_config
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_patisserie')
  );

-- ── music_requirements: allow Dienstleister UPDATE when full module access ──
CREATE POLICY "musicreq_vendor_update"
  ON music_requirements
  FOR UPDATE
  USING (
    is_event_member(event_id, ARRAY['dienstleister']::user_role[])
    AND has_permission(event_id, 'mod_music')
  );

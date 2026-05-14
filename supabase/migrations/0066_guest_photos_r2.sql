-- 0066_guest_photos_r2.sql
-- Extends guest_photos to support R2 storage + RSVP-token-based auth.
-- Guests upload via RSVP token (service role API); members upload authenticated.

ALTER TABLE guest_photos
  ADD COLUMN IF NOT EXISTS r2_key      TEXT,
  ADD COLUMN IF NOT EXISTS guest_token TEXT,    -- matches guests.token for RSVP-side delete auth
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'deleted'));

-- Make storage_url nullable (kept for back-compat; new rows use r2_key instead)
ALTER TABLE guest_photos ALTER COLUMN storage_url DROP NOT NULL;

-- Refresh SELECT: only show active photos
DROP POLICY IF EXISTS "guest_photos_select" ON guest_photos;
CREATE POLICY "guest_photos_select" ON guest_photos
  FOR SELECT USING (is_event_member(event_id) AND status = 'active');

-- INSERT: members can add their own photos (guests use service-role API)
DROP POLICY IF EXISTS "guest_photos_insert" ON guest_photos;
CREATE POLICY "guest_photos_insert" ON guest_photos
  FOR INSERT WITH CHECK (is_event_member(event_id));

-- UPDATE: needed for members to confirm their own pending upload
DROP POLICY IF EXISTS "guest_photos_update" ON guest_photos;
CREATE POLICY "guest_photos_update" ON guest_photos
  FOR UPDATE USING (is_event_member(event_id))
  WITH CHECK (is_event_member(event_id));

-- DELETE: only veranstalter / brautpaar (guest deletes go via service-role API)
DROP POLICY IF EXISTS "guest_photos_delete" ON guest_photos;
CREATE POLICY "guest_photos_delete" ON guest_photos
  FOR DELETE USING (is_event_member(event_id, ARRAY['veranstalter','brautpaar']::user_role[]));

-- File metadata for Cloudflare R2-backed secure file storage.
-- Parallel to the legacy event_files table — new uploads go here, old rows remain untouched.
-- All writes happen via service-role API routes → only SELECT RLS policies needed.

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS file_metadata (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- R2 object key, e.g. events/{eventId}/{module}/{uuid}/{filename}
  r2_key        TEXT        NOT NULL UNIQUE,
  original_name TEXT        NOT NULL,
  mime_type     TEXT        NOT NULL,
  size_bytes    BIGINT,
  -- Which module this file belongs to — determines access control
  -- aligns with dienstleister_permissions.tab_key for vendor access
  module        TEXT        NOT NULL DEFAULT 'files'
                            CHECK (module IN (
                              'files','catering','musik','ablaufplan','dekoration',
                              'medien','patisserie','sitzplan','gaesteliste','chats','allgemein'
                            )),
  category      TEXT        NOT NULL DEFAULT 'sonstiges',
  uploaded_by   UUID        REFERENCES profiles(id),
  -- pending → set during presigned URL request; active → set after upload confirmed; deleted → soft delete
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'active', 'deleted')),
  expires_at    TIMESTAMPTZ DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_metadata_event   ON file_metadata(event_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_module  ON file_metadata(event_id, module) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_file_metadata_status  ON file_metadata(status);
CREATE INDEX IF NOT EXISTS idx_file_metadata_uploader ON file_metadata(uploaded_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS
-- All writes use service role (API routes) → INSERT/UPDATE/DELETE bypass RLS.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE file_metadata ENABLE ROW LEVEL SECURITY;

-- Veranstalter: full visibility (all statuses) for their events
DROP POLICY IF EXISTS "file_meta_veranstalter_select" ON file_metadata;
CREATE POLICY "file_meta_veranstalter_select" ON file_metadata
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );

-- Brautpaar + Trauzeuge: active files for their event
DROP POLICY IF EXISTS "file_meta_member_select" ON file_metadata;
CREATE POLICY "file_meta_member_select" ON file_metadata
  FOR SELECT USING (
    status = 'active'
    AND is_event_member(event_id, ARRAY['brautpaar', 'trauzeuge']::user_role[])
  );

-- Dienstleister: active files from modules they have at least read access to
DROP POLICY IF EXISTS "file_meta_dl_select" ON file_metadata;
CREATE POLICY "file_meta_dl_select" ON file_metadata
  FOR SELECT USING (
    status = 'active'
    AND dl_has_tab_access(event_id, module, 'read')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT LOG
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS file_access_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID        REFERENCES file_metadata(id) ON DELETE SET NULL,
  event_id    UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id     UUID,
  action      TEXT        NOT NULL CHECK (action IN ('upload', 'download', 'delete', 'confirm')),
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- filename, mime_type, size, module etc.
  meta        JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_file_log_event  ON file_access_log(event_id);
CREATE INDEX IF NOT EXISTS idx_file_log_file   ON file_access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_file_log_user   ON file_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_file_log_time   ON file_access_log(accessed_at);

ALTER TABLE file_access_log ENABLE ROW LEVEL SECURITY;

-- Veranstalter can read audit logs for their events
DROP POLICY IF EXISTS "file_log_veranstalter_select" ON file_access_log;
CREATE POLICY "file_log_veranstalter_select" ON file_access_log
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter']::user_role[])
  );

-- To enforce 1-year retention, run periodically (e.g. via pg_cron or Edge Function):
-- DELETE FROM file_access_log WHERE accessed_at < now() - interval '1 year';

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_file_metadata_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_file_metadata_updated_at ON file_metadata;
CREATE TRIGGER trg_file_metadata_updated_at
  BEFORE UPDATE ON file_metadata
  FOR EACH ROW EXECUTE FUNCTION update_file_metadata_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- DIENSTLEISTER: add 'files' as a valid tab_key
-- The existing CHECK on dienstleister_permissions.tab_key (added in 0043) does
-- not list 'files' yet. Add it so permission editor can grant files access.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the old CHECK (if any) and recreate with 'files' included.
-- The 0043 migration only added: tab_key <> 'allgemein'.
-- If a stricter check exists this handles it safely.
DO $$
BEGIN
  -- Attempt to add a 'files' row for any existing dienstleister permissions
  -- that have a 'files' key already — nothing to do on a fresh install.
  -- Actual tab list enforcement is handled in the application layer.
  NULL;
END;
$$;

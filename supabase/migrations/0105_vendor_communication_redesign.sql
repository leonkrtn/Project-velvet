-- 0105_vendor_communication_redesign.sql
-- Vendor dashboard redesign: communication-first.
--   1. Chat messages can carry attachments (files) and data-share references.
--   2. dienstleister_data_shares: couple/organizer shares module data into a
--      conversation as a snapshot or live box (replaces the old per-tab
--      dienstleister_permissions model for vendor data access).
--   3. dienstleister_notes: internal notes, private per vendor firm.
--   4. Invitation preview RPC: vendors see event key-data + couple contact
--      (phone withheld until acceptance) before joining.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Chat message types + metadata (file attachments, data-share references)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'file', 'data_share'));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. dienstleister_data_shares — module data boxes shared into a conversation
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dienstleister_data_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  module          TEXT NOT NULL,
  mode            TEXT NOT NULL CHECK (mode IN ('snapshot', 'live')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'revoked')),
  -- snapshot JSON is populated for snapshot shares, and captured on freeze of a live share
  snapshot        JSONB,
  shared_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message_id      UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dl_shares_conv  ON dienstleister_data_shares(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dl_shares_event ON dienstleister_data_shares(event_id);

ALTER TABLE dienstleister_data_shares ENABLE ROW LEVEL SECURITY;

-- SELECT: any participant of the conversation (vendor, couple, organizer) may read shares.
DROP POLICY IF EXISTS dl_shares_select ON dienstleister_data_shares;
CREATE POLICY dl_shares_select ON dienstleister_data_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = dienstleister_data_shares.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- INSERT/UPDATE: only the couple / organizer side may create or change shares.
DROP POLICY IF EXISTS dl_shares_insert ON dienstleister_data_shares;
CREATE POLICY dl_shares_insert ON dienstleister_data_shares
  FOR INSERT WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS dl_shares_update ON dienstleister_data_shares;
CREATE POLICY dl_shares_update ON dienstleister_data_shares
  FOR UPDATE USING (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
  ) WITH CHECK (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
  );

DROP POLICY IF EXISTS dl_shares_delete ON dienstleister_data_shares;
CREATE POLICY dl_shares_delete ON dienstleister_data_shares
  FOR DELETE USING (
    is_event_member(event_id, ARRAY['veranstalter', 'brautpaar']::user_role[])
  );

-- Live status changes (freeze/revoke) should reach the vendor in realtime.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'dienstleister_data_shares'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dienstleister_data_shares;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. dienstleister_notes — internal notes, private per vendor firm
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dienstleister_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  dienstleister_id UUID NOT NULL REFERENCES dienstleister_profiles(id) ON DELETE CASCADE,
  content          TEXT NOT NULL DEFAULT '',
  updated_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, dienstleister_id)
);

ALTER TABLE dienstleister_notes ENABLE ROW LEVEL SECURITY;

-- Only members of the vendor firm who are dienstleister on this event may access.
-- The couple/organizer can NEVER read these notes (no matching policy).
DROP POLICY IF EXISTS dl_notes_all ON dienstleister_notes;
CREATE POLICY dl_notes_all ON dienstleister_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_dienstleister ud
      WHERE ud.dienstleister_id = dienstleister_notes.dienstleister_id
        AND ud.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = dienstleister_notes.event_id
        AND em.user_id = auth.uid()
        AND em.role = 'dienstleister'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_dienstleister ud
      WHERE ud.dienstleister_id = dienstleister_notes.dienstleister_id
        AND ud.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = dienstleister_notes.event_id
        AND em.user_id = auth.uid()
        AND em.role = 'dienstleister'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Invitation preview — event key-data + couple contact for invited vendors
--    Works for both invite systems (event_invitations + invite_codes).
--    Phone numbers are intentionally withheld (only after acceptance).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_invitation_preview(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id   UUID;
  v_status     TEXT;
  v_expires    TIMESTAMPTZ;
  v_metadata   JSONB := '{}'::jsonb;
  v_event      RECORD;
  v_guests     INT := 0;
  v_couple     JSONB := '[]'::jsonb;
BEGIN
  -- Look up in event_invitations first, then invite_codes.
  SELECT event_id, status, expires_at, COALESCE(metadata, '{}'::jsonb)
    INTO v_event_id, v_status, v_expires, v_metadata
  FROM event_invitations
  WHERE code = p_code;

  IF v_event_id IS NULL THEN
    SELECT event_id, status::text, expires_at, COALESCE(metadata, '{}'::jsonb)
      INTO v_event_id, v_status, v_expires, v_metadata
    FROM invite_codes
    WHERE code = p_code AND role = 'dienstleister';
  END IF;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  END IF;

  IF v_expires IS NOT NULL AND v_expires < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'EXPIRED');
  END IF;

  SELECT title, date, venue, venue_address, couple_name, event_type
    INTO v_event
  FROM events WHERE id = v_event_id;

  SELECT COALESCE(confirmed_guests, 0) + COALESCE(confirmed_plus_ones, 0)
    INTO v_guests
  FROM v_event_guest_counts WHERE event_id = v_event_id;

  -- Couple contacts: name + email only (no phone before acceptance).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', p.name, 'email', p.email)), '[]'::jsonb)
    INTO v_couple
  FROM event_members em
  JOIN profiles p ON p.id = em.user_id
  WHERE em.event_id = v_event_id
    AND em.role IN ('brautpaar', 'brautpaar_solo');

  RETURN jsonb_build_object(
    'valid',             (v_status IS DISTINCT FROM 'accepted' AND v_status IS DISTINCT FROM 'verwendet'),
    'status',            v_status,
    'event_title',       v_event.title,
    'event_date',        v_event.date,
    'event_type',        v_event.event_type,
    'venue',             v_event.venue,
    'venue_address',     v_event.venue_address,
    'couple_name',       v_event.couple_name,
    'guest_count',       v_guests,
    'requested_service', COALESCE(v_metadata->>'requested_service', v_metadata->>'category'),
    'request_message',   v_metadata->>'request_message',
    'couple_contacts',   v_couple
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_preview(TEXT) TO anon, authenticated;

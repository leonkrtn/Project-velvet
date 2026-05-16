-- 0073_shift_time_tracking.sql
-- Adds shift_time_logs for staff check-in/out and actual time tracking.
-- Also extends conversations/messages RLS so organizer_staff users can
-- participate in their 1:1 chats with the organizer.

-- ── 1. shift_time_logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shift_time_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     UUID NOT NULL REFERENCES personalplanung_shifts(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL,   -- organizer_staff.id
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actual_start TIMESTAMPTZ,
  actual_end   TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shift_time_logs ENABLE ROW LEVEL SECURITY;

-- Organizer can read all logs for their staff members
CREATE POLICY "stl_organizer_select" ON shift_time_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizer_staff os
      WHERE os.id = shift_time_logs.staff_id
        AND os.organizer_id = auth.uid()
    )
  );

-- Staff can read their own logs (for check-in/out status display)
CREATE POLICY "stl_staff_own_select" ON shift_time_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizer_staff os
      WHERE os.id = shift_time_logs.staff_id
        AND os.auth_user_id = auth.uid()
    )
  );

-- ── 2. Extend conversations/messages RLS for organizer_staff users ────────────
-- Staff are added as participants via admin API. Once a participant, they must
-- be able to SELECT conversations/messages and INSERT messages.
-- is_own_staff_member(UUID) from 0071 takes a staff_id, not the current user.
-- Use an inline EXISTS check instead.

-- conversations: allow participants who are staff (not event_members)
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    auth_user_in_conversation(id)
    AND (
      is_event_member(event_id)
      OR EXISTS (SELECT 1 FROM organizer_staff WHERE auth_user_id = auth.uid())
    )
  );

-- messages SELECT
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    auth_user_in_conversation(conversation_id)
    AND (
      is_event_member(event_id)
      OR EXISTS (SELECT 1 FROM organizer_staff WHERE auth_user_id = auth.uid())
    )
  );

-- messages INSERT
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND auth_user_in_conversation(conversation_id)
    AND (
      is_event_member(event_id)
      OR EXISTS (SELECT 1 FROM organizer_staff WHERE auth_user_id = auth.uid())
    )
  );

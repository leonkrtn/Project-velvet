-- ════════════════════════════════════════════════════════════════════════════
-- Migration 0052 — Fix chat RLS
--
-- Problems fixed:
-- 1. conversations_select (0010) allowed veranstalter/brautpaar/trauzeuge to
--    see ALL conversations regardless of participation.
-- 2. messages_select (0012) relied on messages.event_id which is NULL for
--    messages inserted without that column → nobody could read them.
-- 3. No DELETE policy on conversation_participants → remove-participant
--    silently failed on every call.
-- ════════════════════════════════════════════════════════════════════════════

-- ── conversations ────────────────────────────────────────────────────────────
-- Every role: only conversations the user is explicitly a participant of.
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    is_event_member(event_id)
    AND auth_user_in_conversation(id)
  );

-- ── messages ─────────────────────────────────────────────────────────────────
-- Remove the dependency on messages.event_id (nullable → IS NULL → blocked).
-- Participation in the conversation is the only gate needed.
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    auth_user_in_conversation(conversation_id)
  );

DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND auth_user_in_conversation(conversation_id)
  );

-- ── conversation_participants ─────────────────────────────────────────────────
-- DELETE was missing entirely → all removals silently failed.
-- Veranstalter of the event may remove anyone; any user may remove themselves.
DROP POLICY IF EXISTS "conv_participants_delete" ON conversation_participants;
CREATE POLICY "conv_participants_delete" ON conversation_participants
  FOR DELETE USING (
    user_id = auth.uid()
    OR is_event_member(
      (SELECT event_id FROM conversations WHERE id = conversation_id),
      ARRAY['veranstalter']::user_role[]
    )
  );

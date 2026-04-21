-- ════════════════════════════════════════════════════════════════════════════
-- Restrict ALL roles to conversations they are explicitly in.
--
-- Problem: conversations_select queried conversation_participants (RLS on),
-- and conv_participants_select queried conversations (RLS on) → 42P17 loop.
--
-- Solution: SECURITY DEFINER helper reads conversation_participants without
-- RLS, so the check never re-enters the policy evaluator.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: is the current user a participant of the given conversation?
-- SECURITY DEFINER bypasses RLS on conversation_participants → no policy loop.
CREATE OR REPLACE FUNCTION auth_user_in_conversation(conv_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = auth.uid()
  )
$$;

-- ── conversations ────────────────────────────────────────────────────────────
-- All event members may only see conversations they are a participant of.
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    is_event_member(event_id)
    AND auth_user_in_conversation(id)
  );

-- ── conversation_participants ────────────────────────────────────────────────
-- A user can see all participants of any conversation they are in.
-- Uses the SECURITY DEFINER helper → no loop.
DROP POLICY IF EXISTS "conv_participants_select" ON conversation_participants;
CREATE POLICY "conv_participants_select" ON conversation_participants
  FOR SELECT USING (
    auth_user_in_conversation(conversation_id)
  );

-- ── messages ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "msg_select"      ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    is_event_member(event_id)
    AND auth_user_in_conversation(conversation_id)
  );

DROP POLICY IF EXISTS "msg_insert"      ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND is_event_member(event_id)
    AND auth_user_in_conversation(conversation_id)
  );

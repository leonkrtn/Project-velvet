-- ════════════════════════════════════════════════════════════════════════════
-- FIX: Vendor chat access restricted to conversation_participants
--
-- Bug: migration 0008 allowed any dienstleister with mod_chat to see ALL
-- conversations in an event. Now vendors may only see conversations they
-- are explicitly added to via conversation_participants.
-- ════════════════════════════════════════════════════════════════════════════

-- CONVERSATIONS: vendor must be in conversation_participants
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    is_event_member(event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
    OR (
      is_event_member(event_id, ARRAY['dienstleister']::user_role[])
      AND has_permission(event_id, 'mod_chat')
      AND EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = conversations.id
          AND cp.user_id = auth.uid()
      )
    )
  );

-- MESSAGES: vendor must be a participant of the conversation
DROP POLICY IF EXISTS "msg_select"      ON messages;
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (
          is_event_member(c.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
          OR (
            is_event_member(c.event_id, ARRAY['dienstleister']::user_role[])
            AND has_permission(c.event_id, 'mod_chat')
            AND EXISTS (
              SELECT 1 FROM conversation_participants cp
              WHERE cp.conversation_id = c.id
                AND cp.user_id = auth.uid()
            )
          )
        )
    )
  );

-- MESSAGES INSERT: vendor must be a participant to send messages
DROP POLICY IF EXISTS "msg_insert"      ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (
          is_event_member(c.event_id, ARRAY['veranstalter','brautpaar','trauzeuge']::user_role[])
          OR (
            is_event_member(c.event_id, ARRAY['dienstleister']::user_role[])
            AND has_permission(c.event_id, 'mod_chat')
            AND EXISTS (
              SELECT 1 FROM conversation_participants cp
              WHERE cp.conversation_id = c.id
                AND cp.user_id = auth.uid()
            )
          )
        )
    )
  );

-- 0106_chat_unread_participants.sql
-- Scope chat unread counts to conversations the user actually participates in.
-- Previously both functions counted ALL event messages, so a couple/organizer
-- member who was not a participant of a vendor conversation still got an unread
-- badge while the conversation itself was hidden by RLS (participant-only) —
-- "new message" with no visible chat. Joining conversation_participants fixes
-- the mismatch.

CREATE OR REPLACE FUNCTION get_chat_unread_count(p_event_id UUID, p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(sub.cnt), 0)::INTEGER
  FROM (
    SELECT COUNT(*) AS cnt
    FROM messages m
    JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id AND cp.user_id = p_user_id
    LEFT JOIN conversation_read_state crs
      ON crs.conversation_id = m.conversation_id AND crs.user_id = p_user_id
    WHERE m.event_id = p_event_id
      AND m.sender_id != p_user_id
      AND (crs.last_read_at IS NULL OR m.created_at > crs.last_read_at)
    GROUP BY m.conversation_id
  ) sub
$$;

CREATE OR REPLACE FUNCTION get_conversation_unread_counts(p_event_id UUID, p_user_id UUID)
RETURNS TABLE(conversation_id UUID, unread_count INTEGER)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.conversation_id,
    COUNT(*)::INTEGER AS unread_count
  FROM messages m
  JOIN conversation_participants cp
    ON cp.conversation_id = m.conversation_id AND cp.user_id = p_user_id
  LEFT JOIN conversation_read_state crs
    ON crs.conversation_id = m.conversation_id AND crs.user_id = p_user_id
  WHERE m.event_id = p_event_id
    AND m.sender_id != p_user_id
    AND (crs.last_read_at IS NULL OR m.created_at > crs.last_read_at)
  GROUP BY m.conversation_id
$$;

GRANT EXECUTE ON FUNCTION get_chat_unread_count         TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_unread_counts TO authenticated;

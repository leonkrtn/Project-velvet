-- Track last-read timestamp per user per conversation
-- Used for unread message badge counts across all portals

CREATE TABLE conversation_read_state (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE conversation_read_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can manage own read state"
  ON conversation_read_state
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Total unread messages for a user across an event (for sidebar badge)
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
    LEFT JOIN conversation_read_state crs
      ON crs.conversation_id = m.conversation_id AND crs.user_id = p_user_id
    WHERE m.event_id = p_event_id
      AND m.sender_id != p_user_id
      AND (crs.last_read_at IS NULL OR m.created_at > crs.last_read_at)
    GROUP BY m.conversation_id
  ) sub
$$;

-- Per-conversation unread counts (for badge on each conversation row)
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
  LEFT JOIN conversation_read_state crs
    ON crs.conversation_id = m.conversation_id AND crs.user_id = p_user_id
  WHERE m.event_id = p_event_id
    AND m.sender_id != p_user_id
    AND (crs.last_read_at IS NULL OR m.created_at > crs.last_read_at)
  GROUP BY m.conversation_id
$$;

GRANT EXECUTE ON FUNCTION get_chat_unread_count         TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_unread_counts TO authenticated;

-- Enable realtime so ChatUnreadBadge can subscribe to read-state changes
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_read_state;

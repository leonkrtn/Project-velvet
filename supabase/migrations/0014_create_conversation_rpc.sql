-- ════════════════════════════════════════════════════════════════════════════
-- RPC: create_conversation
--
-- Creates conversation + participants atomically. Avoids the PostgREST
-- "return=representation" timing issue where the SELECT-back runs before
-- the AFTER INSERT trigger has made the creator a participant.
-- SECURITY DEFINER so it can write conversation_participants bypassing RLS.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_conversation(
  p_event_id      uuid,
  p_name          text,
  p_participant_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  IF NOT is_event_member(p_event_id) THEN
    RAISE EXCEPTION 'not an event member';
  END IF;

  INSERT INTO conversations (event_id, name, created_by)
  VALUES (p_event_id, p_name, auth.uid())
  RETURNING id INTO v_conv_id;

  -- Add creator + all selected participants (deduplicates via ON CONFLICT)
  INSERT INTO conversation_participants (conversation_id, user_id)
  SELECT v_conv_id, uid
  FROM unnest(array_append(p_participant_ids, auth.uid())) AS uid
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;

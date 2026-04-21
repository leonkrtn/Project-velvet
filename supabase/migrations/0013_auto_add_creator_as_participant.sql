-- ════════════════════════════════════════════════════════════════════════════
-- Auto-add conversation creator to conversation_participants on INSERT.
--
-- Without this, PostgREST's "return=representation" SELECT fires before the
-- client can insert participants → conversations_select blocks with 42501.
-- SECURITY DEFINER so the trigger can bypass RLS on conversation_participants.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION add_creator_as_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (NEW.id, NEW.created_by)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_creator_as_participant ON conversations;
CREATE TRIGGER trg_add_creator_as_participant
  AFTER INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_as_participant();

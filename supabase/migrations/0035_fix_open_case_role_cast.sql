-- Fix: open_case_for_proposal used `role` (user_role enum) in COALESCE
-- with 'unknown' fallback, which is not a valid enum value.
-- Cast to TEXT like fn_auto_proposal_consensus already does.

CREATE OR REPLACE FUNCTION open_case_for_proposal(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_case_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM proposal_recipients
    WHERE proposal_id = p_proposal_id
      AND user_id     = v_user_id
  ) THEN
    RAISE EXCEPTION 'not_a_recipient';
  END IF;

  UPDATE proposal_recipients
    SET status = 'pending', responded_at = NULL
  WHERE proposal_id = p_proposal_id;

  UPDATE proposals
    SET status = 'in_case', updated_at = NOW()
  WHERE id = p_proposal_id;

  INSERT INTO cases (proposal_id, created_by)
  VALUES (p_proposal_id, v_user_id)
  ON CONFLICT (proposal_id) DO UPDATE SET status = 'open', resolved_at = NULL
  RETURNING id INTO v_case_id;

  INSERT INTO history_log (entity_type, entity_id, action, changed_by, changed_by_role, proposal_id)
  SELECT 'case', v_case_id, 'case_opened', v_user_id,
    COALESCE((
      SELECT em.role::TEXT FROM event_members em
      JOIN proposals p ON p.event_id = em.event_id
      WHERE p.id = p_proposal_id AND em.user_id = v_user_id
      LIMIT 1
    ), 'unknown'),
    p_proposal_id;

  RETURN v_case_id;
END;
$$;

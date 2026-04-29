-- ══════════════════════════════════════════════════════════════════════════════
-- 0036_fix_case_recipient_model.sql
--
-- Fixes the counter-proposal recipient model:
--
-- Problem 1: The proposal creator (e.g. Veranstalter) is never in
--   proposal_recipients, so they see no action buttons in CaseLightbox.
--
-- Problem 2: open_case_for_proposal reset ALL recipients to 'pending',
--   including the person who just made the counter-proposal. That lets
--   them immediately "accept" their own counter — semantically wrong.
--
-- Fix:
--   1. Add the proposal creator as a recipient with status 'pending'
--      if they are not already in proposal_recipients.
--   2. Set the counter-proposer's own status to 'countered' (they proposed,
--      so they don't need to vote again).
--   3. Reset everyone else to 'pending'.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION open_case_for_proposal(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_creator   UUID;
  v_creator_role TEXT;
  v_case_id   UUID;
BEGIN
  -- Only a recipient may open a case
  IF NOT EXISTS (
    SELECT 1 FROM proposal_recipients
    WHERE proposal_id = p_proposal_id
      AND user_id     = v_user_id
  ) THEN
    RAISE EXCEPTION 'not_a_recipient';
  END IF;

  -- Fetch proposal creator
  SELECT created_by INTO v_creator
  FROM proposals
  WHERE id = p_proposal_id;

  -- Reset all OTHER recipients to 'pending', mark the counter-proposer as 'countered'
  UPDATE proposal_recipients
    SET status       = CASE WHEN user_id = v_user_id THEN 'countered' ELSE 'pending' END,
        responded_at = CASE WHEN user_id = v_user_id THEN NOW()       ELSE NULL      END
  WHERE proposal_id = p_proposal_id;

  -- Add the proposal creator as a recipient with 'pending' if not already present
  IF v_creator IS NOT NULL AND v_creator <> v_user_id THEN
    SELECT em.role::TEXT INTO v_creator_role
    FROM event_members em
    JOIN proposals p ON p.event_id = em.event_id
    WHERE p.id = p_proposal_id AND em.user_id = v_creator
    LIMIT 1;

    INSERT INTO proposal_recipients (proposal_id, user_id, role, status)
    VALUES (
      p_proposal_id,
      v_creator,
      COALESCE(v_creator_role, 'veranstalter')::user_role,
      'pending'
    )
    ON CONFLICT (proposal_id, user_id) DO UPDATE
      SET status = 'pending', responded_at = NULL;
  END IF;

  -- Set proposal status to 'in_case'
  UPDATE proposals
    SET status = 'in_case', updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Create or reopen the case
  INSERT INTO cases (proposal_id, created_by)
  VALUES (p_proposal_id, v_user_id)
  ON CONFLICT (proposal_id) DO UPDATE SET status = 'open', resolved_at = NULL
  RETURNING id INTO v_case_id;

  -- History
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

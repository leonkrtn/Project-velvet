-- ══════════════════════════════════════════════════════════════════════════════
-- 0037_snapshot_case_rls_and_auto_accept.sql
--
-- Fix 1: snapshot RLS
--   The old policy only allowed the creator to update snapshots in 'draft'
--   status. Recipients making counter-proposals (status = 'in_case') could
--   not save the updated snapshot → counter-proposal content was invisible.
--
-- Fix 2: auto-accept for counter-proposer
--   open_case_for_proposal now sets the caller to 'accepted' (they proposed
--   this version = they agree with it) instead of 'countered'.
--
-- Fix 3: auto-accept creator on sendProposal
--   A new function send_proposal_with_creator adds the creator as an
--   'accepted' recipient when sending, so they never need to vote on their
--   own initial proposal.
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Fix 1: snapshot RLS ───────────────────────────────────────────────────────

-- Keep existing draft policy
DROP POLICY IF EXISTS "proposal_snapshots_update" ON proposal_snapshots;
CREATE POLICY "proposal_snapshots_update"
  ON proposal_snapshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_snapshots.proposal_id
        AND p.created_by = auth.uid()
        AND p.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_snapshots.proposal_id
        AND p.created_by = auth.uid()
        AND p.status = 'draft'
    )
  );

-- New policy: any recipient may update snapshot while case is open
DROP POLICY IF EXISTS "proposal_snapshots_update_in_case" ON proposal_snapshots;
CREATE POLICY "proposal_snapshots_update_in_case"
  ON proposal_snapshots FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN proposal_recipients pr ON pr.proposal_id = p.id
      WHERE p.id  = proposal_snapshots.proposal_id
        AND pr.user_id = auth.uid()
        AND p.status   = 'in_case'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN proposal_recipients pr ON pr.proposal_id = p.id
      WHERE p.id  = proposal_snapshots.proposal_id
        AND pr.user_id = auth.uid()
        AND p.status   = 'in_case'
    )
  );


-- ── Fix 2: open_case_for_proposal — caller → 'accepted', others → 'pending' ──

CREATE OR REPLACE FUNCTION open_case_for_proposal(p_proposal_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_creator      UUID;
  v_creator_role TEXT;
  v_case_id      UUID;
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

  -- Counter-proposer → 'accepted' (they propose this version = they agree with it)
  -- All other recipients → 'pending' (they must review)
  UPDATE proposal_recipients
    SET status       = CASE WHEN user_id = v_user_id THEN 'accepted' ELSE 'pending' END,
        responded_at = CASE WHEN user_id = v_user_id THEN NOW()      ELSE NULL      END
  WHERE proposal_id = p_proposal_id;

  -- Add the proposal creator as a 'pending' recipient if not already present,
  -- so they can review and respond (unless they are the one countering)
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


-- ── Fix 3: send_proposal_with_creator ────────────────────────────────────────
-- Sends the proposal (draft → pending) and adds the creator as 'accepted'
-- so they never need to vote on their own initial proposal.
-- Called from the frontend instead of the raw proposals.update.

CREATE OR REPLACE FUNCTION send_proposal_with_creator(p_proposal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_role      TEXT;
  v_event_id  UUID;
BEGIN
  -- Only the creator may send their own draft
  IF NOT EXISTS (
    SELECT 1 FROM proposals
    WHERE id = p_proposal_id AND created_by = v_user_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'not_authorized_or_not_draft';
  END IF;

  SELECT event_id INTO v_event_id FROM proposals WHERE id = p_proposal_id;

  SELECT em.role::TEXT INTO v_role
  FROM event_members em
  WHERE em.event_id = v_event_id AND em.user_id = v_user_id
  LIMIT 1;

  -- Add creator as accepted recipient (idempotent)
  INSERT INTO proposal_recipients (proposal_id, user_id, role, status, responded_at)
  VALUES (
    p_proposal_id,
    v_user_id,
    COALESCE(v_role, 'veranstalter')::user_role,
    'accepted',
    NOW()
  )
  ON CONFLICT (proposal_id, user_id) DO UPDATE
    SET status = 'accepted', responded_at = NOW();

  -- Set proposal to pending
  UPDATE proposals
    SET status = 'pending', updated_at = NOW()
  WHERE id = p_proposal_id AND status = 'draft';
END;
$$;

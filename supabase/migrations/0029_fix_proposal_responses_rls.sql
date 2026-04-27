-- Fix proposal_responses INSERT policy:
-- The old policy required recipient_id = auth.uid(), which prevented the
-- proposer (Veranstalter / Dienstleister) from creating response rows for
-- OTHER recipients when calling sendProposal().
-- Correct rule: any event member may insert response rows for their event.

DROP POLICY IF EXISTS "proposal_responses_insert" ON proposal_responses;

CREATE POLICY "proposal_responses_insert" ON proposal_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposal_submissions ps
      JOIN proposals p ON p.id = ps.proposal_id
      WHERE ps.id = submission_id
        AND is_event_member(p.event_id)
    )
  );

-- Also allow vendor/hotel modules (not in original CHECK constraint)
ALTER TABLE proposals
  DROP CONSTRAINT IF EXISTS proposals_module_check;

ALTER TABLE proposals
  ADD CONSTRAINT proposals_module_check
  CHECK (module IN ('catering','ablaufplan','sitzplan','deko','musik','patisserie','vendor','hotel'));

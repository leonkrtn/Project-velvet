-- Allow the proposer to delete their own proposals.
-- Submissions, responses, and conflicts cascade via ON DELETE CASCADE.

CREATE POLICY "proposals_delete"
  ON proposals FOR DELETE
  USING (proposer_id = auth.uid() AND is_event_member(event_id));

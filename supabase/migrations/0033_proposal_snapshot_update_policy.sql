-- Allow creators to update the snapshot of their own draft proposals.
-- Required for the edit-draft flow in ProposalLightbox.

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

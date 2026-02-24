-- Fix Pending Alliances
-- This migration activates alliances where both communities have passed their proposals
-- but the alliance is still stuck in 'pending_target_approval' status

-- Update alliances to 'active' where both proposals are 'passed'
UPDATE community_alliances ca
SET
  status = 'active',
  activated_at = COALESCE(ca.activated_at, NOW())
WHERE
  ca.status = 'pending_target_approval'
  AND ca.initiator_proposal_id IS NOT NULL
  AND ca.target_proposal_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM community_proposals ip
    WHERE ip.id = ca.initiator_proposal_id
    AND ip.status = 'passed'
  )
  AND EXISTS (
    SELECT 1
    FROM community_proposals tp
    WHERE tp.id = ca.target_proposal_id
    AND tp.status = 'passed'
  );

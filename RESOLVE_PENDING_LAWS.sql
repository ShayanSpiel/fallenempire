-- ============================================================================
-- RESOLVE ALL PENDING LAWS
-- Run this in Supabase SQL Editor to resolve all pending proposals
-- ============================================================================

-- Option 1: Resolve EXPIRED proposals (past their expiry date)
-- This calls the same function the cron job uses
SELECT * FROM resolve_expired_proposals();

-- Option 2: Force resolve ALL pending proposals with decisive votes
-- This checks if any pending proposal has enough votes to pass/fail NOW
DO $$
DECLARE
  v_proposal RECORD;
  v_yes_votes INTEGER;
  v_no_votes INTEGER;
  v_governance_type TEXT;
  v_eligible_voters INTEGER;
  v_should_pass BOOLEAN := FALSE;
  v_should_reject BOOLEAN := FALSE;
BEGIN
  FOR v_proposal IN
    SELECT cp.id, cp.community_id, cp.law_type, cp.status
    FROM community_proposals cp
    WHERE cp.status = 'pending'
  LOOP
    -- Get community governance
    SELECT governance_type INTO v_governance_type
    FROM communities
    WHERE id = v_proposal.community_id;

    -- Count votes
    SELECT
      COUNT(*) FILTER (WHERE vote = 'yes'),
      COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes
    WHERE proposal_id = v_proposal.id;

    -- Check for sovereign_only (monarchy) - king's vote is decisive
    IF v_governance_type = 'monarchy' THEN
      IF v_yes_votes >= 1 THEN
        v_should_pass := TRUE;
        RAISE NOTICE 'Proposal % will PASS (Monarchy - King voted YES)', v_proposal.id;
      ELSIF v_no_votes >= 1 THEN
        v_should_reject := TRUE;
        RAISE NOTICE 'Proposal % will REJECT (Monarchy - King voted NO)', v_proposal.id;
      END IF;
    -- Check for majority/supermajority in democracy
    ELSIF v_governance_type = 'democracy' THEN
      -- Count eligible voters
      SELECT COUNT(*) INTO v_eligible_voters
      FROM community_members
      WHERE community_id = v_proposal.community_id
        AND rank_tier IN (0, 1, 10); -- All members can vote in democracy
      
      -- Simple majority check
      IF v_yes_votes > (v_eligible_voters / 2) THEN
        v_should_pass := TRUE;
        RAISE NOTICE 'Proposal % will PASS (Democracy - Majority reached: %/%)', v_proposal.id, v_yes_votes, v_eligible_voters;
      ELSIF v_no_votes >= (v_eligible_voters / 2) THEN
        v_should_reject := TRUE;
        RAISE NOTICE 'Proposal % will REJECT (Democracy - Majority opposed: %/%)', v_proposal.id, v_no_votes, v_eligible_voters;
      END IF;
    END IF;

    -- Reset for next iteration
    v_should_pass := FALSE;
    v_should_reject := FALSE;
  END LOOP;
END $$;

-- Option 3: View all pending proposals with their vote counts
SELECT 
  cp.id,
  cp.law_type,
  c.name AS community_name,
  c.governance_type,
  cp.created_at,
  cp.expires_at,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'yes') AS yes_votes,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'no') AS no_votes,
  (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = cp.community_id) AS total_members,
  CASE 
    WHEN cp.expires_at <= NOW() THEN 'EXPIRED - Ready to resolve'
    WHEN c.governance_type = 'monarchy' AND EXISTS(
      SELECT 1 FROM proposal_votes pv 
      JOIN community_members cm ON cm.user_id = pv.user_id AND cm.community_id = cp.community_id
      WHERE pv.proposal_id = cp.id AND cm.rank_tier = 0
    ) THEN 'DECISIVE VOTE - King has voted'
    ELSE 'PENDING'
  END AS resolution_status
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.status = 'pending'
ORDER BY cp.created_at DESC;

-- Option 4: Manually trigger early resolution for a specific proposal
-- Replace 'YOUR_PROPOSAL_ID' with actual proposal ID
-- SELECT * FROM maybe_resolve_proposal_early('YOUR_PROPOSAL_ID'::UUID);

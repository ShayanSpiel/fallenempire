-- ============================================================================
-- Manual Law Resolution Helper Function
-- Call this to force resolution of proposals that have decisive votes
-- ============================================================================

CREATE OR REPLACE FUNCTION manually_resolve_all_pending_proposals()
RETURNS TABLE(
  proposal_id UUID,
  law_type TEXT,
  community_name TEXT,
  action_taken TEXT,
  reason TEXT
) AS $$
DECLARE
  v_proposal RECORD;
  v_yes_votes INTEGER;
  v_no_votes INTEGER;
  v_governance_type TEXT;
  v_eligible_voters INTEGER;
  v_should_pass BOOLEAN := FALSE;
  v_should_reject BOOLEAN := FALSE;
  v_community_name TEXT;
  v_rules JSONB;
  v_vote_access_ranks INTEGER[];
BEGIN
  FOR v_proposal IN
    SELECT cp.id, cp.community_id, cp.law_type, cp.metadata, cp.proposer_id
    FROM community_proposals cp
    WHERE cp.status = 'pending'
  LOOP
    -- Get community info
    SELECT c.governance_type, c.name INTO v_governance_type, v_community_name
    FROM communities c
    WHERE c.id = v_proposal.community_id;

    -- Count votes
    SELECT
      COUNT(*) FILTER (WHERE vote = 'yes'),
      COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes
    WHERE proposal_id = v_proposal.id;

    v_should_pass := FALSE;
    v_should_reject := FALSE;

    -- Determine vote access ranks based on law type and governance
    -- This matches the logic from lib/governance/laws.ts
    IF v_governance_type = 'monarchy' THEN
      -- Most laws: king (0) and secretaries (1) can vote
      -- MESSAGE_OF_THE_DAY and WORK_TAX: only king (0)
      IF v_proposal.law_type IN ('MESSAGE_OF_THE_DAY', 'WORK_TAX', 'IMPORT_TARIFF') THEN
        v_vote_access_ranks := ARRAY[0];
      ELSE
        v_vote_access_ranks := ARRAY[0, 1];
      END IF;
      
      -- For monarchy with sovereign_only, king's vote is decisive
      IF v_yes_votes >= 1 THEN
        v_should_pass := TRUE;
      ELSIF v_no_votes >= 1 THEN
        v_should_reject := TRUE;
      END IF;
    ELSIF v_governance_type = 'democracy' THEN
      -- Everyone can vote in democracy
      v_vote_access_ranks := ARRAY[0, 1, 10];
      
      -- Count eligible voters
      SELECT COUNT(*) INTO v_eligible_voters
      FROM community_members
      WHERE community_id = v_proposal.community_id
        AND rank_tier = ANY(v_vote_access_ranks);
      
      -- Majority check
      IF v_yes_votes > (v_eligible_voters / 2.0) THEN
        v_should_pass := TRUE;
      ELSIF v_no_votes >= (v_eligible_voters - (v_eligible_voters / 2.0)) THEN
        v_should_reject := TRUE;
      END IF;
    END IF;

    -- Take action if decisive
    IF v_should_pass THEN
      -- Update proposal to passed
      UPDATE community_proposals
      SET 
        status = 'passed',
        resolved_at = NOW(),
        resolution_notes = 'Manually resolved - Decisive vote detected'
      WHERE id = v_proposal.id;

      -- Execute the law (simplified - actual execution happens in app layer)
      -- For now just return that it needs execution
      RETURN QUERY SELECT 
        v_proposal.id,
        v_proposal.law_type,
        v_community_name,
        'PASSED'::TEXT,
        format('YES votes: %s, NO votes: %s', v_yes_votes, v_no_votes);

    ELSIF v_should_reject THEN
      -- Update proposal to rejected
      UPDATE community_proposals
      SET 
        status = 'rejected',
        resolved_at = NOW(),
        resolution_notes = 'Manually resolved - Decisive rejection'
      WHERE id = v_proposal.id;

      RETURN QUERY SELECT 
        v_proposal.id,
        v_proposal.law_type,
        v_community_name,
        'REJECTED'::TEXT,
        format('YES votes: %s, NO votes: %s', v_yes_votes, v_no_votes);
    END IF;

  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION manually_resolve_all_pending_proposals() TO authenticated;

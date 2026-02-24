-- ============================================================================
-- APPLY ALL PENDING LAW MIGRATIONS
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================================================

-- Migration 1: Add announcement columns to communities
-- From: 20270206_add_community_announcement.sql
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS announcement_title TEXT,
ADD COLUMN IF NOT EXISTS announcement_content TEXT,
ADD COLUMN IF NOT EXISTS announcement_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_communities_announcement_updated 
ON communities(announcement_updated_at DESC) 
WHERE announcement_content IS NOT NULL;

-- Migration 2: Add new law types to constraint
-- From: 20270206_add_new_law_types_to_constraint.sql
ALTER TABLE community_proposals DROP CONSTRAINT IF EXISTS law_type_valid;

ALTER TABLE community_proposals ADD CONSTRAINT law_type_valid CHECK (
  law_type IN (
    'DECLARE_WAR',
    'PROPOSE_HEIR',
    'CHANGE_GOVERNANCE',
    'MESSAGE_OF_THE_DAY',
    'WORK_TAX',
    'IMPORT_TARIFF',
    'CFC_ALLIANCE'
  )
);

-- Migration 3: Manual resolve function
-- From: 20270207_add_manual_resolve_function.sql
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
    IF v_governance_type = 'monarchy' THEN
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
      v_vote_access_ranks := ARRAY[0, 1, 10];
      
      SELECT COUNT(*) INTO v_eligible_voters
      FROM community_members
      WHERE community_id = v_proposal.community_id
        AND rank_tier = ANY(v_vote_access_ranks);
      
      IF v_yes_votes > (v_eligible_voters / 2.0) THEN
        v_should_pass := TRUE;
      ELSIF v_no_votes >= (v_eligible_voters - (v_eligible_voters / 2.0)) THEN
        v_should_reject := TRUE;
      END IF;
    END IF;

    -- Take action if decisive
    IF v_should_pass THEN
      UPDATE community_proposals
      SET 
        status = 'passed',
        resolved_at = NOW(),
        resolution_notes = 'Manually resolved - Decisive vote detected'
      WHERE id = v_proposal.id;

      RETURN QUERY SELECT 
        v_proposal.id,
        v_proposal.law_type,
        v_community_name,
        'PASSED'::TEXT,
        format('YES votes: %s, NO votes: %s', v_yes_votes, v_no_votes);

    ELSIF v_should_reject THEN
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

GRANT EXECUTE ON FUNCTION manually_resolve_all_pending_proposals() TO authenticated;

-- ============================================================================
-- TEST: View all pending proposals
-- ============================================================================
SELECT 
  cp.id,
  cp.law_type,
  c.name AS community,
  c.governance_type,
  cp.status,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'yes') AS yes_votes,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'no') AS no_votes,
  cp.expires_at,
  CASE 
    WHEN cp.expires_at <= NOW() THEN 'EXPIRED'
    WHEN c.governance_type = 'monarchy' AND EXISTS(
      SELECT 1 FROM proposal_votes pv 
      JOIN community_members cm ON cm.user_id = pv.user_id AND cm.community_id = cp.community_id
      WHERE pv.proposal_id = cp.id AND cm.rank_tier = 0
    ) THEN 'HAS KING VOTE'
    ELSE 'WAITING'
  END AS vote_status
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.status = 'pending'
ORDER BY cp.created_at DESC;

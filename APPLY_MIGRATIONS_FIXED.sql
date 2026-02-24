-- ============================================================================
-- APPLY ALL PENDING LAW MIGRATIONS - FIXED VERSION
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================================================

-- Migration 1: Add announcement columns to communities
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS announcement_title TEXT,
ADD COLUMN IF NOT EXISTS announcement_content TEXT,
ADD COLUMN IF NOT EXISTS announcement_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_communities_announcement_updated 
ON communities(announcement_updated_at DESC) 
WHERE announcement_content IS NOT NULL;

-- Migration 2: Add new law types to constraint
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
-- DROP the old function first if it exists
DROP FUNCTION IF EXISTS manually_resolve_all_pending_proposals();

-- Create the new version
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
  v_community_name TEXT;
BEGIN
  FOR v_proposal IN
    SELECT cp.id, cp.community_id, cp.law_type, cp.metadata, cp.proposer_id
    FROM community_proposals cp
    WHERE cp.status = 'pending'
  LOOP
    SELECT c.governance_type, c.name INTO v_governance_type, v_community_name
    FROM communities c WHERE c.id = v_proposal.community_id;

    SELECT
      COUNT(*) FILTER (WHERE vote = 'yes'),
      COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes WHERE proposal_id = v_proposal.id;

    -- Monarchy: King's vote is decisive
    IF v_governance_type = 'monarchy' AND v_yes_votes >= 1 THEN
      UPDATE community_proposals
      SET status = 'passed', resolved_at = NOW(),
          resolution_notes = 'Manually resolved - King voted YES'
      WHERE id = v_proposal.id;

      RETURN QUERY SELECT 
        v_proposal.id, v_proposal.law_type, v_community_name,
        'PASSED'::TEXT, format('YES: %s, NO: %s', v_yes_votes, v_no_votes);
        
    ELSIF v_governance_type = 'monarchy' AND v_no_votes >= 1 THEN
      UPDATE community_proposals
      SET status = 'rejected', resolved_at = NOW(),
          resolution_notes = 'Manually resolved - King voted NO'
      WHERE id = v_proposal.id;

      RETURN QUERY SELECT 
        v_proposal.id, v_proposal.law_type, v_community_name,
        'REJECTED'::TEXT, format('YES: %s, NO: %s', v_yes_votes, v_no_votes);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION manually_resolve_all_pending_proposals() TO authenticated;

-- ============================================================================
-- Now run the function to resolve stuck proposals
-- ============================================================================
SELECT * FROM manually_resolve_all_pending_proposals();

-- ============================================================================
-- View results
-- ============================================================================
SELECT 
  cp.id,
  cp.law_type,
  c.name AS community,
  cp.status,
  cp.resolved_at,
  cp.resolution_notes,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'yes') AS yes_votes,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'no') AS no_votes
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.resolved_at IS NOT NULL
  AND cp.resolved_at > NOW() - INTERVAL '1 hour'
ORDER BY cp.resolved_at DESC;

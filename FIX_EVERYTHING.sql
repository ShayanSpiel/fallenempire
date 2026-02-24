-- ============================================================================
-- ONE SIMPLE FIX FOR EVERYTHING
-- ============================================================================

-- 1. Add missing columns
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS announcement_title TEXT,
ADD COLUMN IF NOT EXISTS announcement_content TEXT,
ADD COLUMN IF NOT EXISTS announcement_updated_at TIMESTAMPTZ;

-- 2. Fix law types constraint
ALTER TABLE community_proposals DROP CONSTRAINT IF EXISTS law_type_valid;
ALTER TABLE community_proposals ADD CONSTRAINT law_type_valid CHECK (
  law_type IN ('DECLARE_WAR', 'PROPOSE_HEIR', 'CHANGE_GOVERNANCE', 
               'MESSAGE_OF_THE_DAY', 'WORK_TAX', 'IMPORT_TARIFF', 'CFC_ALLIANCE')
);

-- 3. Fix cron function to use communities table
CREATE OR REPLACE FUNCTION resolve_expired_proposals()
RETURNS TABLE(processed_count INTEGER, passed_count INTEGER, rejected_count INTEGER, expired_count INTEGER) AS $$
DECLARE
  v_proposal RECORD;
  v_yes_votes INTEGER;
  v_no_votes INTEGER;
  v_passes BOOLEAN;
  v_processed INTEGER := 0;
  v_passed INTEGER := 0;
  v_rejected INTEGER := 0;
  v_expired INTEGER := 0;
  v_has_votes BOOLEAN;
BEGIN
  FOR v_proposal IN
    SELECT id, community_id, law_type, metadata, proposer_id
    FROM community_proposals
    WHERE status = 'pending' AND expires_at <= NOW()
  LOOP
    v_processed := v_processed + 1;

    SELECT COUNT(*) FILTER (WHERE vote = 'yes'), COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes WHERE proposal_votes.proposal_id = v_proposal.id;

    v_has_votes := (v_yes_votes > 0 OR v_no_votes > 0);
    v_passes := v_yes_votes > v_no_votes;

    IF v_passes THEN
      v_passed := v_passed + 1;
      UPDATE community_proposals SET status = 'passed', resolved_at = NOW() WHERE id = v_proposal.id;

      -- Execute laws
      IF v_proposal.law_type = 'MESSAGE_OF_THE_DAY' THEN
        UPDATE communities SET
          announcement_title = COALESCE(v_proposal.metadata->>'title', 'Community Message'),
          announcement_content = COALESCE(v_proposal.metadata->>'content', v_proposal.metadata->>'message'),
          announcement_updated_at = NOW()
        WHERE id = v_proposal.community_id;
      END IF;
    ELSIF v_has_votes THEN
      v_rejected := v_rejected + 1;
      UPDATE community_proposals SET status = 'rejected', resolved_at = NOW() WHERE id = v_proposal.id;
    ELSE
      v_expired := v_expired + 1;
      UPDATE community_proposals SET status = 'expired', resolved_at = NOW() WHERE id = v_proposal.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_passed, v_rejected, v_expired;
END;
$$ LANGUAGE plpgsql;

-- 4. Resolve stuck proposals NOW
DO $$
DECLARE
  v_proposal RECORD;
  v_yes_votes INTEGER;
  v_no_votes INTEGER;
BEGIN
  FOR v_proposal IN
    SELECT cp.id, cp.community_id, cp.law_type
    FROM community_proposals cp
    JOIN communities c ON c.id = cp.community_id
    WHERE cp.status = 'pending' AND c.governance_type = 'monarchy'
  LOOP
    SELECT COUNT(*) FILTER (WHERE vote = 'yes'), COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes WHERE proposal_votes.proposal_id = v_proposal.id;

    IF v_yes_votes >= 1 THEN
      UPDATE community_proposals SET status = 'passed', resolved_at = NOW() WHERE id = v_proposal.id;
    ELSIF v_no_votes >= 1 THEN
      UPDATE community_proposals SET status = 'rejected', resolved_at = NOW() WHERE id = v_proposal.id;
    END IF;
  END LOOP;
END $$;

-- 5. Show what got fixed
SELECT cp.law_type, c.name, cp.status, cp.resolved_at
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.resolved_at > NOW() - INTERVAL '1 minute'
ORDER BY cp.resolved_at DESC;

-- Import Tariff and Alliance System
-- Enables communities to set import tariffs and form mutual alliances (CFC)

-- ============================================================================
-- 1. Import Tariff Rate
-- ============================================================================

-- Add import tariff rate to communities (percentage as decimal, e.g., 0.10 = 10%)
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS import_tariff_rate NUMERIC DEFAULT 0 CHECK (import_tariff_rate >= 0 AND import_tariff_rate <= 1);

COMMENT ON COLUMN communities.import_tariff_rate IS 'Import tariff rate as decimal (0.10 = 10%). Applied when buyers from other communities purchase in this community''s market.';

-- ============================================================================
-- 2. Community Alliances (Combined Front Contract)
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_alliances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Initiating community (proposed the alliance)
  initiator_community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Target community (must accept to activate alliance)
  target_community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  -- Alliance status
  status TEXT NOT NULL DEFAULT 'pending_target_approval' CHECK (
    status IN (
      'pending_target_approval',  -- Waiting for target community to accept
      'active',                    -- Both sides accepted, alliance is active
      'rejected',                  -- Target community rejected
      'cancelled'                  -- Initiator cancelled before acceptance
    )
  ),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Metadata for proposal IDs tracking
  initiator_proposal_id UUID REFERENCES community_proposals(id) ON DELETE SET NULL,
  target_proposal_id UUID REFERENCES community_proposals(id) ON DELETE SET NULL,

  -- Prevent duplicate alliances
  CONSTRAINT unique_alliance_pair UNIQUE(initiator_community_id, target_community_id),

  -- Prevent self-alliances
  CONSTRAINT no_self_alliance CHECK (initiator_community_id != target_community_id)
);

CREATE INDEX IF NOT EXISTS idx_community_alliances_initiator ON community_alliances(initiator_community_id);
CREATE INDEX IF NOT EXISTS idx_community_alliances_target ON community_alliances(target_community_id);
CREATE INDEX IF NOT EXISTS idx_community_alliances_status ON community_alliances(status);
CREATE INDEX IF NOT EXISTS idx_community_alliances_active ON community_alliances(initiator_community_id, target_community_id) WHERE status = 'active';

COMMENT ON TABLE community_alliances IS 'Combined Front Contract (CFC) system. Alliances require mutual approval from both communities. Active alliances allow members to fight in ally battles from home.';

-- ============================================================================
-- 3. Helper Function: Get Active Allies for a Community
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_allies(p_community_id UUID)
RETURNS TABLE (
  ally_community_id UUID,
  ally_community_name TEXT,
  ally_community_slug TEXT,
  alliance_activated_at TIMESTAMPTZ,
  alliance_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN ca.initiator_community_id = p_community_id THEN ca.target_community_id
      ELSE ca.initiator_community_id
    END AS ally_community_id,
    CASE
      WHEN ca.initiator_community_id = p_community_id THEN tc.name
      ELSE ic.name
    END AS ally_community_name,
    CASE
      WHEN ca.initiator_community_id = p_community_id THEN tc.slug
      ELSE ic.slug
    END AS ally_community_slug,
    ca.activated_at AS alliance_activated_at,
    ca.id AS alliance_id
  FROM community_alliances ca
  LEFT JOIN communities ic ON ca.initiator_community_id = ic.id
  LEFT JOIN communities tc ON ca.target_community_id = tc.id
  WHERE
    ca.status = 'active'
    AND (ca.initiator_community_id = p_community_id OR ca.target_community_id = p_community_id)
  ORDER BY ca.activated_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_active_allies IS 'Returns all active allies for a given community. Works bidirectionally (both initiator and target alliances).';

-- ============================================================================
-- 4. Helper Function: Check if Communities are Allies
-- ============================================================================

CREATE OR REPLACE FUNCTION are_communities_allied(
  p_community_id_1 UUID,
  p_community_id_2 UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM community_alliances
    WHERE status = 'active'
      AND (
        (initiator_community_id = p_community_id_1 AND target_community_id = p_community_id_2)
        OR (initiator_community_id = p_community_id_2 AND target_community_id = p_community_id_1)
      )
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION are_communities_allied IS 'Check if two communities have an active alliance (CFC). Returns true if allied, false otherwise.';

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

ALTER TABLE community_alliances ENABLE ROW LEVEL SECURITY;

-- Anyone can view active alliances
DROP POLICY IF EXISTS "community_alliances_select_all" ON community_alliances;
CREATE POLICY "community_alliances_select_all" ON community_alliances
  FOR SELECT
  USING (true);

-- Only allow inserts through law execution (via SECURITY DEFINER functions)
DROP POLICY IF EXISTS "community_alliances_insert_admin" ON community_alliances;
CREATE POLICY "community_alliances_insert_admin" ON community_alliances
  FOR INSERT
  WITH CHECK (false);  -- All inserts must go through RPC functions

-- Only allow updates through law execution
DROP POLICY IF EXISTS "community_alliances_update_admin" ON community_alliances;
CREATE POLICY "community_alliances_update_admin" ON community_alliances
  FOR UPDATE
  USING (false);  -- All updates must go through RPC functions

-- ============================================================================
-- 6. Grants
-- ============================================================================

GRANT SELECT ON community_alliances TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_allies TO authenticated;
GRANT EXECUTE ON FUNCTION are_communities_allied TO authenticated;

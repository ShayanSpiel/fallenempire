-- Add capital_hex_id to communities table
ALTER TABLE communities
ADD COLUMN capital_hex_id TEXT REFERENCES world_regions(hex_id) ON DELETE SET NULL;

-- Add index for faster capital lookups
CREATE INDEX idx_communities_capital_hex ON communities(capital_hex_id);

-- Add comment
COMMENT ON COLUMN communities.capital_hex_id IS 'The hex ID of the community capital city (first claimed region)';

-- Update existing communities to set their first region as capital (if they have regions)
-- Since world_regions doesn't have created_at, we'll just pick the first region by hex_id
UPDATE communities c
SET capital_hex_id = (
  SELECT wr.hex_id
  FROM world_regions wr
  WHERE wr.owner_community_id = c.id
  ORDER BY wr.hex_id ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM world_regions WHERE owner_community_id = c.id
);

-- Create or replace the claim_region_unopposed function to handle capital designation
CREATE OR REPLACE FUNCTION claim_region_unopposed(
  p_community_id UUID,
  p_target_hex_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_owner_id UUID;
  v_is_first_claim BOOLEAN;
BEGIN
  -- Check if this is the community's first claim
  SELECT NOT EXISTS (
    SELECT 1 FROM world_regions WHERE owner_community_id = p_community_id
  ) INTO v_is_first_claim;

  -- Check current owner
  SELECT owner_community_id INTO v_current_owner_id
  FROM world_regions
  WHERE hex_id = p_target_hex_id;

  -- If unclaimed (owner is null), allow claim
  IF v_current_owner_id IS NULL THEN
    -- Update the region
    UPDATE world_regions
    SET owner_community_id = p_community_id
    WHERE hex_id = p_target_hex_id;

    -- If this is the first claim, set it as capital
    IF v_is_first_claim THEN
      UPDATE communities
      SET
        capital_hex_id = p_target_hex_id,
        updated_at = NOW()
      WHERE id = p_community_id;
    END IF;

    RETURN p_target_hex_id;
  ELSE
    RAISE EXCEPTION 'Region is already claimed by another community';
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION claim_region_unopposed TO authenticated;

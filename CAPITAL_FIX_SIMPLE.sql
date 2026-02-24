-- Drop and recreate the function to ensure clean state
DROP FUNCTION IF EXISTS claim_region_unopposed(UUID, TEXT);

CREATE FUNCTION claim_region_unopposed(
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
    -- Update the region (without updated_at which doesn't exist)
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

GRANT EXECUTE ON FUNCTION claim_region_unopposed(UUID, TEXT) TO authenticated;

-- ============================================================================
-- HEX RESOURCE BONUSES SYSTEM
-- Procedural resource distribution based on geography and biome
-- ============================================================================

-- Get resource bonuses for a specific hex
-- This is a wrapper RPC that will be computed client-side via TypeScript
-- We just need to expose hex data for calculations

CREATE OR REPLACE FUNCTION get_hex_resource_data(p_hex_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_region world_regions%ROWTYPE;
BEGIN
  -- Get hex/region data
  SELECT * INTO v_region FROM world_regions WHERE hex_id = p_hex_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'hex_id', p_hex_id,
      'exists', false
    );
  END IF;

  -- Return hex data needed for resource calculation
  -- (Calculation happens client-side using hex-resource-distribution.ts)
  RETURN jsonb_build_object(
    'hex_id', v_region.hex_id,
    'exists', true,
    'owner_community_id', v_region.owner_community_id,
    'fortification_level', v_region.fortification_level,
    'resource_yield', v_region.resource_yield,
    'last_conquered_at', v_region.last_conquered_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all regions owned by a community with their data
CREATE OR REPLACE FUNCTION get_community_regions_with_data(p_community_id UUID)
RETURNS TABLE (
  hex_id TEXT,
  fortification_level INT,
  resource_yield INT,
  last_conquered_at TIMESTAMPTZ,
  region_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wr.hex_id,
    wr.fortification_level,
    wr.resource_yield,
    wr.last_conquered_at,
    COALESCE(wr.custom_name, 'Sector ' || wr.hex_id) as region_name
  FROM world_regions wr
  WHERE wr.owner_community_id = p_community_id
  ORDER BY wr.last_conquered_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total region count for a community
CREATE OR REPLACE FUNCTION get_community_region_count(p_community_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM world_regions
  WHERE owner_community_id = p_community_id;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add custom_name column to world_regions if it doesn't exist
ALTER TABLE world_regions
  ADD COLUMN IF NOT EXISTS custom_name TEXT;

-- Create index for faster community region lookups
CREATE INDEX IF NOT EXISTS idx_world_regions_owner_community
  ON world_regions(owner_community_id)
  WHERE owner_community_id IS NOT NULL;

COMMENT ON FUNCTION get_hex_resource_data IS 'Get hex data for resource bonus calculations (computed client-side)';
COMMENT ON FUNCTION get_community_regions_with_data IS 'Get all regions owned by a community with their metadata';
COMMENT ON FUNCTION get_community_region_count IS 'Get total count of regions owned by a community';

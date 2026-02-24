-- Fix region names to use "Region" instead of "Sector"

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
    COALESCE(wr.custom_name, 'Region ' || wr.hex_id) as region_name
  FROM world_regions wr
  WHERE wr.owner_community_id = p_community_id
  ORDER BY wr.last_conquered_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

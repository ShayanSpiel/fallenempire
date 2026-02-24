-- Get Travel Destinations RPC Function
-- Provides all searchable destinations for the quick travel feature

-- ============================================================================
-- Drop existing function if it exists (to update return type)
-- ============================================================================
DROP FUNCTION IF EXISTS get_travel_destinations();

-- ============================================================================
-- Create new function with enhanced return type
-- ============================================================================

CREATE FUNCTION get_travel_destinations()
RETURNS TABLE (
  hex_id TEXT,
  province_name TEXT,
  custom_name TEXT,
  community_name TEXT,
  owner_community_id UUID,
  display_name TEXT,
  searchable_text TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wr.hex_id,
    wr.province_name,
    wr.custom_name,
    c.name AS community_name,
    wr.owner_community_id,
    -- Display name format: "Country • CustomName • Community" or "Country • Community"
    CASE
      WHEN wr.custom_name IS NOT NULL AND c.name IS NOT NULL THEN
        wr.province_name || ' • ' || wr.custom_name || ' • ' || c.name
      WHEN wr.custom_name IS NOT NULL THEN
        wr.province_name || ' • ' || wr.custom_name
      WHEN c.name IS NOT NULL THEN
        wr.province_name || ' • ' || c.name
      ELSE
        wr.province_name
    END AS display_name,
    -- Searchable text combines all components for full-text search
    LOWER(
      COALESCE(wr.province_name, '') || ' ' ||
      COALESCE(wr.custom_name, '') || ' ' ||
      COALESCE(c.name, '') || ' ' ||
      COALESCE(wr.hex_id, '')
    ) AS searchable_text
  FROM world_regions wr
  LEFT JOIN communities c ON wr.owner_community_id = c.id
  ORDER BY wr.province_name, wr.hex_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_travel_destinations() TO public;
GRANT EXECUTE ON FUNCTION get_travel_destinations() TO authenticated;

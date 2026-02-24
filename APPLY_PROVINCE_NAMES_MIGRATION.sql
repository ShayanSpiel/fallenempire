-- =====================================================
-- PROVINCE NAMES MIGRATION - Apply this to fix #1234 issue
-- =====================================================
-- This migration fixes the issue where companies, battles, and regions
-- only show "#1234" instead of proper province names.
--
-- Run this in Supabase SQL Editor to apply all changes at once.
-- =====================================================

-- STEP 1: Add province_name column for caching geocoded location names
ALTER TABLE world_regions
ADD COLUMN IF NOT EXISTS province_name TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_world_regions_province_name
ON world_regions(province_name)
WHERE province_name IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN world_regions.province_name IS
'Cached province/state name from geocoding (e.g., "Tehran Province").
This is the default fallback when custom_name is null.
Populated by geocoding script.';

-- STEP 2: Update RPC function to return both custom_name AND province_name
-- Drop the old function first (required when changing return type)
DROP FUNCTION IF EXISTS get_community_regions_with_data(UUID);

-- Recreate get_community_regions_with_data to return both names
CREATE FUNCTION get_community_regions_with_data(p_community_id UUID)
RETURNS TABLE (
  hex_id TEXT,
  fortification_level INT,
  resource_yield INT,
  last_conquered_at TIMESTAMPTZ,
  custom_name TEXT,
  province_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wr.hex_id,
    wr.fortification_level,
    wr.resource_yield,
    wr.last_conquered_at,
    wr.custom_name,
    wr.province_name
  FROM world_regions wr
  WHERE wr.owner_community_id = p_community_id
  ORDER BY wr.last_conquered_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_community_regions_with_data IS 'Get all regions owned by a community with custom_name and cached province_name.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- What this does:
-- 1. Adds province_name column for geocoded names
-- 2. Updates RPC functions to return both names
--
-- After applying this:
-- - Run backfill script to populate province names
-- - Companies will show "Tehran Province #1234" instead of just "#1234"
-- - Battles will show proper province names
-- - Community regions will show proper names
--
-- Display priority: custom_name → province_name → hex_id
-- =====================================================

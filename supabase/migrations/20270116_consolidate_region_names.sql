-- Consolidate region_name and custom_name into just custom_name
-- Migration to standardize region naming in world_regions table

-- Copy any existing region_name data to custom_name if custom_name is null
UPDATE world_regions
SET custom_name = region_name
WHERE custom_name IS NULL AND region_name IS NOT NULL;

-- Drop the redundant region_name column
ALTER TABLE world_regions
DROP COLUMN IF EXISTS region_name;

-- Add comment to custom_name column for clarity
COMMENT ON COLUMN world_regions.custom_name IS 'Custom region name set by community leader. Falls back to geocoded province name in UI if null.';

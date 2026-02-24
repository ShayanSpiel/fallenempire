-- Add province_name column to world_regions for caching geocoded location names
-- This improves performance by avoiding repeated geocoding API calls

-- Add the column
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
Populated by client-side geocoding on hex initialization.';

-- Note: Backfilling should be done via a script that:
-- 1. Loads hex coordinates
-- 2. Runs geocoding logic (same as hex-map.tsx)
-- 3. Updates province_name for each hex
-- This is too expensive to run in a migration

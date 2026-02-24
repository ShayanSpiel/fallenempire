-- Apply this SQL directly to add province_name column
-- Run this in Supabase SQL Editor or via migration

-- Add province_name column
ALTER TABLE world_regions
ADD COLUMN IF NOT EXISTS province_name TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_world_regions_province_name
ON world_regions(province_name)
WHERE province_name IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'world_regions'
AND column_name = 'province_name';

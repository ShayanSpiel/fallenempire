-- Add location name columns to world_regions table
-- This fixes the issue where locations were showing hex IDs instead of names

-- Add columns for custom names and province names
ALTER TABLE world_regions
ADD COLUMN IF NOT EXISTS custom_name TEXT,
ADD COLUMN IF NOT EXISTS province_name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_world_regions_names ON world_regions(custom_name, province_name);

-- Set default province names based on hex coordinates
-- This provides fallback names when custom_name is not set
UPDATE world_regions
SET province_name = CASE
  WHEN province_name IS NULL OR province_name = '' THEN 'Region ' || hex_id
  ELSE province_name
END;

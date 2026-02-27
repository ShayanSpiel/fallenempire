-- Add display_name column to world_regions for single source of truth
-- This column will ALWAYS have a value and eliminates the need for fallback logic everywhere

-- Add display_name column
ALTER TABLE world_regions
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create function to compute display name
CREATE OR REPLACE FUNCTION compute_region_display_name(
  p_custom_name TEXT,
  p_province_name TEXT,
  p_hex_id TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    NULLIF(TRIM(p_custom_name), ''),
    NULLIF(TRIM(p_province_name), ''),
    'Region ' || p_hex_id
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Populate display_name for all existing regions
UPDATE world_regions
SET display_name = compute_region_display_name(custom_name, province_name, hex_id);

-- Add NOT NULL constraint to ensure display_name is always populated
ALTER TABLE world_regions
ALTER COLUMN display_name SET NOT NULL;

-- Create trigger to automatically update display_name when custom_name or province_name changes
CREATE OR REPLACE FUNCTION update_region_display_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.display_name := compute_region_display_name(NEW.custom_name, NEW.province_name, NEW.hex_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_region_display_name ON world_regions;
CREATE TRIGGER trigger_update_region_display_name
  BEFORE INSERT OR UPDATE OF custom_name, province_name
  ON world_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_region_display_name();

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_world_regions_display_name ON world_regions(display_name);

COMMENT ON COLUMN world_regions.display_name IS 'Single source of truth for region display name. Automatically computed from custom_name -> province_name -> hex_id fallback. Always non-null.';

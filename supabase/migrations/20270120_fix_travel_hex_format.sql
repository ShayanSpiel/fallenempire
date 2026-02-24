-- Fix travel system to use correct hex ID format (row-col instead of q,r)

-- Update the calculate_hex_distance function to use offset coordinates
CREATE OR REPLACE FUNCTION calculate_hex_distance(hex1 TEXT, hex2 TEXT)
RETURNS INTEGER AS $$
DECLARE
  row1 INTEGER;
  col1 INTEGER;
  row2 INTEGER;
  col2 INTEGER;
  q1 INTEGER;
  r1 INTEGER;
  q2 INTEGER;
  r2 INTEGER;
  s1 INTEGER;
  s2 INTEGER;
BEGIN
  -- Parse coordinates from format "row-col"
  row1 := SPLIT_PART(hex1, '-', 1)::INTEGER;
  col1 := SPLIT_PART(hex1, '-', 2)::INTEGER;
  row2 := SPLIT_PART(hex2, '-', 1)::INTEGER;
  col2 := SPLIT_PART(hex2, '-', 2)::INTEGER;

  -- Convert offset coordinates to cube coordinates (odd-r offset system)
  q1 := col1 - FLOOR(row1::NUMERIC / 2)::INTEGER;
  r1 := row1;
  q2 := col2 - FLOOR(row2::NUMERIC / 2)::INTEGER;
  r2 := row2;

  -- Calculate s coordinate (q + r + s = 0)
  s1 := -q1 - r1;
  s2 := -q2 - r2;

  -- Calculate distance using cube coordinates
  RETURN (ABS(q1 - q2) + ABS(r1 - r2) + ABS(s1 - s2)) / 2;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION calculate_hex_distance(TEXT, TEXT) TO authenticated;

-- Fix get_user_location to use world_regions instead of regions
CREATE OR REPLACE FUNCTION get_user_location(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_hex TEXT;
  v_region RECORD;
  v_display_name TEXT;
BEGIN
  SELECT current_hex INTO v_current_hex
  FROM users
  WHERE id = p_user_id;

  IF v_current_hex IS NULL THEN
    RETURN jsonb_build_object(
      'has_location', false,
      'message', 'No location set'
    );
  END IF;

  SELECT
    hex_id as id,
    custom_name,
    province_name,
    owner_community_id
  INTO v_region
  FROM world_regions
  WHERE hex_id = v_current_hex;

  IF v_region IS NULL THEN
    RETURN jsonb_build_object(
      'has_location', true,
      'hex_id', v_current_hex,
      'custom_name', v_current_hex
    );
  END IF;

  v_display_name := COALESCE(v_region.custom_name, v_region.province_name, v_current_hex);

  RETURN jsonb_build_object(
    'has_location', true,
    'hex_id', v_current_hex,
    'custom_name', v_display_name,
    'province_name', v_region.province_name,
    'owner_community_id', v_region.owner_community_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_location(UUID) TO authenticated;

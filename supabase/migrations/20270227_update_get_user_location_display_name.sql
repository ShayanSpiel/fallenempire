-- Update get_user_location to return display_name
CREATE OR REPLACE FUNCTION get_user_location(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_hex TEXT;
  v_region RECORD;
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
    hex_id,
    custom_name,
    province_name,
    display_name,
    owner_community_id
  INTO v_region
  FROM world_regions
  WHERE hex_id = v_current_hex;

  IF v_region IS NULL THEN
    RETURN jsonb_build_object(
      'has_location', true,
      'hex_id', v_current_hex,
      'custom_name', NULL,
      'province_name', NULL,
      'display_name', 'Region ' || v_current_hex
    );
  END IF;

  -- Return all fields including display_name (SINGLE SOURCE OF TRUTH)
  RETURN jsonb_build_object(
    'has_location', true,
    'hex_id', v_current_hex,
    'custom_name', v_region.custom_name,
    'province_name', v_region.province_name,
    'display_name', v_region.display_name,
    'owner_community_id', v_region.owner_community_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

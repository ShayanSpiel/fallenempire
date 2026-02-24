-- Travel System Migration
-- Adds location tracking to users and travel mechanics

-- ============================================================================
-- Add current_hex column to users table
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_hex TEXT;

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_users_current_hex ON users(current_hex);

-- ============================================================================
-- Add travel-related functions
-- ============================================================================

-- Function to calculate hex distance (using cube coordinates)
-- Hex coordinates are in the format "row-col" where row and column are offset coordinates
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

  -- Convert odd-r offset coordinates to cube coordinates
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

-- Function to travel to a new hex
CREATE OR REPLACE FUNCTION travel_to_hex(
  p_user_id UUID,
  p_destination_hex TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_current_hex TEXT;
  v_distance INTEGER;
  v_tickets_needed INTEGER;
  v_ticket_resource_id UUID;
  v_common_quality_id UUID;
  v_current_tickets NUMERIC;
BEGIN
  -- Get current location
  SELECT current_hex INTO v_current_hex
  FROM users
  WHERE id = p_user_id;

  -- If user has no current location, set it to destination (first-time travel is free)
  IF v_current_hex IS NULL THEN
    UPDATE users
    SET current_hex = p_destination_hex
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Welcome! Your starting location has been set.',
      'current_hex', p_destination_hex,
      'tickets_used', 0
    );
  END IF;

  -- Calculate distance
  v_distance := calculate_hex_distance(v_current_hex, p_destination_hex);

  -- Calculate tickets needed (1 ticket per 30 hexes, rounded up)
  v_tickets_needed := CEILING(v_distance::NUMERIC / 30);

  -- If traveling to same hex, no tickets needed
  IF v_distance = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You are already at this location'
    );
  END IF;

  -- Get ticket resource and quality IDs
  SELECT id INTO v_ticket_resource_id FROM resources WHERE key = 'ticket';
  SELECT id INTO v_common_quality_id FROM resource_qualities WHERE key = 'common';

  IF v_ticket_resource_id IS NULL OR v_common_quality_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Travel ticket resource not found in system'
    );
  END IF;

  -- Check if user has enough tickets
  SELECT COALESCE(quantity, 0) INTO v_current_tickets
  FROM user_inventory
  WHERE user_id = p_user_id
    AND resource_id = v_ticket_resource_id
    AND quality_id = v_common_quality_id;

  IF v_current_tickets < v_tickets_needed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient travel tickets',
      'required', v_tickets_needed,
      'available', v_current_tickets,
      'distance', v_distance
    );
  END IF;

  -- Consume tickets
  UPDATE user_inventory
  SET quantity = quantity - v_tickets_needed,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND resource_id = v_ticket_resource_id
    AND quality_id = v_common_quality_id;

  -- Update user location
  UPDATE users
  SET current_hex = p_destination_hex
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Travel successful!',
    'previous_hex', v_current_hex,
    'current_hex', p_destination_hex,
    'distance', v_distance,
    'tickets_used', v_tickets_needed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is in a specific community's territory
CREATE OR REPLACE FUNCTION is_user_in_community_territory(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_hex TEXT;
  v_hex_community_id UUID;
BEGIN
  -- Get user's current hex
  SELECT current_hex INTO v_current_hex
  FROM users
  WHERE id = p_user_id;

  -- If no current hex, return false
  IF v_current_hex IS NULL THEN
    RETURN false;
  END IF;

  -- Check if current hex belongs to the community
  SELECT owner_community_id INTO v_hex_community_id
  FROM world_regions
  WHERE hex_id = v_current_hex;

  RETURN v_hex_community_id = p_community_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is on a specific hex
CREATE OR REPLACE FUNCTION is_user_on_hex(
  p_user_id UUID,
  p_hex_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_hex TEXT;
BEGIN
  SELECT current_hex INTO v_current_hex
  FROM users
  WHERE id = p_user_id;

  RETURN v_current_hex = p_hex_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current region info
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
    hex_id,
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

-- ============================================================================
-- Market Trading Restrictions
-- ============================================================================

-- Add location and currency check to purchase_product_listing
-- This creates a wrapper function that checks location and community membership
CREATE OR REPLACE FUNCTION purchase_product_with_location_check(
  p_buyer_id UUID,
  p_listing_id UUID,
  p_quantity NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_listing RECORD;
  v_is_in_territory BOOLEAN;
  v_has_community_membership BOOLEAN;
BEGIN
  -- Get listing details
  SELECT
    l.community_id,
    l.price_per_unit_community_coin
  INTO v_listing
  FROM market_listings l
  WHERE l.id = p_listing_id
  AND l.status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found or inactive');
  END IF;

  -- Check if user is in the community's territory
  SELECT is_user_in_community_territory(p_buyer_id, v_listing.community_id)
  INTO v_is_in_territory;

  IF NOT v_is_in_territory THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You must be in this community''s territory to purchase from their market'
    );
  END IF;

  -- If payment requires community coin, check if user is a member
  IF v_listing.price_per_unit_community_coin > 0 THEN
    SELECT EXISTS(
      SELECT 1
      FROM community_members
      WHERE user_id = p_buyer_id
      AND community_id = v_listing.community_id
      AND left_at IS NULL
    ) INTO v_has_community_membership;

    IF NOT v_has_community_membership THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You must be a member of this community to use their currency'
      );
    END IF;
  END IF;

  -- Call the original purchase function
  RETURN purchase_product_listing(p_buyer_id, p_listing_id, p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION calculate_hex_distance(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION travel_to_hex(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_in_community_territory(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_on_hex(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_location(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION purchase_product_with_location_check(UUID, UUID, NUMERIC) TO authenticated;

-- ============================================================================
-- Give existing users some travel tickets
-- ============================================================================
DO $$
DECLARE
  v_user RECORD;
  v_ticket_resource_id UUID;
  v_common_quality_id UUID;
BEGIN
  -- Get ticket and quality IDs
  SELECT id INTO v_ticket_resource_id FROM resources WHERE key = 'ticket';
  SELECT id INTO v_common_quality_id FROM resource_qualities WHERE key = 'common';

  -- Give each existing user 5 travel tickets
  FOR v_user IN SELECT id FROM users LOOP
    INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
    VALUES (v_user.id, v_ticket_resource_id, v_common_quality_id, 5)
    ON CONFLICT (user_id, resource_id, quality_id)
    DO UPDATE SET quantity = user_inventory.quantity + 5;
  END LOOP;
END $$;

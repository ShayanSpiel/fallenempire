-- Enforce community currency only in marketplace
-- Remove gold pricing, add location-based access validation

-- ============================================================================
-- 1. UPDATE create_product_listing to require community currency only
-- ============================================================================

CREATE OR REPLACE FUNCTION create_product_listing(
  p_seller_id UUID,
  p_community_id UUID,
  p_resource_id UUID,
  p_quality_id UUID,
  p_quantity NUMERIC,
  p_price_per_unit_gold NUMERIC DEFAULT NULL,
  p_price_per_unit_community_coin NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing_id UUID;
  v_user_has_item BOOLEAN;
  v_inventory_qty NUMERIC := 0;
  v_wilderness_qty NUMERIC := 0;
  v_has_metadata BOOLEAN := false;
  v_seller_hex TEXT;
  v_hex_community_id UUID;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Ensure caller can only create listings for themselves
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_public_user_id <> p_seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get seller's current location
  SELECT current_hex INTO v_seller_hex
  FROM public.users
  WHERE id = p_seller_id;

  IF v_seller_hex IS NULL THEN
    RAISE EXCEPTION 'You must be located in a community''s territory to sell items';
  END IF;

  -- Check if seller is in the community's territory
  SELECT owner_community_id INTO v_hex_community_id
  FROM public.world_regions
  WHERE hex_id = v_seller_hex;

  IF v_hex_community_id IS NULL THEN
    RAISE EXCEPTION 'You must be in a community''s territory to sell items (wilderness not allowed)';
  END IF;

  IF v_hex_community_id <> p_community_id THEN
    RAISE EXCEPTION 'You can only sell items in the community where you are currently located';
  END IF;

  -- ENFORCE: Community currency only (ignore gold parameter)
  IF p_price_per_unit_community_coin IS NULL OR p_price_per_unit_community_coin <= 0 THEN
    RAISE EXCEPTION 'Must specify community currency price (gold not accepted)';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_inventory'
      AND column_name = 'metadata'
  ) INTO v_has_metadata;

  -- Verify user has the item in inventory
  SELECT EXISTS(
    SELECT 1 FROM user_inventory
    WHERE user_id = p_seller_id
      AND resource_id = p_resource_id
      AND quality_id = p_quality_id
      AND quantity >= p_quantity
  ) INTO v_user_has_item;

  IF NOT v_user_has_item THEN
    RAISE EXCEPTION 'Insufficient inventory to create listing';
  END IF;

  -- Block selling wilderness-produced goods (until market licenses exist)
  IF v_has_metadata THEN
    SELECT
      ui.quantity,
      COALESCE((ui.metadata->>'wilderness_qty')::NUMERIC, 0)
    INTO
      v_inventory_qty,
      v_wilderness_qty
    FROM public.user_inventory ui
    WHERE ui.user_id = p_seller_id
      AND ui.resource_id = p_resource_id
      AND ui.quality_id = p_quality_id;

    IF COALESCE(v_inventory_qty, 0) - COALESCE(v_wilderness_qty, 0) < p_quantity THEN
      RAISE EXCEPTION 'Cannot sell wilderness-produced goods without a market license';
    END IF;
  END IF;

  -- Reserve items from inventory (deduct immediately)
  UPDATE user_inventory
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE user_id = p_seller_id
    AND resource_id = p_resource_id
    AND quality_id = p_quality_id;

  -- Create listing with community currency only (set gold to NULL)
  INSERT INTO market_listings (
    listing_type,
    community_id,
    seller_id,
    resource_id,
    quality_id,
    quantity,
    price_per_unit_gold,
    price_per_unit_community_coin,
    expires_at
  ) VALUES (
    'product',
    p_community_id,
    p_seller_id,
    p_resource_id,
    p_quality_id,
    p_quantity,
    NULL, -- Gold not accepted
    p_price_per_unit_community_coin,
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;

-- ============================================================================
-- 2. UPDATE purchase_product to use community currency only + location check
-- ============================================================================

CREATE OR REPLACE FUNCTION purchase_product_with_location_check(
  p_buyer_id UUID,
  p_listing_id UUID,
  p_quantity NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing RECORD;
  v_total_price_cc NUMERIC;
  v_buyer_cc NUMERIC;
  v_tariff NUMERIC := 0;
  v_community_tariff_rate NUMERIC := 0;
  v_community_currency_id UUID;
  v_buyer_hex TEXT;
  v_hex_community_id UUID;
  v_is_member BOOLEAN := false;
  v_has_left_at BOOLEAN := false;
  v_tariff_law_value NUMERIC;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Ensure caller can only purchase as themselves
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_public_user_id <> p_buyer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get buyer's current location
  SELECT current_hex INTO v_buyer_hex
  FROM public.users
  WHERE id = p_buyer_id;

  IF v_buyer_hex IS NULL THEN
    RAISE EXCEPTION 'You must be located in a community''s territory to buy items';
  END IF;

  -- Check if buyer is in any community's territory
  SELECT owner_community_id INTO v_hex_community_id
  FROM public.world_regions
  WHERE hex_id = v_buyer_hex;

  IF v_hex_community_id IS NULL THEN
    RAISE EXCEPTION 'You must be in a community''s territory to buy items (wilderness not allowed)';
  END IF;

  -- Get listing details
  SELECT * INTO v_listing
  FROM market_listings
  WHERE id = p_listing_id
    AND listing_type = 'product'
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found or not active';
  END IF;

  -- Verify buyer is in the same community as the listing
  IF v_hex_community_id <> v_listing.community_id THEN
    RAISE EXCEPTION 'Travel to this community''s territory to purchase items from their market';
  END IF;

  -- Check quantity available
  IF v_listing.quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity available (available: %, requested: %)', v_listing.quantity, p_quantity;
  END IF;

  -- Get community currency ID
  SELECT id INTO v_community_currency_id
  FROM community_currencies
  WHERE community_id = v_listing.community_id;

  IF v_community_currency_id IS NULL THEN
    RAISE EXCEPTION 'Community currency not configured for this community';
  END IF;

  -- Calculate total price in community currency only
  IF v_listing.price_per_unit_community_coin IS NULL OR v_listing.price_per_unit_community_coin <= 0 THEN
    RAISE EXCEPTION 'Invalid listing: community currency price not set';
  END IF;

  v_total_price_cc := v_listing.price_per_unit_community_coin * p_quantity;

  -- Ensure wallets exist
  PERFORM get_or_create_community_wallet(p_buyer_id, v_community_currency_id);
  IF v_listing.seller_id IS NOT NULL THEN
    PERFORM get_or_create_community_wallet(v_listing.seller_id, v_community_currency_id);
  END IF;

  -- Get buyer's community coin balance
  SELECT community_coins INTO v_buyer_cc
  FROM user_wallets
  WHERE user_id = p_buyer_id
    AND currency_type = 'community'
    AND community_currency_id = v_community_currency_id;

  v_buyer_cc := COALESCE(v_buyer_cc, 0);

  IF v_buyer_cc < v_total_price_cc THEN
    RAISE EXCEPTION 'Insufficient community coins (have: %, need: %)', v_buyer_cc, v_total_price_cc;
  END IF;

  -- Check for import tariff law
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_buyer_id
        AND cm.community_id = v_listing.community_id
        AND cm.left_at IS NULL
    ) INTO v_is_member;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_buyer_id
        AND cm.community_id = v_listing.community_id
    ) INTO v_is_member;
  END IF;

  -- Apply import tariff if buyer is not a member
  IF NOT v_is_member THEN
    SELECT COALESCE((law_value::TEXT)::NUMERIC, 0)
    INTO v_tariff_law_value
    FROM active_laws
    WHERE community_id = v_listing.community_id
      AND law_type = 'import_tariff'
    LIMIT 1;

    v_community_tariff_rate := COALESCE(v_tariff_law_value, 0);
    v_tariff := v_total_price_cc * (v_community_tariff_rate / 100);
  END IF;

  -- Transfer community coins from buyer to seller
  UPDATE user_wallets
  SET community_coins = community_coins - (v_total_price_cc + v_tariff),
      updated_at = NOW()
  WHERE user_id = p_buyer_id
    AND currency_type = 'community'
    AND community_currency_id = v_community_currency_id;

  UPDATE user_wallets
  SET community_coins = community_coins + v_total_price_cc,
      updated_at = NOW()
  WHERE user_id = v_listing.seller_id
    AND currency_type = 'community'
    AND community_currency_id = v_community_currency_id;

  -- Transfer tariff to community treasury if applicable
  IF v_tariff > 0 THEN
    PERFORM get_or_create_community_wallet(v_listing.community_id, v_community_currency_id);

    UPDATE user_wallets
    SET community_coins = community_coins + v_tariff,
        updated_at = NOW()
    WHERE user_id = v_listing.community_id
      AND currency_type = 'community'
      AND community_currency_id = v_community_currency_id;

    -- Log tariff transaction
    INSERT INTO currency_transactions (
      from_user_id,
      to_user_id,
      currency_type,
      community_currency_id,
      amount,
      transaction_type,
      description
    ) VALUES (
      p_buyer_id,
      v_listing.community_id,
      'community',
      v_community_currency_id,
      v_tariff,
      'tariff',
      'Import tariff on market purchase'
    );
  END IF;

  -- Transfer items to buyer
  INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
  VALUES (p_buyer_id, v_listing.resource_id, v_listing.quality_id, p_quantity)
  ON CONFLICT (user_id, resource_id, quality_id)
  DO UPDATE SET
    quantity = user_inventory.quantity + p_quantity,
    updated_at = NOW();

  -- Update or close listing
  IF v_listing.quantity = p_quantity THEN
    UPDATE market_listings
    SET status = 'filled',
        updated_at = NOW()
    WHERE id = p_listing_id;
  ELSE
    UPDATE market_listings
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Record trade history
  INSERT INTO trade_history (
    listing_id,
    buyer_id,
    seller_id,
    trade_type,
    amount_transferred,
    trade_tariff_paid
  ) VALUES (
    p_listing_id,
    p_buyer_id,
    v_listing.seller_id,
    'product',
    jsonb_build_object(
      'resource_id', v_listing.resource_id,
      'quality_id', v_listing.quality_id,
      'quantity', p_quantity,
      'community_coin_paid', v_total_price_cc
    ),
    v_tariff
  );

  -- Log market transaction
  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description,
    metadata
  ) VALUES (
    p_buyer_id,
    v_listing.seller_id,
    'community',
    v_community_currency_id,
    v_total_price_cc,
    'market_purchase',
    format('Market purchase: %s (qty: %s)', v_listing.resource_id, p_quantity),
    jsonb_build_object(
      'listing_id', p_listing_id,
      'resource_id', v_listing.resource_id,
      'quality_id', v_listing.quality_id,
      'quantity', p_quantity
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity_purchased', p_quantity,
    'gold_paid', 0,
    'community_coin_paid', v_total_price_cc,
    'tariff_paid', v_tariff
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION purchase_product_with_location_check(UUID, UUID, NUMERIC) TO authenticated;

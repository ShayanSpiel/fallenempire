-- Update purchase_product_listing function to log in currency_transactions
-- This ensures all market purchases are tracked in the single source of truth

CREATE OR REPLACE FUNCTION purchase_product_listing(
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
  v_total_price_gold NUMERIC;
  v_total_price_cc NUMERIC;
  v_buyer_gold NUMERIC;
  v_buyer_cc NUMERIC;
  v_tariff NUMERIC := 0;
  v_community_tariff_rate NUMERIC := 5; -- 5% default
  v_community_currency_id UUID;
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

  -- Check quantity available
  IF v_listing.quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient quantity available (available: %, requested: %)', v_listing.quantity, p_quantity;
  END IF;

  -- Calculate total prices
  v_total_price_gold := COALESCE(v_listing.price_per_unit_gold * p_quantity, 0);
  v_total_price_cc := COALESCE(v_listing.price_per_unit_community_coin * p_quantity, 0);

  -- Ensure wallets exist
  PERFORM get_or_create_gold_wallet(p_buyer_id);
  IF v_listing.seller_id IS NOT NULL THEN
    PERFORM get_or_create_gold_wallet(v_listing.seller_id);
  END IF;

  SELECT id INTO v_community_currency_id
  FROM community_currencies
  WHERE community_id = v_listing.community_id;

  -- Get buyer's gold balance
  SELECT gold_coins INTO v_buyer_gold
  FROM user_wallets
  WHERE user_id = p_buyer_id
    AND currency_type = 'gold';

  v_buyer_gold := COALESCE(v_buyer_gold, 0);

  -- Verify buyer has enough funds
  IF v_total_price_gold > 0 AND v_buyer_gold < v_total_price_gold THEN
    RAISE EXCEPTION 'Insufficient gold coins (have: %, need: %)', v_buyer_gold, v_total_price_gold;
  END IF;

  IF v_total_price_cc > 0 THEN
    IF v_community_currency_id IS NULL THEN
      RAISE EXCEPTION 'Community currency not configured for listing community %', v_listing.community_id;
    END IF;

    PERFORM get_or_create_community_wallet(p_buyer_id, v_community_currency_id);
    IF v_listing.seller_id IS NOT NULL THEN
      PERFORM get_or_create_community_wallet(v_listing.seller_id, v_community_currency_id);
    END IF;

    SELECT community_coins INTO v_buyer_cc
    FROM user_wallets
    WHERE user_id = p_buyer_id
      AND currency_type = 'community'
      AND community_currency_id = v_community_currency_id;

    v_buyer_cc := COALESCE(v_buyer_cc, 0);

    IF v_buyer_cc < v_total_price_cc THEN
      RAISE EXCEPTION 'Insufficient community coins (have: %, need: %)', v_buyer_cc, v_total_price_cc;
    END IF;
  END IF;

  -- Calculate tariff (5% trade tax)
  IF v_total_price_gold > 0 THEN
    v_tariff := v_total_price_gold * (v_community_tariff_rate / 100);
  END IF;

  -- Transfer gold from buyer to seller
  IF v_total_price_gold > 0 THEN
    UPDATE user_wallets
    SET gold_coins = gold_coins - v_total_price_gold,
        updated_at = NOW()
    WHERE user_id = p_buyer_id
      AND currency_type = 'gold';

    UPDATE user_wallets
    SET gold_coins = gold_coins + (v_total_price_gold - v_tariff),
        updated_at = NOW()
    WHERE user_id = v_listing.seller_id
      AND currency_type = 'gold';

    -- **NEW: Log purchase in currency_transactions (buyer perspective)**
    INSERT INTO currency_transactions (
      from_user_id,
      to_user_id,
      currency_type,
      amount,
      transaction_type,
      description,
      metadata,
      scope
    ) VALUES (
      p_buyer_id,
      v_listing.seller_id,
      'gold',
      v_total_price_gold,
      'purchase',
      'Market purchase',
      jsonb_build_object(
        'listing_id', p_listing_id,
        'resource_id', v_listing.resource_id,
        'quality_id', v_listing.quality_id,
        'quantity', p_quantity,
        'unit_price', v_listing.price_per_unit_gold,
        'tariff_paid', v_tariff
      ),
      'personal'
    );

    -- **NEW: Log sale in currency_transactions (seller perspective)**
    INSERT INTO currency_transactions (
      from_user_id,
      to_user_id,
      currency_type,
      amount,
      transaction_type,
      description,
      metadata,
      scope
    ) VALUES (
      p_buyer_id,
      v_listing.seller_id,
      'gold',
      v_total_price_gold - v_tariff,  -- Net amount after tariff
      'sale',
      'Market sale',
      jsonb_build_object(
        'listing_id', p_listing_id,
        'resource_id', v_listing.resource_id,
        'quality_id', v_listing.quality_id,
        'quantity', p_quantity,
        'unit_price', v_listing.price_per_unit_gold,
        'tariff_deducted', v_tariff
      ),
      'personal'
    );
  END IF;

  -- Transfer community coins (if applicable)
  IF v_total_price_cc > 0 THEN
    UPDATE user_wallets
    SET community_coins = community_coins - v_total_price_cc,
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

    -- **NEW: Log community coin purchase**
    INSERT INTO currency_transactions (
      from_user_id,
      to_user_id,
      currency_type,
      community_currency_id,
      amount,
      transaction_type,
      description,
      metadata,
      scope
    ) VALUES (
      p_buyer_id,
      v_listing.seller_id,
      'community',
      v_community_currency_id,
      v_total_price_cc,
      'purchase',
      'Market purchase',
      jsonb_build_object(
        'listing_id', p_listing_id,
        'resource_id', v_listing.resource_id,
        'quality_id', v_listing.quality_id,
        'quantity', p_quantity,
        'unit_price', v_listing.price_per_unit_community_coin
      ),
      'community'
    );

    -- **NEW: Log community coin sale**
    INSERT INTO currency_transactions (
      from_user_id,
      to_user_id,
      currency_type,
      community_currency_id,
      amount,
      transaction_type,
      description,
      metadata,
      scope
    ) VALUES (
      p_buyer_id,
      v_listing.seller_id,
      'community',
      v_community_currency_id,
      v_total_price_cc,
      'sale',
      'Market sale',
      jsonb_build_object(
        'listing_id', p_listing_id,
        'resource_id', v_listing.resource_id,
        'quality_id', v_listing.quality_id,
        'quantity', p_quantity,
        'unit_price', v_listing.price_per_unit_community_coin
      ),
      'community'
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
    -- Fully purchased - close listing
    UPDATE market_listings
    SET status = 'filled',
        updated_at = NOW()
    WHERE id = p_listing_id;
  ELSE
    -- Partially purchased - reduce quantity
    UPDATE market_listings
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_listing_id;
  END IF;

  -- Record trade history (keep existing tracking)
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
      'gold_paid', v_total_price_gold,
      'community_coin_paid', v_total_price_cc
    ),
    v_tariff
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity_purchased', p_quantity,
    'gold_paid', v_total_price_gold,
    'community_coin_paid', v_total_price_cc,
    'tariff_paid', v_tariff
  );
END;
$$;

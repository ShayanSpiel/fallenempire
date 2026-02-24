-- Update Market Purchase Logic to Apply Import Tariff
-- Replaces hardcoded 5% tariff with law-based import_tariff_rate
-- Only applies when buyer is from a different community

-- ============================================================================
-- Update purchase_product_listing Function
-- ============================================================================

DROP FUNCTION IF EXISTS purchase_product_listing(UUID, UUID, NUMERIC);
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
  v_import_tariff_rate NUMERIC := 0;
  v_community_currency_id UUID;
  v_buyer_community_id UUID;
  v_community_treasury_wallet_id UUID;
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

  -- Get buyer's main community
  SELECT main_community_id INTO v_buyer_community_id
  FROM public.users
  WHERE id = p_buyer_id;

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

  -- Calculate import tariff (only if buyer is from different community)
  IF v_total_price_gold > 0 AND v_buyer_community_id IS DISTINCT FROM v_listing.community_id THEN
    -- Get the import tariff rate from the listing's community
    SELECT import_tariff_rate INTO v_import_tariff_rate
    FROM communities
    WHERE id = v_listing.community_id;

    v_import_tariff_rate := COALESCE(v_import_tariff_rate, 0);

    IF v_import_tariff_rate > 0 THEN
      v_tariff := v_total_price_gold * v_import_tariff_rate;

      -- Ensure community treasury wallet exists
      SELECT get_or_create_community_gold_wallet(v_listing.community_id) INTO v_community_treasury_wallet_id;
    END IF;
  END IF;

  -- Transfer gold from buyer to seller (minus tariff)
  IF v_total_price_gold > 0 THEN
    UPDATE user_wallets
    SET gold_coins = gold_coins - v_total_price_gold,
        updated_at = NOW()
    WHERE user_id = p_buyer_id
      AND currency_type = 'gold';

    -- Seller receives payment minus tariff
    UPDATE user_wallets
    SET gold_coins = gold_coins + (v_total_price_gold - v_tariff),
        updated_at = NOW()
    WHERE user_id = v_listing.seller_id
      AND currency_type = 'gold';

    -- Community treasury receives tariff (if applicable)
    IF v_tariff > 0 AND v_community_treasury_wallet_id IS NOT NULL THEN
      UPDATE community_wallets
      SET gold_coins = gold_coins + v_tariff,
          updated_at = NOW()
      WHERE id = v_community_treasury_wallet_id;
    END IF;
  END IF;

  -- Transfer community coins (if applicable, no tariff on community coins)
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
      'gold_paid', v_total_price_gold,
      'community_coin_paid', v_total_price_cc,
      'import_tariff_applied', v_import_tariff_rate > 0
    ),
    v_tariff
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity_purchased', p_quantity,
    'gold_paid', v_total_price_gold,
    'community_coin_paid', v_total_price_cc,
    'tariff_paid', v_tariff,
    'tariff_rate_applied', v_import_tariff_rate
  );
END;
$$;

COMMENT ON FUNCTION purchase_product_listing IS 'Purchase products from market. Applies import tariff when buyer is from different community. Tariff goes to listing community treasury.';

-- ============================================================================
-- Helper Function: Get or Create Community Gold Wallet
-- ============================================================================

CREATE OR REPLACE FUNCTION get_or_create_community_gold_wallet(p_community_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id
  FROM community_wallets
  WHERE community_id = p_community_id
    AND currency_type = 'gold';

  IF v_wallet_id IS NULL THEN
    INSERT INTO community_wallets (community_id, currency_type, gold_coins)
    VALUES (p_community_id, 'gold', 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_or_create_community_gold_wallet IS 'Get existing or create new gold wallet for community treasury';

GRANT EXECUTE ON FUNCTION get_or_create_community_gold_wallet TO authenticated;

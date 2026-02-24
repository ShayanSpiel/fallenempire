-- Enforce location-based access for P2P currency exchange
-- Users must be in community territory to trade that community's currency

-- ============================================================================
-- 1. Helper function to check if user is in community territory
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_in_community_territory(
  p_user_id UUID,
  p_community_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_user_hex TEXT;
  v_hex_community_id UUID;
BEGIN
  -- Get user's current location
  SELECT current_hex INTO v_user_hex
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_hex IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get the community that owns this hex
  SELECT owner_community_id INTO v_hex_community_id
  FROM public.world_regions
  WHERE hex_id = v_user_hex;

  RETURN v_hex_community_id = p_community_id;
END;
$$;

GRANT EXECUTE ON FUNCTION is_user_in_community_territory(UUID, UUID) TO authenticated;

-- ============================================================================
-- 2. UPDATE create_exchange_order to validate location
-- ============================================================================

CREATE OR REPLACE FUNCTION create_exchange_order(
  p_user_id UUID,
  p_community_currency_id UUID,
  p_order_type TEXT,
  p_gold_amount NUMERIC,
  p_currency_amount NUMERIC,
  p_source_account TEXT DEFAULT 'personal'
) RETURNS TABLE (
  order_id UUID,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_community_id UUID;
  v_new_order_id UUID;
  v_is_in_territory BOOLEAN;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Verify caller
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'User profile not found';
    RETURN;
  END IF;

  IF v_public_user_id <> p_user_id THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Not authorized';
    RETURN;
  END IF;

  -- Get community ID from currency
  SELECT community_id INTO v_community_id
  FROM community_currencies
  WHERE id = p_community_currency_id;

  IF v_community_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Community currency not found';
    RETURN;
  END IF;

  -- Validate user is in community territory
  SELECT is_user_in_community_territory(p_user_id, v_community_id) INTO v_is_in_territory;

  IF NOT v_is_in_territory THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'You must be in this community''s territory to trade their currency';
    RETURN;
  END IF;

  -- Validate order type
  IF p_order_type NOT IN ('buy', 'sell') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid order type (must be ''buy'' or ''sell'')';
    RETURN;
  END IF;

  -- Validate amounts
  IF p_gold_amount <= 0 OR p_currency_amount <= 0 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Amounts must be positive';
    RETURN;
  END IF;

  -- Calculate exchange rate
  DECLARE
    v_exchange_rate NUMERIC := p_gold_amount / p_currency_amount;
    v_wallet_gold NUMERIC;
    v_wallet_cc NUMERIC;
  BEGIN
    -- Ensure wallets exist
    PERFORM get_or_create_gold_wallet(p_user_id);
    PERFORM get_or_create_community_wallet(p_user_id, p_community_currency_id);

    -- Get current balances
    SELECT gold_coins INTO v_wallet_gold
    FROM user_wallets
    WHERE user_id = p_user_id
      AND currency_type = 'gold';

    SELECT community_coins INTO v_wallet_cc
    FROM user_wallets
    WHERE user_id = p_user_id
      AND currency_type = 'community'
      AND community_currency_id = p_community_currency_id;

    v_wallet_gold := COALESCE(v_wallet_gold, 0);
    v_wallet_cc := COALESCE(v_wallet_cc, 0);

    -- Validate sufficient funds based on order type
    IF p_order_type = 'buy' THEN
      -- Buying currency with gold: lock gold
      IF v_wallet_gold < p_gold_amount THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, format('Insufficient gold (have: %s, need: %s)', v_wallet_gold, p_gold_amount);
        RETURN;
      END IF;

      -- Deduct gold from wallet (locked in escrow)
      UPDATE user_wallets
      SET gold_coins = gold_coins - p_gold_amount,
          updated_at = NOW()
      WHERE user_id = p_user_id
        AND currency_type = 'gold';
    ELSE
      -- Selling currency for gold: lock currency
      IF v_wallet_cc < p_currency_amount THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, format('Insufficient community currency (have: %s, need: %s)', v_wallet_cc, p_currency_amount);
        RETURN;
      END IF;

      -- Deduct community coins from wallet (locked in escrow)
      UPDATE user_wallets
      SET community_coins = community_coins - p_currency_amount,
          updated_at = NOW()
      WHERE user_id = p_user_id
        AND currency_type = 'community'
        AND community_currency_id = p_community_currency_id;
    END IF;

    -- Create exchange order
    INSERT INTO currency_exchange_orders (
      user_id,
      community_currency_id,
      order_type,
      gold_amount,
      currency_amount,
      exchange_rate,
      gold_remaining,
      currency_remaining,
      status,
      source_account
    ) VALUES (
      p_user_id,
      p_community_currency_id,
      p_order_type,
      p_gold_amount,
      p_currency_amount,
      v_exchange_rate,
      CASE WHEN p_order_type = 'buy' THEN p_gold_amount ELSE 0 END,
      CASE WHEN p_order_type = 'sell' THEN p_currency_amount ELSE 0 END,
      'active',
      p_source_account
    )
    RETURNING id INTO v_new_order_id;

    RETURN QUERY SELECT v_new_order_id, TRUE, 'Order created successfully';
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION create_exchange_order(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ============================================================================
-- 3. UPDATE accept_exchange_order to validate location
-- ============================================================================

CREATE OR REPLACE FUNCTION accept_exchange_order(
  p_taker_user_id UUID,
  p_order_id UUID,
  p_gold_amount NUMERIC
) RETURNS TABLE (
  trade_id UUID,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_order RECORD;
  v_currency_amount NUMERIC;
  v_new_trade_id UUID;
  v_taker_gold NUMERIC;
  v_taker_cc NUMERIC;
  v_community_id UUID;
  v_is_in_territory BOOLEAN;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Verify caller
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'User profile not found';
    RETURN;
  END IF;

  IF v_public_user_id <> p_taker_user_id THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Not authorized';
    RETURN;
  END IF;

  -- Get order details
  SELECT * INTO v_order
  FROM currency_exchange_orders
  WHERE id = p_order_id
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Order not found or not active';
    RETURN;
  END IF;

  -- Can't trade with yourself
  IF v_order.user_id = p_taker_user_id THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Cannot trade with yourself';
    RETURN;
  END IF;

  -- Get community ID
  SELECT community_id INTO v_community_id
  FROM community_currencies
  WHERE id = v_order.community_currency_id;

  -- Validate taker is in community territory
  SELECT is_user_in_community_territory(p_taker_user_id, v_community_id) INTO v_is_in_territory;

  IF NOT v_is_in_territory THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'You must be in this community''s territory to trade their currency';
    RETURN;
  END IF;

  -- Validate gold amount
  IF p_gold_amount <= 0 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Gold amount must be positive';
    RETURN;
  END IF;

  IF p_gold_amount > v_order.gold_remaining THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, format('Cannot accept more than remaining gold (max: %s)', v_order.gold_remaining);
    RETURN;
  END IF;

  -- Calculate corresponding currency amount
  v_currency_amount := p_gold_amount / v_order.exchange_rate;

  -- Ensure wallets exist
  PERFORM get_or_create_gold_wallet(p_taker_user_id);
  PERFORM get_or_create_community_wallet(p_taker_user_id, v_order.community_currency_id);

  -- Get taker's balances
  SELECT gold_coins INTO v_taker_gold
  FROM user_wallets
  WHERE user_id = p_taker_user_id
    AND currency_type = 'gold';

  SELECT community_coins INTO v_taker_cc
  FROM user_wallets
  WHERE user_id = p_taker_user_id
    AND currency_type = 'community'
    AND community_currency_id = v_order.community_currency_id;

  v_taker_gold := COALESCE(v_taker_gold, 0);
  v_taker_cc := COALESCE(v_taker_cc, 0);

  -- Process based on order type
  IF v_order.order_type = 'buy' THEN
    -- Maker is buying currency (taker is selling)
    IF v_taker_cc < v_currency_amount THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, format('Insufficient community currency (have: %s, need: %s)', v_taker_cc, v_currency_amount);
      RETURN;
    END IF;

    -- Taker gives currency, gets gold
    UPDATE user_wallets
    SET community_coins = community_coins - v_currency_amount,
        updated_at = NOW()
    WHERE user_id = p_taker_user_id
      AND currency_type = 'community'
      AND community_currency_id = v_order.community_currency_id;

    UPDATE user_wallets
    SET gold_coins = gold_coins + p_gold_amount,
        updated_at = NOW()
    WHERE user_id = p_taker_user_id
      AND currency_type = 'gold';

    -- Maker gets currency (gold was already escrowed)
    UPDATE user_wallets
    SET community_coins = community_coins + v_currency_amount,
        updated_at = NOW()
    WHERE user_id = v_order.user_id
      AND currency_type = 'community'
      AND community_currency_id = v_order.community_currency_id;
  ELSE
    -- Maker is selling currency (taker is buying)
    IF v_taker_gold < p_gold_amount THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, format('Insufficient gold (have: %s, need: %s)', v_taker_gold, p_gold_amount);
      RETURN;
    END IF;

    -- Taker gives gold, gets currency
    UPDATE user_wallets
    SET gold_coins = gold_coins - p_gold_amount,
        updated_at = NOW()
    WHERE user_id = p_taker_user_id
      AND currency_type = 'gold';

    UPDATE user_wallets
    SET community_coins = community_coins + v_currency_amount,
        updated_at = NOW()
    WHERE user_id = p_taker_user_id
      AND currency_type = 'community'
      AND community_currency_id = v_order.community_currency_id;

    -- Maker gets gold (currency was already escrowed)
    UPDATE user_wallets
    SET gold_coins = gold_coins + p_gold_amount,
        updated_at = NOW()
    WHERE user_id = v_order.user_id
      AND currency_type = 'gold';
  END IF;

  -- Update order
  UPDATE currency_exchange_orders
  SET
    gold_remaining = gold_remaining - p_gold_amount,
    currency_remaining = currency_remaining - v_currency_amount,
    status = CASE WHEN gold_remaining - p_gold_amount <= 0 THEN 'filled' ELSE 'active' END,
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Record trade
  INSERT INTO currency_exchange_trades (
    order_id,
    maker_user_id,
    taker_user_id,
    community_currency_id,
    gold_amount,
    currency_amount,
    exchange_rate
  ) VALUES (
    p_order_id,
    v_order.user_id,
    p_taker_user_id,
    v_order.community_currency_id,
    p_gold_amount,
    v_currency_amount,
    v_order.exchange_rate
  )
  RETURNING id INTO v_new_trade_id;

  RETURN QUERY SELECT v_new_trade_id, TRUE, 'Trade executed successfully';
END;
$$;

GRANT EXECUTE ON FUNCTION accept_exchange_order(UUID, UUID, NUMERIC) TO authenticated;

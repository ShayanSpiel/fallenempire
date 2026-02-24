-- Fix accept_exchange_order function - wallet query error
-- The get_or_create_*_wallet functions return UUID, not TABLE
-- Need to query user_wallets separately to get balances

DROP FUNCTION IF EXISTS accept_exchange_order(UUID, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION accept_exchange_order(
  p_taker_user_id UUID,
  p_order_id UUID,
  p_gold_amount NUMERIC
)
RETURNS TABLE(
  trade_id UUID,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_order RECORD;
  v_remaining_gold NUMERIC;
  v_currency_to_transfer NUMERIC;
  v_gold_wallet_id UUID;
  v_currency_wallet_id UUID;
  v_maker_gold_wallet_id UUID;
  v_maker_currency_wallet_id UUID;
  v_taker_gold_balance NUMERIC;
  v_taker_currency_balance NUMERIC;
  v_trade_id UUID;
  v_new_filled_amount NUMERIC;
  v_new_status TEXT;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM currency_exchange_orders
  WHERE id = p_order_id
  AND status IN ('active', 'partially_filled')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Order not found or already filled';
    RETURN;
  END IF;

  -- Can't accept own order
  IF v_order.user_id = p_taker_user_id THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Cannot accept your own order';
    RETURN;
  END IF;

  -- Calculate remaining amount
  v_remaining_gold := v_order.gold_amount - v_order.filled_gold_amount;

  -- Validate fill amount
  IF p_gold_amount <= 0 OR p_gold_amount > v_remaining_gold THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid fill amount';
    RETURN;
  END IF;

  -- Calculate currency amount
  v_currency_to_transfer := p_gold_amount * v_order.exchange_rate;

  -- Get or create wallets and fetch balances separately
  v_gold_wallet_id := get_or_create_gold_wallet(p_taker_user_id);
  v_currency_wallet_id := get_or_create_community_wallet(p_taker_user_id, v_order.community_currency_id);
  v_maker_gold_wallet_id := get_or_create_gold_wallet(v_order.user_id);
  v_maker_currency_wallet_id := get_or_create_community_wallet(v_order.user_id, v_order.community_currency_id);

  -- Fetch taker balances
  SELECT gold_coins INTO v_taker_gold_balance
  FROM user_wallets
  WHERE id = v_gold_wallet_id;

  SELECT community_coins INTO v_taker_currency_balance
  FROM user_wallets
  WHERE id = v_currency_wallet_id;

  -- Validate taker balance
  IF v_order.order_type = 'buy' THEN
    -- Maker wants to buy currency, taker sells currency for gold
    IF v_taker_currency_balance < v_currency_to_transfer THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient currency balance';
      RETURN;
    END IF;
  ELSE
    -- Maker wants to sell currency, taker buys currency with gold
    IF v_taker_gold_balance < p_gold_amount THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient gold balance';
      RETURN;
    END IF;
  END IF;

  -- Execute transfer
  IF v_order.order_type = 'buy' THEN
    -- Maker buying currency: Taker gives currency, receives gold
    UPDATE user_wallets SET community_coins = community_coins - v_currency_to_transfer WHERE id = v_currency_wallet_id;
    UPDATE user_wallets SET gold_coins = gold_coins + p_gold_amount WHERE id = v_gold_wallet_id;
    UPDATE user_wallets SET community_coins = community_coins + v_currency_to_transfer WHERE id = v_maker_currency_wallet_id;
    -- Maker's gold was already locked, no need to deduct again
  ELSE
    -- Maker selling currency: Taker gives gold, receives currency
    UPDATE user_wallets SET gold_coins = gold_coins - p_gold_amount WHERE id = v_gold_wallet_id;
    UPDATE user_wallets SET community_coins = community_coins + v_currency_to_transfer WHERE id = v_currency_wallet_id;
    UPDATE user_wallets SET gold_coins = gold_coins + p_gold_amount WHERE id = v_maker_gold_wallet_id;
    -- Maker's currency was already locked, no need to deduct again
  END IF;

  -- Update order fill status
  v_new_filled_amount := v_order.filled_gold_amount + p_gold_amount;
  v_new_status := CASE
    WHEN v_new_filled_amount >= v_order.gold_amount THEN 'filled'
    ELSE 'partially_filled'
  END;

  UPDATE currency_exchange_orders
  SET filled_gold_amount = v_new_filled_amount,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Create trade record
  INSERT INTO currency_exchange_trades (
    order_id,
    maker_user_id,
    taker_user_id,
    community_currency_id,
    gold_amount,
    currency_amount,
    exchange_rate,
    executed_at
  ) VALUES (
    p_order_id,
    v_order.user_id,
    p_taker_user_id,
    v_order.community_currency_id,
    p_gold_amount,
    v_currency_to_transfer,
    v_order.exchange_rate,
    NOW()
  ) RETURNING id INTO v_trade_id;

  -- Log transaction
  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    CASE WHEN v_order.order_type = 'buy' THEN p_taker_user_id ELSE v_order.user_id END,
    CASE WHEN v_order.order_type = 'buy' THEN v_order.user_id ELSE p_taker_user_id END,
    CASE WHEN v_order.order_type = 'buy' THEN 'community' ELSE 'gold' END,
    CASE WHEN v_order.order_type = 'buy' THEN v_order.community_currency_id ELSE NULL END,
    CASE WHEN v_order.order_type = 'buy' THEN v_currency_to_transfer ELSE p_gold_amount END,
    'exchange_order_filled',
    'P2P exchange trade executed'
  );

  RETURN QUERY SELECT v_trade_id, TRUE, 'Trade executed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

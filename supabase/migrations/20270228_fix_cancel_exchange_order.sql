-- Fix cancel_exchange_order function - get_or_create_*_wallet returns UUID directly, not a table
-- The error "column id does not exist" happens because we're trying to SELECT id FROM a UUID return value

CREATE OR REPLACE FUNCTION cancel_exchange_order(
  p_user_id UUID,
  p_order_id UUID
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_order RECORD;
  v_gold_to_refund NUMERIC;
  v_currency_to_refund NUMERIC;
  v_gold_wallet_id UUID;
  v_currency_wallet_id UUID;
  v_community_id UUID;
BEGIN
  -- Get order details
  SELECT * INTO v_order
  FROM currency_exchange_orders
  WHERE id = p_order_id
  AND user_id = p_user_id
  AND status IN ('active', 'partially_filled')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Order not found or cannot be cancelled';
    RETURN;
  END IF;

  -- Calculate refund amount (unfilled portion)
  v_gold_to_refund := v_order.gold_amount - v_order.filled_gold_amount;
  v_currency_to_refund := v_gold_to_refund * v_order.exchange_rate;

  -- Get community ID
  SELECT community_id INTO v_community_id
  FROM community_currencies
  WHERE id = v_order.community_currency_id;

  -- Refund locked funds
  IF v_order.source_account = 'treasury' THEN
    IF v_order.order_type = 'sell' THEN
      UPDATE communities
      SET treasury_currency = treasury_currency + v_currency_to_refund
      WHERE id = v_community_id;
    ELSE
      UPDATE communities
      SET treasury_gold = treasury_gold + v_gold_to_refund
      WHERE id = v_community_id;
    END IF;
  ELSE
    -- Get wallets (FIXED: these functions return UUID directly, not a table)
    v_gold_wallet_id := get_or_create_gold_wallet(p_user_id);
    v_currency_wallet_id := get_or_create_community_wallet(p_user_id, v_order.community_currency_id);

    IF v_order.order_type = 'sell' THEN
      UPDATE user_wallets
      SET community_coins = community_coins + v_currency_to_refund
      WHERE id = v_currency_wallet_id;
    ELSE
      UPDATE user_wallets
      SET gold_coins = gold_coins + v_gold_to_refund
      WHERE id = v_gold_wallet_id;
    END IF;
  END IF;

  -- Update order status
  UPDATE currency_exchange_orders
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Log transaction
  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description,
    scope,
    metadata
  ) VALUES (
    NULL,
    p_user_id,
    CASE WHEN v_order.order_type = 'sell' THEN 'community' ELSE 'gold' END,
    CASE WHEN v_order.order_type = 'sell' THEN v_order.community_currency_id ELSE NULL END,
    CASE WHEN v_order.order_type = 'sell' THEN v_currency_to_refund ELSE v_gold_to_refund END,
    'exchange_order_refunded',
    'Exchange order cancelled and funds refunded',
    CASE WHEN v_order.source_account = 'treasury' THEN 'community' ELSE 'personal' END,
    jsonb_build_object(
      'order_id', p_order_id,
      'order_type', v_order.order_type,
      'source_account', v_order.source_account,
      'exchange_rate', v_order.exchange_rate
    )
  );

  RETURN QUERY SELECT TRUE, 'Order cancelled successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cancel_exchange_order(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION cancel_exchange_order IS 'Cancel an exchange order and refund locked funds';

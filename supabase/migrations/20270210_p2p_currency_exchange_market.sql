-- =====================================================
-- P2P Currency Exchange Market System
-- =====================================================
-- Creates a player-driven exchange marketplace where users post buy/sell offers
-- at their own rates instead of using hardcoded exchange rates.

-- =====================================================
-- 1. EXCHANGE ORDERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS currency_exchange_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_currency_id UUID NOT NULL REFERENCES community_currencies(id) ON DELETE CASCADE,

  -- Order details
  order_type TEXT NOT NULL CHECK (order_type IN ('buy', 'sell')),
  gold_amount NUMERIC NOT NULL CHECK (gold_amount > 0),
  currency_amount NUMERIC NOT NULL CHECK (currency_amount > 0),
  exchange_rate NUMERIC NOT NULL CHECK (exchange_rate > 0), -- Currency per 1 gold

  -- Fill tracking
  filled_gold_amount NUMERIC NOT NULL DEFAULT 0 CHECK (filled_gold_amount >= 0 AND filled_gold_amount <= gold_amount),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'partially_filled', 'filled', 'cancelled', 'expired')),

  -- Account source
  source_account TEXT NOT NULL DEFAULT 'personal' CHECK (source_account IN ('personal', 'treasury')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for order book queries
CREATE INDEX IF NOT EXISTS idx_exchange_orders_community_status ON currency_exchange_orders(community_currency_id, status) WHERE status IN ('active', 'partially_filled');
CREATE INDEX IF NOT EXISTS idx_exchange_orders_type_rate ON currency_exchange_orders(order_type, exchange_rate) WHERE status IN ('active', 'partially_filled');
CREATE INDEX IF NOT EXISTS idx_exchange_orders_user ON currency_exchange_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_exchange_orders_expires ON currency_exchange_orders(expires_at) WHERE status IN ('active', 'partially_filled');

-- Update timestamp trigger
DROP TRIGGER IF EXISTS update_exchange_orders_updated_at ON currency_exchange_orders;
CREATE TRIGGER update_exchange_orders_updated_at
  BEFORE UPDATE ON currency_exchange_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. EXCHANGE TRADES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS currency_exchange_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES currency_exchange_orders(id) ON DELETE CASCADE,
  maker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  taker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_currency_id UUID NOT NULL REFERENCES community_currencies(id) ON DELETE CASCADE,

  -- Trade details
  gold_amount NUMERIC NOT NULL CHECK (gold_amount > 0),
  currency_amount NUMERIC NOT NULL CHECK (currency_amount > 0),
  exchange_rate NUMERIC NOT NULL CHECK (exchange_rate > 0),

  -- Execution
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for trade history and analytics
CREATE INDEX IF NOT EXISTS idx_exchange_trades_order ON currency_exchange_trades(order_id);
CREATE INDEX IF NOT EXISTS idx_exchange_trades_maker ON currency_exchange_trades(maker_user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_trades_taker ON currency_exchange_trades(taker_user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_trades_community_time ON currency_exchange_trades(community_currency_id, executed_at DESC);

-- =====================================================
-- 3. EXCHANGE RATE SNAPSHOTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS currency_exchange_rate_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_currency_id UUID NOT NULL REFERENCES community_currencies(id) ON DELETE CASCADE,

  -- OHLC data
  snapshot_time TIMESTAMPTZ NOT NULL,
  open_rate NUMERIC,
  high_rate NUMERIC,
  low_rate NUMERIC,
  close_rate NUMERIC,
  weighted_avg_rate NUMERIC,

  -- Volume
  volume_gold NUMERIC NOT NULL DEFAULT 0,
  volume_currency NUMERIC NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  UNIQUE(community_currency_id, snapshot_time)
);

-- Indexes for chart queries
CREATE INDEX IF NOT EXISTS idx_rate_snapshots_community_time ON currency_exchange_rate_snapshots(community_currency_id, snapshot_time DESC);

-- =====================================================
-- 4. RPC: CREATE EXCHANGE ORDER
-- =====================================================
CREATE OR REPLACE FUNCTION create_exchange_order(
  p_user_id UUID,
  p_community_currency_id UUID,
  p_order_type TEXT,
  p_gold_amount NUMERIC,
  p_currency_amount NUMERIC,
  p_source_account TEXT DEFAULT 'personal'
)
RETURNS TABLE(
  order_id UUID,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_exchange_rate NUMERIC;
  v_gold_wallet_id UUID;
  v_currency_wallet_id UUID;
  v_gold_balance NUMERIC;
  v_currency_balance NUMERIC;
  v_community_id UUID;
  v_is_leader BOOLEAN := FALSE;
  v_treasury_gold NUMERIC;
  v_treasury_currency NUMERIC;
  v_order_id UUID;
BEGIN
  -- Validate inputs
  IF p_gold_amount <= 0 OR p_currency_amount <= 0 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid amount';
    RETURN;
  END IF;

  IF p_order_type NOT IN ('buy', 'sell') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid order type';
    RETURN;
  END IF;

  -- Calculate exchange rate
  v_exchange_rate := p_currency_amount / p_gold_amount;

  -- Get community ID
  SELECT community_id INTO v_community_id
  FROM community_currencies
  WHERE id = p_community_currency_id;

  IF v_community_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Invalid community currency';
    RETURN;
  END IF;

  -- Check if treasury account is allowed
  IF p_source_account = 'treasury' THEN
    -- Check if user is community leader
    SELECT EXISTS(
      SELECT 1 FROM communities
      WHERE id = v_community_id
      AND leader_id = p_user_id
    ) INTO v_is_leader;

    IF NOT v_is_leader THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Only community leaders can use treasury account';
      RETURN;
    END IF;

    -- Get treasury balances
    SELECT COALESCE(treasury_gold, 0), COALESCE(treasury_currency, 0)
    INTO v_treasury_gold, v_treasury_currency
    FROM communities
    WHERE id = v_community_id;

    -- Check treasury balance
    IF p_order_type = 'sell' THEN
      -- Selling currency for gold, need currency in treasury
      IF v_treasury_currency < p_currency_amount THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient treasury currency balance';
        RETURN;
      END IF;
    ELSE
      -- Buying currency with gold, need gold in treasury
      IF v_treasury_gold < p_gold_amount THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient treasury gold balance';
        RETURN;
      END IF;
    END IF;
  ELSE
    -- Personal account - get or create wallets
    v_gold_wallet_id := get_or_create_gold_wallet(p_user_id);
    v_currency_wallet_id := get_or_create_community_wallet(p_user_id, p_community_currency_id);

    -- Get balances
    SELECT gold_coins INTO v_gold_balance
    FROM user_wallets
    WHERE id = v_gold_wallet_id;

    SELECT community_coins INTO v_currency_balance
    FROM user_wallets
    WHERE id = v_currency_wallet_id;

    -- Check personal balance
    IF p_order_type = 'sell' THEN
      -- Selling currency for gold, need currency
      IF v_currency_balance < p_currency_amount THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient currency balance';
        RETURN;
      END IF;
    ELSE
      -- Buying currency with gold, need gold
      IF v_gold_balance < p_gold_amount THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Insufficient gold balance';
        RETURN;
      END IF;
    END IF;
  END IF;

  -- Lock funds
  IF p_source_account = 'treasury' THEN
    IF p_order_type = 'sell' THEN
      UPDATE communities
      SET treasury_currency = treasury_currency - p_currency_amount
      WHERE id = v_community_id;
    ELSE
      UPDATE communities
      SET treasury_gold = treasury_gold - p_gold_amount
      WHERE id = v_community_id;
    END IF;
  ELSE
    IF p_order_type = 'sell' THEN
      UPDATE user_wallets
      SET community_coins = community_coins - p_currency_amount
      WHERE id = v_currency_wallet_id;
    ELSE
      UPDATE user_wallets
      SET gold_coins = gold_coins - p_gold_amount
      WHERE id = v_gold_wallet_id;
    END IF;
  END IF;

  -- Create order
  INSERT INTO currency_exchange_orders (
    user_id,
    community_currency_id,
    order_type,
    gold_amount,
    currency_amount,
    exchange_rate,
    source_account
  ) VALUES (
    p_user_id,
    p_community_currency_id,
    p_order_type,
    p_gold_amount,
    p_currency_amount,
    v_exchange_rate,
    p_source_account
  ) RETURNING id INTO v_order_id;

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
    p_user_id,
    NULL,
    CASE WHEN p_order_type = 'sell' THEN 'community' ELSE 'gold' END,
    CASE WHEN p_order_type = 'sell' THEN p_community_currency_id ELSE NULL END,
    CASE WHEN p_order_type = 'sell' THEN p_currency_amount ELSE p_gold_amount END,
    'exchange_order_locked',
    'Locked funds for exchange order',
    CASE WHEN p_source_account = 'treasury' THEN 'community' ELSE 'personal' END,
    jsonb_build_object(
      'order_id', v_order_id,
      'order_type', p_order_type,
      'source_account', p_source_account,
      'exchange_rate', v_exchange_rate
    )
  );

  RETURN QUERY SELECT v_order_id, TRUE, 'Order created successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. RPC: ACCEPT EXCHANGE ORDER
-- =====================================================
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

  -- Get or create wallets
  SELECT id, gold_coins INTO v_gold_wallet_id, v_taker_gold_balance
  FROM get_or_create_gold_wallet(p_taker_user_id);

  SELECT id, community_coins INTO v_currency_wallet_id, v_taker_currency_balance
  FROM get_or_create_community_wallet(p_taker_user_id, v_order.community_currency_id);

  SELECT id INTO v_maker_gold_wallet_id
  FROM get_or_create_gold_wallet(v_order.user_id);

  SELECT id INTO v_maker_currency_wallet_id
  FROM get_or_create_community_wallet(v_order.user_id, v_order.community_currency_id);

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
    v_currency_to_transfer,
    v_order.exchange_rate
  ) RETURNING id INTO v_trade_id;

  -- Log transactions
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
  ) VALUES
  (
    CASE WHEN v_order.order_type = 'buy' THEN p_taker_user_id ELSE v_order.user_id END,
    CASE WHEN v_order.order_type = 'buy' THEN v_order.user_id ELSE p_taker_user_id END,
    'community',
    v_order.community_currency_id,
    v_currency_to_transfer,
    'exchange_order_filled',
    'Currency exchange trade',
    'personal',
    jsonb_build_object(
      'order_id', p_order_id,
      'trade_id', v_trade_id,
      'exchange_rate', v_order.exchange_rate,
      'gold_amount', p_gold_amount
    )
  ),
  (
    CASE WHEN v_order.order_type = 'buy' THEN v_order.user_id ELSE p_taker_user_id END,
    CASE WHEN v_order.order_type = 'buy' THEN p_taker_user_id ELSE v_order.user_id END,
    'gold',
    NULL,
    p_gold_amount,
    'exchange_order_filled',
    'Currency exchange trade',
    'personal',
    jsonb_build_object(
      'order_id', p_order_id,
      'trade_id', v_trade_id,
      'exchange_rate', v_order.exchange_rate,
      'currency_amount', v_currency_to_transfer
    )
  );

  RETURN QUERY SELECT v_trade_id, TRUE, 'Order accepted successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. RPC: CANCEL EXCHANGE ORDER
-- =====================================================
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
    -- Get wallets
    SELECT id INTO v_gold_wallet_id
    FROM get_or_create_gold_wallet(p_user_id);

    SELECT id INTO v_currency_wallet_id
    FROM get_or_create_community_wallet(p_user_id, v_order.community_currency_id);

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

-- =====================================================
-- 7. RPC: GET ORDER BOOK (AGGREGATED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_order_book_aggregated(
  p_community_currency_id UUID
)
RETURNS TABLE(
  order_type TEXT,
  exchange_rate NUMERIC,
  total_gold_amount NUMERIC,
  total_currency_amount NUMERIC,
  order_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.order_type,
    o.exchange_rate,
    SUM(o.gold_amount - o.filled_gold_amount) AS total_gold_amount,
    SUM((o.gold_amount - o.filled_gold_amount) * o.exchange_rate) AS total_currency_amount,
    COUNT(*)::BIGINT AS order_count
  FROM currency_exchange_orders o
  WHERE o.community_currency_id = p_community_currency_id
    AND o.status IN ('active', 'partially_filled')
    AND o.gold_amount > o.filled_gold_amount
  GROUP BY o.order_type, o.exchange_rate
  ORDER BY
    o.order_type DESC, -- 'sell' before 'buy'
    CASE WHEN o.order_type = 'sell' THEN o.exchange_rate END ASC,  -- Sells: lowest first
    CASE WHEN o.order_type = 'buy' THEN o.exchange_rate END DESC;  -- Buys: highest first
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. RPC: GET ORDER BOOK (INDIVIDUAL ORDERS)
-- =====================================================
DROP FUNCTION IF EXISTS get_order_book_individual(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION get_order_book_individual(
  p_community_currency_id UUID,
  p_exchange_rate NUMERIC,
  p_order_type TEXT
)
RETURNS TABLE(
  order_id UUID,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  remaining_gold_amount NUMERIC,
  remaining_currency_amount NUMERIC,
  exchange_rate NUMERIC,
  source_account TEXT,
  created_at TIMESTAMPTZ,
  order_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.user_id,
    u.username,
    u.avatar_url,
    o.gold_amount - o.filled_gold_amount AS remaining_gold_amount,
    (o.gold_amount - o.filled_gold_amount) * o.exchange_rate AS remaining_currency_amount,
    o.exchange_rate,
    o.source_account,
    o.created_at,
    o.order_type
  FROM currency_exchange_orders o
  JOIN users u ON u.id = o.user_id
  WHERE o.community_currency_id = p_community_currency_id
    AND o.exchange_rate = p_exchange_rate
    AND o.order_type = p_order_type
    AND o.status IN ('active', 'partially_filled')
    AND o.gold_amount > o.filled_gold_amount
  ORDER BY o.created_at ASC; -- FIFO
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 9. RPC: GET EXCHANGE RATE HISTORY
-- =====================================================
CREATE OR REPLACE FUNCTION get_exchange_rate_history(
  p_community_currency_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  snapshot_time TIMESTAMPTZ,
  open_rate NUMERIC,
  high_rate NUMERIC,
  low_rate NUMERIC,
  close_rate NUMERIC,
  weighted_avg_rate NUMERIC,
  volume_gold NUMERIC,
  volume_currency NUMERIC,
  trade_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.snapshot_time,
    s.open_rate,
    s.high_rate,
    s.low_rate,
    s.close_rate,
    s.weighted_avg_rate,
    s.volume_gold,
    s.volume_currency,
    s.trade_count
  FROM currency_exchange_rate_snapshots s
  WHERE s.community_currency_id = p_community_currency_id
    AND s.snapshot_time >= p_start_time
    AND s.snapshot_time <= p_end_time
  ORDER BY s.snapshot_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. RPC: GET USER'S ACTIVE ORDERS
-- =====================================================
CREATE OR REPLACE FUNCTION get_user_exchange_orders(
  p_user_id UUID
)
RETURNS TABLE(
  order_id UUID,
  community_currency_id UUID,
  community_name TEXT,
  currency_symbol TEXT,
  order_type TEXT,
  gold_amount NUMERIC,
  currency_amount NUMERIC,
  filled_gold_amount NUMERIC,
  exchange_rate NUMERIC,
  status TEXT,
  source_account TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.community_currency_id,
    c.name AS community_name,
    cc.currency_symbol,
    o.order_type,
    o.gold_amount,
    o.currency_amount,
    o.filled_gold_amount,
    o.exchange_rate,
    o.status,
    o.source_account,
    o.created_at,
    o.expires_at
  FROM currency_exchange_orders o
  JOIN community_currencies cc ON cc.id = o.community_currency_id
  JOIN communities c ON c.id = cc.community_id
  WHERE o.user_id = p_user_id
    AND o.status IN ('active', 'partially_filled')
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. RPC: GENERATE RATE SNAPSHOT
-- =====================================================
CREATE OR REPLACE FUNCTION generate_exchange_rate_snapshot(
  p_community_currency_id UUID,
  p_snapshot_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID AS $$
DECLARE
  v_stats RECORD;
BEGIN
  -- Calculate stats from recent trades (last hour)
  SELECT
    MIN(exchange_rate) AS low_rate,
    MAX(exchange_rate) AS high_rate,
    SUM(gold_amount * exchange_rate) / NULLIF(SUM(gold_amount), 0) AS weighted_avg_rate,
    SUM(gold_amount) AS volume_gold,
    SUM(currency_amount) AS volume_currency,
    COUNT(*)::INTEGER AS trade_count,
    (ARRAY_AGG(exchange_rate ORDER BY executed_at ASC))[1] AS open_rate,
    (ARRAY_AGG(exchange_rate ORDER BY executed_at DESC))[1] AS close_rate
  INTO v_stats
  FROM currency_exchange_trades
  WHERE community_currency_id = p_community_currency_id
    AND executed_at >= p_snapshot_time - INTERVAL '1 hour'
    AND executed_at < p_snapshot_time;

  -- Insert snapshot (if there were trades)
  IF v_stats.trade_count > 0 THEN
    INSERT INTO currency_exchange_rate_snapshots (
      community_currency_id,
      snapshot_time,
      open_rate,
      high_rate,
      low_rate,
      close_rate,
      weighted_avg_rate,
      volume_gold,
      volume_currency,
      trade_count
    ) VALUES (
      p_community_currency_id,
      p_snapshot_time,
      v_stats.open_rate,
      v_stats.high_rate,
      v_stats.low_rate,
      v_stats.close_rate,
      v_stats.weighted_avg_rate,
      v_stats.volume_gold,
      v_stats.volume_currency,
      v_stats.trade_count
    )
    ON CONFLICT (community_currency_id, snapshot_time)
    DO UPDATE SET
      open_rate = EXCLUDED.open_rate,
      high_rate = EXCLUDED.high_rate,
      low_rate = EXCLUDED.low_rate,
      close_rate = EXCLUDED.close_rate,
      weighted_avg_rate = EXCLUDED.weighted_avg_rate,
      volume_gold = EXCLUDED.volume_gold,
      volume_currency = EXCLUDED.volume_currency,
      trade_count = EXCLUDED.trade_count;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 12. RPC: EXPIRE OLD ORDERS (CRON JOB)
-- =====================================================
CREATE OR REPLACE FUNCTION expire_old_exchange_orders()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_order RECORD;
  v_gold_to_refund NUMERIC;
  v_currency_to_refund NUMERIC;
  v_gold_wallet_id UUID;
  v_currency_wallet_id UUID;
  v_community_id UUID;
BEGIN
  FOR v_order IN
    SELECT *
    FROM currency_exchange_orders
    WHERE status IN ('active', 'partially_filled')
      AND expires_at < NOW()
    FOR UPDATE
  LOOP
    -- Calculate refund
    v_gold_to_refund := v_order.gold_amount - v_order.filled_gold_amount;
    v_currency_to_refund := v_gold_to_refund * v_order.exchange_rate;

    -- Get community ID
    SELECT community_id INTO v_community_id
    FROM community_currencies
    WHERE id = v_order.community_currency_id;

    -- Refund
    IF v_order.source_account = 'treasury' THEN
      IF v_order.order_type = 'sell' THEN
        UPDATE communities SET treasury_currency = treasury_currency + v_currency_to_refund WHERE id = v_community_id;
      ELSE
        UPDATE communities SET treasury_gold = treasury_gold + v_gold_to_refund WHERE id = v_community_id;
      END IF;
    ELSE
      SELECT id INTO v_gold_wallet_id FROM get_or_create_gold_wallet(v_order.user_id);
      SELECT id INTO v_currency_wallet_id FROM get_or_create_community_wallet(v_order.user_id, v_order.community_currency_id);

      IF v_order.order_type = 'sell' THEN
        UPDATE user_wallets SET community_coins = community_coins + v_currency_to_refund WHERE id = v_currency_wallet_id;
      ELSE
        UPDATE user_wallets SET gold_coins = gold_coins + v_gold_to_refund WHERE id = v_gold_wallet_id;
      END IF;
    END IF;

    -- Mark as expired
    UPDATE currency_exchange_orders SET status = 'expired' WHERE id = v_order.id;
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 13. GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON currency_exchange_orders TO authenticated;
GRANT SELECT, INSERT ON currency_exchange_trades TO authenticated;
GRANT SELECT ON currency_exchange_rate_snapshots TO authenticated;

-- =====================================================
-- 14. RLS POLICIES
-- =====================================================

-- Exchange orders: Users can view all, create own, update/cancel own
ALTER TABLE currency_exchange_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_orders_select_all ON currency_exchange_orders;
CREATE POLICY exchange_orders_select_all ON currency_exchange_orders
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS exchange_orders_insert_own ON currency_exchange_orders;
CREATE POLICY exchange_orders_insert_own ON currency_exchange_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS exchange_orders_update_own ON currency_exchange_orders;
CREATE POLICY exchange_orders_update_own ON currency_exchange_orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trades: Users can view all
ALTER TABLE currency_exchange_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchange_trades_select_all ON currency_exchange_trades;
CREATE POLICY exchange_trades_select_all ON currency_exchange_trades
  FOR SELECT TO authenticated USING (true);

-- Rate snapshots: All can view
ALTER TABLE currency_exchange_rate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_snapshots_select_all ON currency_exchange_rate_snapshots;
CREATE POLICY rate_snapshots_select_all ON currency_exchange_rate_snapshots
  FOR SELECT TO authenticated USING (true);

-- =====================================================
-- COMPLETE
-- =====================================================

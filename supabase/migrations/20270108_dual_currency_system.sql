-- Dual Currency System: Universal Gold Coins + Local Community Currencies
-- Feature 1 of Economy Module

-- ============================================================================
-- TABLES
-- ============================================================================

-- Community currencies (each community can issue its own currency)
CREATE TABLE IF NOT EXISTS community_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE UNIQUE,
  currency_name TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  exchange_rate_to_gold NUMERIC NOT NULL DEFAULT 1.0 CHECK (exchange_rate_to_gold > 0),
  total_supply NUMERIC DEFAULT 0 CHECK (total_supply >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT currency_name_not_empty CHECK (length(trim(currency_name)) > 0),
  CONSTRAINT currency_symbol_not_empty CHECK (length(trim(currency_symbol)) > 0)
);

-- User wallets (stores both gold and community coins)
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  currency_type TEXT NOT NULL DEFAULT 'gold' CHECK (currency_type IN ('gold', 'community')),

  -- For gold wallets (universal currency)
  gold_coins NUMERIC DEFAULT 0 CHECK (gold_coins >= 0),

  -- For community currency wallets
  community_currency_id UUID REFERENCES community_currencies(id) ON DELETE CASCADE,
  community_coins NUMERIC DEFAULT 0 CHECK (community_coins >= 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user has one gold wallet
  CONSTRAINT unique_gold_wallet UNIQUE(user_id, currency_type) DEFERRABLE INITIALLY DEFERRED,
  -- Each user can have one wallet per community currency
  CONSTRAINT unique_community_wallet UNIQUE(user_id, community_currency_id) DEFERRABLE INITIALLY DEFERRED,
  -- Gold wallets don't have community_currency_id
  CONSTRAINT gold_wallet_no_community CHECK (
    (currency_type = 'gold' AND community_currency_id IS NULL) OR
    (currency_type = 'community' AND community_currency_id IS NOT NULL)
  )
);

-- Currency transaction history (audit trail)
CREATE TABLE IF NOT EXISTS currency_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  currency_type TEXT NOT NULL CHECK (currency_type IN ('gold', 'community')),
  community_currency_id UUID REFERENCES community_currencies(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('transfer', 'exchange', 'reward', 'tax', 'purchase', 'sale')),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_currency_type ON user_wallets(currency_type);
CREATE INDEX IF NOT EXISTS idx_user_wallets_community_currency ON user_wallets(community_currency_id);
CREATE INDEX IF NOT EXISTS idx_community_currencies_community ON community_currencies(community_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_from_user ON currency_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_to_user ON currency_transactions(to_user_id);
CREATE INDEX IF NOT EXISTS idx_currency_transactions_created_at ON currency_transactions(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE community_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_transactions ENABLE ROW LEVEL SECURITY;

-- Community currencies: Anyone can read, only admins can modify
DROP POLICY IF EXISTS "Anyone can view community currencies" ON community_currencies;
CREATE POLICY "Anyone can view community currencies"
  ON community_currencies FOR SELECT
  TO authenticated
  USING (true);

-- Note: Community currencies are auto-created for communities
-- For now, we'll allow system-level inserts only (via service role)
-- Future: Could check if user is community leader
DROP POLICY IF EXISTS "System can create community currencies" ON community_currencies;
CREATE POLICY "System can create community currencies"
  ON community_currencies FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Only service role can insert

DROP POLICY IF EXISTS "System can update community currencies" ON community_currencies;
CREATE POLICY "System can update community currencies"
  ON community_currencies FOR UPDATE
  TO authenticated
  USING (false); -- Only service role can update

-- User wallets: Users can only see and modify their own wallets
DROP POLICY IF EXISTS "Users can view their own wallets" ON user_wallets;
CREATE POLICY "Users can view their own wallets"
  ON user_wallets FOR SELECT
  TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own wallets" ON user_wallets;
CREATE POLICY "Users can insert their own wallets"
  ON user_wallets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update their own wallets" ON user_wallets;
CREATE POLICY "Users can update their own wallets"
  ON user_wallets FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Transaction history: Users can see transactions they're involved in
DROP POLICY IF EXISTS "Users can view their own transactions" ON currency_transactions;
CREATE POLICY "Users can view their own transactions"
  ON currency_transactions FOR SELECT
  TO authenticated
  USING (
    from_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR to_user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "System can insert transactions" ON currency_transactions;
CREATE POLICY "System can insert transactions"
  ON currency_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get or create gold wallet for a user
CREATE OR REPLACE FUNCTION get_or_create_gold_wallet(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id AND currency_type = 'gold';

  -- Create if doesn't exist
  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (user_id, currency_type, gold_coins)
    VALUES (p_user_id, 'gold', 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create community currency wallet for a user
CREATE OR REPLACE FUNCTION get_or_create_community_wallet(
  p_user_id UUID,
  p_community_currency_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
    AND currency_type = 'community'
    AND community_currency_id = p_community_currency_id;

  -- Create if doesn't exist
  IF v_wallet_id IS NULL THEN
    INSERT INTO user_wallets (
      user_id,
      currency_type,
      community_currency_id,
      community_coins
    )
    VALUES (p_user_id, 'community', p_community_currency_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CORE RPC FUNCTIONS
-- ============================================================================

-- Transfer gold coins between users
CREATE OR REPLACE FUNCTION transfer_gold(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_from_wallet_id UUID;
  v_to_wallet_id UUID;
  v_from_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;

  -- Validate users are different
  IF p_from_user_id = p_to_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot transfer to yourself'
    );
  END IF;

  -- Get or create wallets
  v_from_wallet_id := get_or_create_gold_wallet(p_from_user_id);
  v_to_wallet_id := get_or_create_gold_wallet(p_to_user_id);

  -- Check sender has enough balance
  SELECT gold_coins INTO v_from_balance
  FROM user_wallets
  WHERE id = v_from_wallet_id
  FOR UPDATE; -- Lock the row

  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_from_balance,
      'required', p_amount
    );
  END IF;

  -- Perform transfer atomically
  UPDATE user_wallets
  SET gold_coins = gold_coins - p_amount,
      updated_at = NOW()
  WHERE id = v_from_wallet_id;

  UPDATE user_wallets
  SET gold_coins = gold_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_to_wallet_id;

  -- Record transaction
  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    amount,
    transaction_type,
    description
  )
  VALUES (
    p_from_user_id,
    p_to_user_id,
    'gold',
    p_amount,
    'transfer',
    p_description
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'from_user_id', p_from_user_id,
    'to_user_id', p_to_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transfer community coins between users
CREATE OR REPLACE FUNCTION transfer_community_coin(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_community_currency_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_from_wallet_id UUID;
  v_to_wallet_id UUID;
  v_from_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;

  -- Validate users are different
  IF p_from_user_id = p_to_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot transfer to yourself'
    );
  END IF;

  -- Get or create wallets
  v_from_wallet_id := get_or_create_community_wallet(p_from_user_id, p_community_currency_id);
  v_to_wallet_id := get_or_create_community_wallet(p_to_user_id, p_community_currency_id);

  -- Check sender has enough balance
  SELECT community_coins INTO v_from_balance
  FROM user_wallets
  WHERE id = v_from_wallet_id
  FOR UPDATE;

  IF v_from_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_from_balance,
      'required', p_amount
    );
  END IF;

  -- Perform transfer atomically
  UPDATE user_wallets
  SET community_coins = community_coins - p_amount,
      updated_at = NOW()
  WHERE id = v_from_wallet_id;

  UPDATE user_wallets
  SET community_coins = community_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_to_wallet_id;

  -- Record transaction
  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description
  )
  VALUES (
    p_from_user_id,
    p_to_user_id,
    'community',
    p_community_currency_id,
    p_amount,
    'transfer',
    p_description
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'from_user_id', p_from_user_id,
    'to_user_id', p_to_user_id,
    'community_currency_id', p_community_currency_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exchange community coins for gold (or vice versa)
CREATE OR REPLACE FUNCTION exchange_currency(
  p_user_id UUID,
  p_community_currency_id UUID,
  p_from_currency TEXT, -- 'gold' or 'community'
  p_amount NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_exchange_rate NUMERIC;
  v_gold_amount NUMERIC;
  v_community_amount NUMERIC;
  v_gold_wallet_id UUID;
  v_community_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;

  -- Get exchange rate
  SELECT exchange_rate_to_gold INTO v_exchange_rate
  FROM community_currencies
  WHERE id = p_community_currency_id;

  IF v_exchange_rate IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Community currency not found'
    );
  END IF;

  -- Get or create wallets
  v_gold_wallet_id := get_or_create_gold_wallet(p_user_id);
  v_community_wallet_id := get_or_create_community_wallet(p_user_id, p_community_currency_id);

  -- Calculate exchange amounts
  IF p_from_currency = 'gold' THEN
    v_gold_amount := p_amount;
    v_community_amount := p_amount * v_exchange_rate;

    -- Check gold balance
    IF NOT EXISTS (
      SELECT 1 FROM user_wallets
      WHERE id = v_gold_wallet_id
      AND gold_coins >= v_gold_amount
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient gold balance'
      );
    END IF;

    -- Perform exchange
    UPDATE user_wallets
    SET gold_coins = gold_coins - v_gold_amount,
        updated_at = NOW()
    WHERE id = v_gold_wallet_id;

    UPDATE user_wallets
    SET community_coins = community_coins + v_community_amount,
        updated_at = NOW()
    WHERE id = v_community_wallet_id;

  ELSIF p_from_currency = 'community' THEN
    v_community_amount := p_amount;
    v_gold_amount := p_amount / v_exchange_rate;

    -- Check community coin balance
    IF NOT EXISTS (
      SELECT 1 FROM user_wallets
      WHERE id = v_community_wallet_id
      AND community_coins >= v_community_amount
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient community coin balance'
      );
    END IF;

    -- Perform exchange
    UPDATE user_wallets
    SET community_coins = community_coins - v_community_amount,
        updated_at = NOW()
    WHERE id = v_community_wallet_id;

    UPDATE user_wallets
    SET gold_coins = gold_coins + v_gold_amount,
        updated_at = NOW()
    WHERE id = v_gold_wallet_id;

  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid currency type'
    );
  END IF;

  -- Record transaction
  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    p_user_id,
    'gold',
    p_community_currency_id,
    p_amount,
    'exchange',
    'Currency exchange',
    jsonb_build_object(
      'from_currency', p_from_currency,
      'exchange_rate', v_exchange_rate,
      'gold_amount', v_gold_amount,
      'community_amount', v_community_amount
    )
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'exchange_rate', v_exchange_rate,
    'gold_amount', v_gold_amount,
    'community_amount', v_community_amount,
    'from_currency', p_from_currency
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add gold to user wallet (for rewards, admin grants, etc.)
CREATE OR REPLACE FUNCTION add_gold(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT DEFAULT 'reward',
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;

  v_wallet_id := get_or_create_gold_wallet(p_user_id);

  UPDATE user_wallets
  SET gold_coins = gold_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO currency_transactions (
    to_user_id,
    currency_type,
    amount,
    transaction_type,
    description
  )
  VALUES (
    p_user_id,
    'gold',
    p_amount,
    p_transaction_type,
    p_description
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct gold from user wallet (for purchases, taxes, etc.)
CREATE OR REPLACE FUNCTION deduct_gold(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT DEFAULT 'purchase',
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;

  v_wallet_id := get_or_create_gold_wallet(p_user_id);

  SELECT gold_coins INTO v_balance
  FROM user_wallets
  WHERE id = v_wallet_id
  FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'current_balance', v_balance,
      'required', p_amount
    );
  END IF;

  UPDATE user_wallets
  SET gold_coins = gold_coins - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO currency_transactions (
    from_user_id,
    currency_type,
    amount,
    transaction_type,
    description
  )
  VALUES (
    p_user_id,
    'gold',
    p_amount,
    p_transaction_type,
    p_description
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INITIALIZATION
-- ============================================================================

-- Create gold wallets for all existing users (with 100 starting gold)
DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM public.users LOOP
    PERFORM get_or_create_gold_wallet(v_user.id);

    -- Give 100 starting gold
    UPDATE user_wallets
    SET gold_coins = 100
    WHERE user_id = v_user.id AND currency_type = 'gold';
  END LOOP;
END $$;

-- Create a currency for each existing community
DO $$
DECLARE
  v_community RECORD;
  v_currency_id UUID;
BEGIN
  FOR v_community IN SELECT id, name FROM communities LOOP
    -- Create community currency
    INSERT INTO community_currencies (
      community_id,
      currency_name,
      currency_symbol,
      exchange_rate_to_gold
    )
    VALUES (
      v_community.id,
      v_community.name || ' Coin',
      UPPER(SUBSTRING(v_community.name FROM 1 FOR 2)) || 'C',
      1.0
    )
    ON CONFLICT (community_id) DO NOTHING
    RETURNING id INTO v_currency_id;
  END LOOP;
END $$;

-- Grant EXECUTE permissions on functions
GRANT EXECUTE ON FUNCTION get_or_create_gold_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_community_wallet(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_gold(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_community_coin(UUID, UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION exchange_currency(UUID, UUID, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION add_gold(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_gold(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

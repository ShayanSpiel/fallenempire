-- Enhanced Transaction RPC Functions
-- Support for metadata and scope fields

-- ============================================================================
-- ENHANCED ADD GOLD (Credit)
-- ============================================================================

CREATE OR REPLACE FUNCTION add_gold_enhanced(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'personal'
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
    description,
    metadata,
    scope
  )
  VALUES (
    p_user_id,
    'gold',
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'user_id', p_user_id,
    'new_balance', (SELECT gold_coins FROM user_wallets WHERE id = v_wallet_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENHANCED DEDUCT GOLD (Debit)
-- ============================================================================

CREATE OR REPLACE FUNCTION deduct_gold_enhanced(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'personal'
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
    description,
    metadata,
    scope
  )
  VALUES (
    p_user_id,
    'gold',
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'user_id', p_user_id,
    'new_balance', (SELECT gold_coins FROM user_wallets WHERE id = v_wallet_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENHANCED TRANSFER GOLD
-- ============================================================================

CREATE OR REPLACE FUNCTION transfer_gold_enhanced(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT DEFAULT 'transfer',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'personal'
)
RETURNS JSONB AS $$
DECLARE
  v_from_wallet_id UUID;
  v_to_wallet_id UUID;
  v_from_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be positive'
    );
  END IF;

  IF p_from_user_id = p_to_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot transfer to yourself'
    );
  END IF;

  v_from_wallet_id := get_or_create_gold_wallet(p_from_user_id);
  v_to_wallet_id := get_or_create_gold_wallet(p_to_user_id);

  SELECT gold_coins INTO v_from_balance
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

  UPDATE user_wallets
  SET gold_coins = gold_coins - p_amount,
      updated_at = NOW()
  WHERE id = v_from_wallet_id;

  UPDATE user_wallets
  SET gold_coins = gold_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_to_wallet_id;

  INSERT INTO currency_transactions (
    from_user_id,
    to_user_id,
    currency_type,
    amount,
    transaction_type,
    description,
    metadata,
    scope
  )
  VALUES (
    p_from_user_id,
    p_to_user_id,
    'gold',
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
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

-- ============================================================================
-- ENHANCED COMMUNITY COIN OPERATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION add_community_coin_enhanced(
  p_user_id UUID,
  p_community_currency_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'community'
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

  v_wallet_id := get_or_create_community_wallet(p_user_id, p_community_currency_id);

  UPDATE user_wallets
  SET community_coins = community_coins + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO currency_transactions (
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description,
    metadata,
    scope
  )
  VALUES (
    p_user_id,
    'community',
    p_community_currency_id,
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'user_id', p_user_id,
    'new_balance', (SELECT community_coins FROM user_wallets WHERE id = v_wallet_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION deduct_community_coin_enhanced(
  p_user_id UUID,
  p_community_currency_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'community'
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

  v_wallet_id := get_or_create_community_wallet(p_user_id, p_community_currency_id);

  SELECT community_coins INTO v_balance
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
  SET community_coins = community_coins - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO currency_transactions (
    from_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description,
    metadata,
    scope
  )
  VALUES (
    p_user_id,
    'community',
    p_community_currency_id,
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'user_id', p_user_id,
    'new_balance', (SELECT community_coins FROM user_wallets WHERE id = v_wallet_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION add_gold_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_gold_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_gold_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION add_community_coin_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_community_coin_enhanced TO authenticated;

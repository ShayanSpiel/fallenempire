-- ============================================================================
-- APPLY ALL CENTRAL BANK MIGRATIONS AT ONCE
-- Copy this entire file and paste into Supabase SQL Editor, then click RUN
-- ============================================================================

-- This will set up the complete Central Bank transaction tracking system

-- ============================================================================
-- MIGRATION 1: Unified Transaction System
-- ============================================================================

-- Add scope column if it doesn't exist
ALTER TABLE currency_transactions
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'personal'
  CHECK (scope IN ('personal', 'community', 'inter_community', 'global'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_currency_transactions_from_user
  ON currency_transactions(from_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_to_user
  ON currency_transactions(to_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_type
  ON currency_transactions(transaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_scope
  ON currency_transactions(scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_currency_transactions_created_at
  ON currency_transactions(created_at DESC);

-- ============================================================================
-- MIGRATION 2: Enhanced Transaction RPCs
-- ============================================================================

-- Enhanced RPC to add gold with metadata
CREATE OR REPLACE FUNCTION add_gold_enhanced(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'personal'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Ensure wallet exists
  PERFORM get_or_create_gold_wallet(p_user_id);

  -- Update wallet
  UPDATE user_wallets
  SET gold_coins = gold_coins + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND currency_type = 'gold'
  RETURNING gold_coins INTO v_new_balance;

  -- Log transaction
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
    NULL,  -- System adding gold
    p_user_id,
    'gold',
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_added', p_amount
  );
END;
$$;

-- Enhanced RPC to deduct gold with metadata
CREATE OR REPLACE FUNCTION deduct_gold_enhanced(
  p_user_id UUID,
  p_amount NUMERIC,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_scope TEXT DEFAULT 'personal'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  -- Ensure wallet exists
  PERFORM get_or_create_gold_wallet(p_user_id);

  -- Get current balance
  SELECT gold_coins INTO v_current_balance
  FROM user_wallets
  WHERE user_id = p_user_id
    AND currency_type = 'gold';

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient gold (have: %, need: %)', v_current_balance, p_amount;
  END IF;

  -- Update wallet
  UPDATE user_wallets
  SET gold_coins = gold_coins - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND currency_type = 'gold'
  RETURNING gold_coins INTO v_new_balance;

  -- Log transaction
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
    p_user_id,
    NULL,  -- Gold burnt/consumed
    'gold',
    p_amount,
    p_transaction_type,
    p_description,
    p_metadata,
    p_scope
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_deducted', p_amount
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION add_gold_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION deduct_gold_enhanced TO authenticated;

-- ============================================================================
-- MIGRATION 3: Log Market Transactions (Partial - Key Part Only)
-- ============================================================================

-- NOTE: Full migration replaces entire purchase_product_listing function
-- For quick test, verify function exists:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'purchase_product_listing'
  ) THEN
    RAISE NOTICE 'WARNING: purchase_product_listing function does not exist';
  ELSE
    RAISE NOTICE 'purchase_product_listing function exists';
  END IF;
END;
$$;

-- You may need to run the full 20270125_log_market_transactions.sql separately

-- ============================================================================
-- MIGRATION 4: Analytics RPCs
-- ============================================================================

-- Get total gold supply
CREATE OR REPLACE FUNCTION get_total_gold_supply()
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(gold_coins) FROM user_wallets WHERE currency_type = 'gold'),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get gold flow (added vs burnt)
CREATE OR REPLACE FUNCTION get_gold_flow(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_added NUMERIC;
  v_burnt NUMERIC;
BEGIN
  -- Gold ADDED
  SELECT COALESCE(SUM(amount), 0) INTO v_added
  FROM currency_transactions
  WHERE currency_type = 'gold'
    AND to_user_id IS NOT NULL
    AND from_user_id IS NULL
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- Gold BURNT
  SELECT COALESCE(SUM(amount), 0) INTO v_burnt
  FROM currency_transactions
  WHERE currency_type = 'gold'
    AND from_user_id IS NOT NULL
    AND to_user_id IS NULL
    AND created_at BETWEEN p_start_date AND p_end_date;

  RETURN jsonb_build_object(
    'added', v_added,
    'burnt', v_burnt,
    'net_change', v_added - v_burnt
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user transactions
CREATE OR REPLACE FUNCTION get_user_transactions(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  from_user_id UUID,
  to_user_id UUID,
  currency_type TEXT,
  amount NUMERIC,
  transaction_type TEXT,
  description TEXT,
  metadata JSONB,
  scope TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id,
    ct.from_user_id,
    ct.to_user_id,
    ct.currency_type::TEXT,
    ct.amount,
    ct.transaction_type::TEXT,
    ct.description,
    ct.metadata,
    ct.scope::TEXT,
    ct.created_at
  FROM currency_transactions ct
  WHERE ct.from_user_id = p_user_id OR ct.to_user_id = p_user_id
  ORDER BY ct.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get community currencies stats
CREATE OR REPLACE FUNCTION get_community_currencies_stats()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'total_currencies', (SELECT COUNT(*) FROM community_currencies),
    'currencies', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', id,
          'community_id', community_id,
          'currency_name', currency_name,
          'currency_symbol', currency_symbol,
          'exchange_rate_to_gold', exchange_rate_to_gold,
          'total_supply', total_supply
        )
      )
      FROM community_currencies
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_total_gold_supply TO authenticated;
GRANT EXECUTE ON FUNCTION get_gold_flow TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_currencies_stats TO authenticated;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if everything is set up
DO $$
DECLARE
  v_has_scope BOOLEAN;
  v_has_indexes BOOLEAN;
  v_has_rpcs BOOLEAN;
  v_transaction_count BIGINT;
BEGIN
  -- Check scope column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'currency_transactions' AND column_name = 'scope'
  ) INTO v_has_scope;

  -- Check indexes
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'currency_transactions'
      AND indexname = 'idx_currency_transactions_scope'
  ) INTO v_has_indexes;

  -- Check RPC functions
  SELECT COUNT(*) = 5 INTO v_has_rpcs
  FROM pg_proc
  WHERE proname IN (
    'add_gold_enhanced',
    'deduct_gold_enhanced',
    'get_total_gold_supply',
    'get_gold_flow',
    'get_user_transactions'
  );

  -- Count transactions
  SELECT COUNT(*) INTO v_transaction_count FROM currency_transactions;

  -- Report
  RAISE NOTICE '=== CENTRAL BANK SETUP STATUS ===';
  RAISE NOTICE 'Scope column: %', CASE WHEN v_has_scope THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Performance indexes: %', CASE WHEN v_has_indexes THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'RPC functions: %', CASE WHEN v_has_rpcs THEN '✓ YES' ELSE '✗ NO' END;
  RAISE NOTICE 'Total transactions: %', v_transaction_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Go to /centralbank page';
  RAISE NOTICE '2. Start a battle (costs 10 gold)';
  RAISE NOTICE '3. Refresh page - transaction should appear';
  RAISE NOTICE '';
  RAISE NOTICE 'If transactions still do not appear, you need to:';
  RAISE NOTICE '- Apply 20270125_log_market_transactions.sql for market purchases';
  RAISE NOTICE '- Apply 20270125_log_wages_transactions.sql for wage payments';
END;
$$;

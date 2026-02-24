-- Migration: Issue Currency Law System
-- Adds ISSUE_CURRENCY law type and auto-creates currencies with 0 supply

-- 1. Add ISSUE_CURRENCY to law_type constraint
ALTER TABLE community_proposals DROP CONSTRAINT IF EXISTS law_type_valid;
ALTER TABLE community_proposals ADD CONSTRAINT law_type_valid CHECK (
  law_type IN (
    'DECLARE_WAR',
    'PROPOSE_HEIR',
    'CHANGE_GOVERNANCE',
    'MESSAGE_OF_THE_DAY',
    'WORK_TAX',
    'IMPORT_TARIFF',
    'CFC_ALLIANCE',
    'ISSUE_CURRENCY'
  )
);

-- 2. Create function to auto-create currency when community is created
CREATE OR REPLACE FUNCTION create_initial_currency()
RETURNS TRIGGER AS $$
DECLARE
  v_currency_symbol TEXT;
BEGIN
  -- Generate currency symbol from first 2 letters of community name + 'C'
  v_currency_symbol := UPPER(SUBSTRING(NEW.name FROM 1 FOR 2)) || 'C';

  -- Ensure uniqueness by appending numbers if needed
  WHILE EXISTS (SELECT 1 FROM community_currencies WHERE currency_symbol = v_currency_symbol) LOOP
    v_currency_symbol := UPPER(SUBSTRING(NEW.name FROM 1 FOR 2)) || FLOOR(RANDOM() * 100)::TEXT;
  END LOOP;

  -- Create currency record with 0 supply
  INSERT INTO community_currencies (
    community_id,
    currency_name,
    currency_symbol,
    exchange_rate_to_gold,
    total_supply
  ) VALUES (
    NEW.id,
    NEW.name || ' Coin',
    v_currency_symbol,
    1.0,
    0
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on community creation
DROP TRIGGER IF EXISTS on_community_created ON communities;
CREATE TRIGGER on_community_created
  AFTER INSERT ON communities
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_currency();

-- 4. Backfill currencies for existing communities without one
DO $$
DECLARE
  v_community RECORD;
  v_currency_symbol TEXT;
  v_exists BOOLEAN;
BEGIN
  FOR v_community IN
    SELECT c.id, c.name
    FROM communities c
    WHERE NOT EXISTS (
      SELECT 1 FROM community_currencies cc WHERE cc.community_id = c.id
    )
  LOOP
    -- Generate currency symbol
    v_currency_symbol := UPPER(SUBSTRING(v_community.name FROM 1 FOR 2)) || 'C';

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM community_currencies WHERE currency_symbol = v_currency_symbol) LOOP
      v_currency_symbol := UPPER(SUBSTRING(v_community.name FROM 1 FOR 2)) || FLOOR(RANDOM() * 100)::TEXT;
    END LOOP;

    -- Insert currency with 0 supply if they haven't issued yet
    INSERT INTO community_currencies (
      community_id,
      currency_name,
      currency_symbol,
      exchange_rate_to_gold,
      total_supply
    ) VALUES (
      v_community.id,
      v_community.name || ' Coin',
      v_currency_symbol,
      1.0,
      0
    );

    RAISE NOTICE 'Created currency for community: % (symbol: %)', v_community.name, v_currency_symbol;
  END LOOP;
END;
$$;

-- 5. Add RPC function to get community gold treasury balance
CREATE OR REPLACE FUNCTION get_community_gold_balance(p_community_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT COALESCE(gold_coins, 0)
  INTO v_balance
  FROM community_wallets
  WHERE community_id = p_community_id
    AND currency_type = 'gold';

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_community_gold_balance(UUID) TO authenticated;

-- 6. Add RPC function to issue currency (called by law execution)
CREATE OR REPLACE FUNCTION issue_community_currency(
  p_community_id UUID,
  p_gold_amount NUMERIC,
  p_conversion_rate NUMERIC,
  p_law_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_currency_id UUID;
  v_currency_symbol TEXT;
  v_gold_wallet_id UUID;
  v_currency_wallet_id UUID;
  v_currency_amount NUMERIC;
  v_current_gold_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Validate inputs
  IF p_gold_amount <= 0 THEN
    RAISE EXCEPTION 'Gold amount must be greater than 0';
  END IF;

  IF p_conversion_rate <= 0 THEN
    RAISE EXCEPTION 'Conversion rate must be greater than 0';
  END IF;

  -- Get currency info
  SELECT id, currency_symbol INTO v_currency_id, v_currency_symbol
  FROM community_currencies
  WHERE community_id = p_community_id;

  IF v_currency_id IS NULL THEN
    RAISE EXCEPTION 'No currency found for community';
  END IF;

  -- Get or create gold wallet
  SELECT get_or_create_community_gold_wallet(p_community_id) INTO v_gold_wallet_id;

  -- Check gold balance
  SELECT COALESCE(gold_coins, 0) INTO v_current_gold_balance
  FROM community_wallets
  WHERE id = v_gold_wallet_id;

  IF v_current_gold_balance < p_gold_amount THEN
    RAISE EXCEPTION 'Insufficient gold in treasury. Available: %, Required: %',
      v_current_gold_balance, p_gold_amount;
  END IF;

  -- Calculate currency amount
  v_currency_amount := p_gold_amount * p_conversion_rate;

  -- Deduct gold from treasury (burn it)
  UPDATE community_wallets
  SET gold_coins = gold_coins - p_gold_amount,
      updated_at = NOW()
  WHERE id = v_gold_wallet_id;

  -- Get or create community currency wallet
  SELECT get_or_create_community_currency_wallet(p_community_id, v_currency_id)
  INTO v_currency_wallet_id;

  -- Add currency to treasury
  UPDATE community_wallets
  SET community_coins = community_coins + v_currency_amount,
      updated_at = NOW()
  WHERE id = v_currency_wallet_id;

  -- Update total supply
  UPDATE community_currencies
  SET total_supply = total_supply + v_currency_amount,
      updated_at = NOW()
  WHERE id = v_currency_id;

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
    NULL, -- No from_user (system/treasury operation)
    NULL, -- No to_user (goes to community treasury)
    'community',
    v_currency_id,
    v_currency_amount,
    'reward', -- Using existing type, will represent currency issuance
    format('Issued %s %s by converting %s gold at rate 1:%s',
      v_currency_amount, v_currency_symbol, p_gold_amount, p_conversion_rate),
    'community',
    jsonb_build_object(
      'gold_burned', p_gold_amount,
      'conversion_rate', p_conversion_rate,
      'currency_issued', v_currency_amount,
      'law_id', p_law_id,
      'operation', 'currency_issuance'
    )
  ) RETURNING id INTO v_transaction_id;

  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'currency_issued', v_currency_amount,
    'gold_burned', p_gold_amount,
    'conversion_rate', p_conversion_rate,
    'currency_symbol', v_currency_symbol,
    'transaction_id', v_transaction_id,
    'new_total_supply', (SELECT total_supply FROM community_currencies WHERE id = v_currency_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION issue_community_currency(UUID, NUMERIC, NUMERIC, UUID) TO authenticated;

-- 7. Add comment for documentation
COMMENT ON FUNCTION issue_community_currency IS
  'Issues community currency by burning gold from treasury. Called by ISSUE_CURRENCY law execution.';

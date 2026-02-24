-- Work Tax System and Community Treasury
-- Enables communities to tax work actions and collect funds in treasury

-- ============================================================================
-- 1. Community Tax Rates
-- ============================================================================

-- Add work tax rate to communities (percentage as decimal, e.g., 0.10 = 10%)
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS work_tax_rate NUMERIC DEFAULT 0 CHECK (work_tax_rate >= 0 AND work_tax_rate <= 1);

COMMENT ON COLUMN communities.work_tax_rate IS 'Work tax rate as decimal (0.10 = 10%). Deducted from employee wages and manager work.';

-- ============================================================================
-- 2. Community Treasury Wallets
-- ============================================================================

-- Community wallets for treasury (stores gold and community coins)
CREATE TABLE IF NOT EXISTS community_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  currency_type TEXT NOT NULL DEFAULT 'gold' CHECK (currency_type IN ('gold', 'community')),

  -- For gold treasury
  gold_coins NUMERIC DEFAULT 0 CHECK (gold_coins >= 0),

  -- For community currency treasury
  community_currency_id UUID REFERENCES community_currencies(id) ON DELETE CASCADE,
  community_coins NUMERIC DEFAULT 0 CHECK (community_coins >= 0),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each community has one gold wallet
  CONSTRAINT unique_community_gold_wallet UNIQUE(community_id, currency_type) DEFERRABLE INITIALLY DEFERRED,
  -- Each community can have one wallet per community currency
  CONSTRAINT unique_community_currency_wallet UNIQUE(community_id, community_currency_id) DEFERRABLE INITIALLY DEFERRED,
  -- Gold wallets don't have community_currency_id
  CONSTRAINT community_gold_wallet_no_currency CHECK (
    (currency_type = 'gold' AND community_currency_id IS NULL) OR
    (currency_type = 'community' AND community_currency_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_community_wallets_community_id ON community_wallets(community_id);
CREATE INDEX IF NOT EXISTS idx_community_wallets_currency_type ON community_wallets(currency_type);

-- ============================================================================
-- 3. Update Law System for Work Tax Proposals
-- ============================================================================

-- Add WORK_TAX to allowed law types
ALTER TABLE community_proposals
  DROP CONSTRAINT IF EXISTS law_type_valid;

ALTER TABLE community_proposals
  ADD CONSTRAINT law_type_valid CHECK (
    law_type IN (
      'DECLARE_WAR',
      'PROPOSE_HEIR',
      'CHANGE_GOVERNANCE',
      'MESSAGE_OF_THE_DAY',
      'WORK_TAX'
    )
  );

-- ============================================================================
-- 4. RLS Policies for Community Wallets
-- ============================================================================

ALTER TABLE community_wallets ENABLE ROW LEVEL SECURITY;

-- Community members can view their community's treasury
DROP POLICY IF EXISTS "Members can view community treasury" ON community_wallets;
CREATE POLICY "Members can view community treasury"
  ON community_wallets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_wallets.community_id
        AND cm.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- Only system can modify community wallets (via functions)
DROP POLICY IF EXISTS "System can insert community wallets" ON community_wallets;
CREATE POLICY "System can insert community wallets"
  ON community_wallets FOR INSERT
  TO authenticated
  WITH CHECK (false); -- Only service role

DROP POLICY IF EXISTS "System can update community wallets" ON community_wallets;
CREATE POLICY "System can update community wallets"
  ON community_wallets FOR UPDATE
  TO authenticated
  USING (false); -- Only service role

-- ============================================================================
-- 5. Helper Functions for Community Treasury
-- ============================================================================

-- Get or create community gold wallet
CREATE OR REPLACE FUNCTION get_or_create_community_gold_wallet(p_community_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM community_wallets
  WHERE community_id = p_community_id AND currency_type = 'gold';

  -- Create if doesn't exist
  IF v_wallet_id IS NULL THEN
    INSERT INTO community_wallets (community_id, currency_type, gold_coins)
    VALUES (p_community_id, 'gold', 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create community currency wallet
CREATE OR REPLACE FUNCTION get_or_create_community_currency_wallet(
  p_community_id UUID,
  p_community_currency_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM community_wallets
  WHERE community_id = p_community_id
    AND currency_type = 'community'
    AND community_currency_id = p_community_currency_id;

  -- Create if doesn't exist
  IF v_wallet_id IS NULL THEN
    INSERT INTO community_wallets (
      community_id,
      currency_type,
      community_currency_id,
      community_coins
    )
    VALUES (p_community_id, 'community', p_community_currency_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add funds to community treasury (from tax collection)
CREATE OR REPLACE FUNCTION add_to_community_treasury(
  p_community_id UUID,
  p_currency_type TEXT,
  p_community_currency_id UUID,
  p_amount NUMERIC,
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

  -- Get or create appropriate wallet
  IF p_currency_type = 'gold' THEN
    v_wallet_id := get_or_create_community_gold_wallet(p_community_id);

    UPDATE community_wallets
    SET gold_coins = gold_coins + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSIF p_currency_type = 'community' THEN
    v_wallet_id := get_or_create_community_currency_wallet(p_community_id, p_community_currency_id);

    UPDATE community_wallets
    SET community_coins = community_coins + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet_id;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid currency type'
    );
  END IF;

  -- Record transaction
  INSERT INTO currency_transactions (
    to_user_id,
    currency_type,
    community_currency_id,
    amount,
    transaction_type,
    description,
    metadata
  )
  VALUES (
    NULL, -- Treasury receives, no specific user
    p_currency_type,
    p_community_currency_id,
    p_amount,
    'tax',
    p_description,
    jsonb_build_object('community_id', p_community_id, 'tax_type', 'work_tax')
  )
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', p_amount,
    'wallet_id', v_wallet_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Initialization
-- ============================================================================

-- Create gold treasury wallets for all existing communities
DO $$
DECLARE
  v_community RECORD;
BEGIN
  FOR v_community IN SELECT id FROM communities LOOP
    PERFORM get_or_create_community_gold_wallet(v_community.id);
  END LOOP;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_community_gold_wallet(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_community_currency_wallet(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_to_community_treasury(UUID, TEXT, UUID, NUMERIC, TEXT) TO authenticated;

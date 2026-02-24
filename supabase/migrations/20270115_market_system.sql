-- Market System: Unified market_listings table for products, jobs, and exchanges
-- Part of Economy Module Feature 9

-- ============================================================================
-- 1. MARKET LISTINGS TABLE (Unified for all listing types)
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('product', 'job', 'exchange')),

  -- Common fields
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'filled', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Product listing fields (when listing_type = 'product')
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE NULL,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE NULL,
  quality_id UUID REFERENCES resource_qualities(id) ON DELETE RESTRICT NULL,
  quantity NUMERIC NULL CHECK (quantity IS NULL OR quantity > 0),
  price_per_unit_gold NUMERIC NULL CHECK (price_per_unit_gold IS NULL OR price_per_unit_gold >= 0),
  price_per_unit_community_coin NUMERIC NULL CHECK (price_per_unit_community_coin IS NULL OR price_per_unit_community_coin >= 0),

  -- Job listing fields (when listing_type = 'job')
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NULL,
  position_title TEXT NULL,
  positions_available INT NULL CHECK (positions_available IS NULL OR positions_available >= 0),
  wage_per_day_community_coin NUMERIC NULL CHECK (wage_per_day_community_coin IS NULL OR wage_per_day_community_coin >= 0),
  requirements JSONB DEFAULT '{}',

  -- Exchange listing fields (when listing_type = 'exchange')
  exchanger_id UUID REFERENCES users(id) ON DELETE CASCADE NULL,
  offer_currency_type TEXT NULL CHECK (offer_currency_type IN ('gold', 'community_coin')),
  offer_amount NUMERIC NULL CHECK (offer_amount IS NULL OR offer_amount > 0),
  want_currency_type TEXT NULL CHECK (want_currency_type IN ('gold', 'community_coin')),
  want_amount NUMERIC NULL CHECK (want_amount IS NULL OR want_amount > 0),
  exchange_rate NUMERIC NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_listings_community ON market_listings(community_id);
CREATE INDEX IF NOT EXISTS idx_market_listings_type_status ON market_listings(listing_type, status);
CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON market_listings(seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_listings_company ON market_listings(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_listings_resource ON market_listings(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_listings_quality ON market_listings(quality_id) WHERE quality_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_market_listings_active ON market_listings(listing_type, status, community_id) WHERE status = 'active';

-- Fix legacy CHECK constraint name generated from older column definition
ALTER TABLE public.market_listings
  DROP CONSTRAINT IF EXISTS market_listings_positions_available_check;
ALTER TABLE public.market_listings
  ADD CONSTRAINT market_listings_positions_available_check
  CHECK (positions_available IS NULL OR positions_available >= 0);

-- ============================================================================
-- 2. TRADE HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES market_listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES users(id) ON DELETE CASCADE NULL,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('product', 'currency_exchange', 'job')),
  amount_transferred JSONB NOT NULL,
  trade_tariff_paid NUMERIC DEFAULT 0,
  executed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trade_history_buyer ON trade_history(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_seller ON trade_history(seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trade_history_listing ON trade_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_executed ON trade_history(executed_at DESC);

-- ============================================================================
-- 3. RPC FUNCTIONS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- Get market listings with filters
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_market_listings(TEXT, UUID[], UUID[], UUID[], INT, INT);
CREATE OR REPLACE FUNCTION get_market_listings(
  p_listing_type TEXT DEFAULT 'product',
  p_community_ids UUID[] DEFAULT NULL,
  p_resource_ids UUID[] DEFAULT NULL,
  p_quality_ids UUID[] DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  listing_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  -- Product fields
  seller_id UUID,
  seller_username TEXT,
  resource_id UUID,
  resource_key TEXT,
  resource_name TEXT,
  quality_id UUID,
  quality_key TEXT,
  quality_name TEXT,
  quality_stars INT,
  quantity NUMERIC,
  price_per_unit_gold NUMERIC,
  price_per_unit_community_coin NUMERIC,
  -- Job fields
  company_id UUID,
  company_name TEXT,
  company_owner_id UUID,
  company_owner_username TEXT,
  position_title TEXT,
  positions_available INT,
  wage_per_day_community_coin NUMERIC,
  requirements JSONB,
  -- Exchange fields
  exchanger_id UUID,
  exchanger_username TEXT,
  offer_currency_type TEXT,
  offer_amount NUMERIC,
  want_currency_type TEXT,
  want_amount NUMERIC,
  exchange_rate NUMERIC,
  -- Common
  community_id UUID,
  community_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.listing_type,
    ml.status,
    ml.created_at,
    ml.expires_at,
    -- Product fields
    ml.seller_id,
    seller.username AS seller_username,
    ml.resource_id,
    r.key AS resource_key,
    r.name AS resource_name,
    ml.quality_id,
    q.key AS quality_key,
    q.name AS quality_name,
    q.quality_level AS quality_stars,
    ml.quantity,
    ml.price_per_unit_gold,
    ml.price_per_unit_community_coin,
    -- Job fields
    ml.company_id,
    c.name AS company_name,
    c.owner_id AS company_owner_id,
    owner.username AS company_owner_username,
    ml.position_title,
    ml.positions_available,
    ml.wage_per_day_community_coin,
    ml.requirements,
    -- Exchange fields
    ml.exchanger_id,
    exchanger.username AS exchanger_username,
    ml.offer_currency_type,
    ml.offer_amount,
    ml.want_currency_type,
    ml.want_amount,
    ml.exchange_rate,
    -- Common
    ml.community_id,
    com.name AS community_name
  FROM market_listings ml
  LEFT JOIN users seller ON ml.seller_id = seller.id
  LEFT JOIN users exchanger ON ml.exchanger_id = exchanger.id
  LEFT JOIN resources r ON ml.resource_id = r.id
  LEFT JOIN resource_qualities q ON ml.quality_id = q.id
  LEFT JOIN companies c ON ml.company_id = c.id
  LEFT JOIN users owner ON c.owner_id = owner.id
  LEFT JOIN communities com ON ml.community_id = com.id
  WHERE
    ml.listing_type = p_listing_type
    AND ml.status = 'active'
    AND (p_community_ids IS NULL OR ml.community_id = ANY(p_community_ids))
    AND (p_resource_ids IS NULL OR ml.resource_id = ANY(p_resource_ids))
    AND (p_quality_ids IS NULL OR ml.quality_id = ANY(p_quality_ids))
    AND (ml.expires_at IS NULL OR ml.expires_at > NOW())
  ORDER BY
    CASE
      WHEN p_listing_type = 'product' THEN ml.price_per_unit_gold
      WHEN p_listing_type = 'job' THEN ml.wage_per_day_community_coin
      ELSE NULL
    END ASC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- -----------------------------------------------------------------------------
-- Create product listing
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS create_product_listing(UUID, UUID, UUID, UUID, NUMERIC, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION create_product_listing(
  p_seller_id UUID,
  p_community_id UUID,
  p_resource_id UUID,
  p_quality_id UUID,
  p_quantity NUMERIC,
  p_price_per_unit_gold NUMERIC DEFAULT NULL,
  p_price_per_unit_community_coin NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing_id UUID;
  v_user_has_item BOOLEAN;
  v_inventory_qty NUMERIC := 0;
  v_wilderness_qty NUMERIC := 0;
  v_has_metadata BOOLEAN := false;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Ensure caller can only create listings for themselves
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_public_user_id <> p_seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_inventory'
      AND column_name = 'metadata'
  ) INTO v_has_metadata;

  -- Verify user has the item in inventory
  SELECT EXISTS(
    SELECT 1 FROM user_inventory
    WHERE user_id = p_seller_id
      AND resource_id = p_resource_id
      AND quality_id = p_quality_id
      AND quantity >= p_quantity
  ) INTO v_user_has_item;

  IF NOT v_user_has_item THEN
    RAISE EXCEPTION 'Insufficient inventory to create listing';
  END IF;

  -- Block selling wilderness-produced goods (until market licenses exist)
  IF v_has_metadata THEN
    SELECT
      ui.quantity,
      COALESCE((ui.metadata->>'wilderness_qty')::NUMERIC, 0)
    INTO
      v_inventory_qty,
      v_wilderness_qty
    FROM public.user_inventory ui
    WHERE ui.user_id = p_seller_id
      AND ui.resource_id = p_resource_id
      AND ui.quality_id = p_quality_id;

    IF COALESCE(v_inventory_qty, 0) - COALESCE(v_wilderness_qty, 0) < p_quantity THEN
      RAISE EXCEPTION 'Cannot sell wilderness-produced goods without a market license';
    END IF;
  END IF;

  -- Must specify at least one price
  IF p_price_per_unit_gold IS NULL AND p_price_per_unit_community_coin IS NULL THEN
    RAISE EXCEPTION 'Must specify at least one price (gold or community coin)';
  END IF;

  -- Reserve items from inventory (deduct immediately)
  UPDATE user_inventory
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE user_id = p_seller_id
    AND resource_id = p_resource_id
    AND quality_id = p_quality_id;

  -- Create listing
  INSERT INTO market_listings (
    listing_type,
    community_id,
    seller_id,
    resource_id,
    quality_id,
    quantity,
    price_per_unit_gold,
    price_per_unit_community_coin,
    expires_at
  ) VALUES (
    'product',
    p_community_id,
    p_seller_id,
    p_resource_id,
    p_quality_id,
    p_quantity,
    p_price_per_unit_gold,
    p_price_per_unit_community_coin,
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Purchase product from market
-- -----------------------------------------------------------------------------
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
  v_community_tariff_rate NUMERIC := 5; -- 5% default
  v_community_currency_id UUID;
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

  -- Calculate tariff (5% trade tax)
  IF v_total_price_gold > 0 THEN
    v_tariff := v_total_price_gold * (v_community_tariff_rate / 100);
  END IF;

  -- Transfer gold from buyer to seller
  IF v_total_price_gold > 0 THEN
    UPDATE user_wallets
    SET gold_coins = gold_coins - v_total_price_gold,
        updated_at = NOW()
    WHERE user_id = p_buyer_id
      AND currency_type = 'gold';

    UPDATE user_wallets
    SET gold_coins = gold_coins + (v_total_price_gold - v_tariff),
        updated_at = NOW()
    WHERE user_id = v_listing.seller_id
      AND currency_type = 'gold';
  END IF;

  -- Transfer community coins (if applicable)
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
      'community_coin_paid', v_total_price_cc
    ),
    v_tariff
  );

  RETURN jsonb_build_object(
    'success', true,
    'quantity_purchased', p_quantity,
    'gold_paid', v_total_price_gold,
    'community_coin_paid', v_total_price_cc,
    'tariff_paid', v_tariff
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Create job listing
-- -----------------------------------------------------------------------------
-- Older variants (wage_gold existed previously)
DROP FUNCTION IF EXISTS create_job_listing(UUID, UUID, TEXT, INT, NUMERIC, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS create_job_listing(UUID, UUID, TEXT, INT, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION create_job_listing(
  p_company_id UUID,
  p_community_id UUID,
  p_position_title TEXT,
  p_positions_available INT,
  p_wage_per_day_community_coin NUMERIC DEFAULT 0,
  p_requirements JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing_id UUID;
  v_company_owner_id UUID;
  v_company_hex_id TEXT;
  v_hex_owner_community_id UUID;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF p_positions_available IS NULL OR p_positions_available < 1 THEN
    RAISE EXCEPTION 'Positions available must be at least 1';
  END IF;

  IF p_wage_per_day_community_coin IS NULL OR p_wage_per_day_community_coin < 0.01 THEN
    RAISE EXCEPTION 'Wage must be at least 0.01 community coin per day';
  END IF;

  -- Ensure only the company owner can post jobs
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  SELECT owner_id, hex_id
  INTO v_company_owner_id, v_company_hex_id
  FROM public.companies
  WHERE id = p_company_id;

  IF v_company_owner_id IS NULL OR v_company_hex_id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_company_owner_id <> v_public_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT owner_community_id
  INTO v_hex_owner_community_id
  FROM public.world_regions
  WHERE hex_id = btrim(v_company_hex_id);

  IF v_hex_owner_community_id IS NULL THEN
    RAISE EXCEPTION 'Your company is in wilderness. No employees to hire here!';
  END IF;

  IF p_community_id IS NULL OR p_community_id <> v_hex_owner_community_id THEN
    RAISE EXCEPTION 'Company community mismatch';
  END IF;

  -- Best-effort: keep companies.community_id aligned
  UPDATE public.companies
  SET community_id = v_hex_owner_community_id,
      updated_at = NOW()
  WHERE id = p_company_id
    AND community_id IS DISTINCT FROM v_hex_owner_community_id;

  INSERT INTO market_listings (
    listing_type,
    community_id,
    company_id,
    position_title,
    positions_available,
    wage_per_day_community_coin,
    requirements
  ) VALUES (
    'job',
    p_community_id,
    p_company_id,
    p_position_title,
    p_positions_available,
    p_wage_per_day_community_coin,
    p_requirements
  )
  RETURNING id INTO v_listing_id;

  RETURN v_listing_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Apply to job (instant hire)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS apply_to_job(UUID, UUID);
CREATE OR REPLACE FUNCTION apply_to_job(
  p_applicant_id UUID,
  p_listing_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing RECORD;
  v_company RECORD;
  v_hex_owner_community_id UUID;
  v_existing_contract UUID;
  v_has_left_at BOOLEAN := false;
  v_is_member BOOLEAN := false;
  v_is_located BOOLEAN := false;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Ensure caller can only apply as themselves
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_public_user_id <> p_applicant_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get job listing
  SELECT * INTO v_listing
  FROM market_listings
  WHERE id = p_listing_id
    AND listing_type = 'job'
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job listing not found or not active';
  END IF;

  -- Validate company + governance (companies follow hex ownership)
  SELECT c.id, c.owner_id, c.hex_id
  INTO v_company
  FROM public.companies c
  WHERE c.id = v_listing.company_id;

  IF v_company.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_company.owner_id = p_applicant_id THEN
    RAISE EXCEPTION 'You cannot be hired by your own company. Work there as manager instead.';
  END IF;

  SELECT wr.owner_community_id
  INTO v_hex_owner_community_id
  FROM public.world_regions wr
  WHERE wr.hex_id = btrim(v_company.hex_id);

  IF v_hex_owner_community_id IS NULL THEN
    RAISE EXCEPTION 'This job is no longer available (company is in wilderness)';
  END IF;

  IF v_hex_owner_community_id <> v_listing.community_id THEN
    RAISE EXCEPTION 'This job is no longer available (company governance changed)';
  END IF;

  -- Community members can apply from anywhere; non-members must be currently located in that community
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_applicant_id
        AND cm.community_id = v_listing.community_id
        AND cm.left_at IS NULL
    ) INTO v_is_member;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_applicant_id
        AND cm.community_id = v_listing.community_id
    ) INTO v_is_member;
  END IF;

  SELECT (u.main_community_id = v_listing.community_id)
  INTO v_is_located
  FROM public.users u
  WHERE u.id = p_applicant_id;

  IF NOT v_is_member AND NOT COALESCE(v_is_located, false) THEN
    RAISE EXCEPTION 'Travel to this community before applying to jobs here';
  END IF;

  IF v_listing.positions_available <= 0 THEN
    RAISE EXCEPTION 'No positions available';
  END IF;

  -- Check if already employed at this company
  SELECT id INTO v_existing_contract
  FROM employment_contracts
  WHERE company_id = v_listing.company_id
    AND employee_id = p_applicant_id
    AND employee_type = 'player'
    AND active = true;

  IF v_existing_contract IS NOT NULL THEN
    RAISE EXCEPTION 'Already employed at this company';
  END IF;

  -- Create employment contract
  INSERT INTO employment_contracts (
    company_id,
    employee_type,
    employee_id,
    wage_per_day_community_coin,
    position
  ) VALUES (
    v_listing.company_id,
    'player',
    p_applicant_id,
    v_listing.wage_per_day_community_coin,
    v_listing.position_title
  );

  -- Decrement openings; when it hits 0, mark listing filled.
  UPDATE market_listings
  SET
    positions_available = GREATEST(positions_available - 1, 0),
    status = CASE WHEN positions_available - 1 <= 0 THEN 'filled' ELSE status END,
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- Record in trade history
  INSERT INTO trade_history (
    listing_id,
    buyer_id,
    seller_id,
    trade_type,
    amount_transferred
  ) VALUES (
    p_listing_id,
    p_applicant_id,
    (SELECT owner_id FROM companies WHERE id = v_listing.company_id),
    'job',
    jsonb_build_object(
      'company_id', v_listing.company_id,
      'position', v_listing.position_title,
      'wage_cc', v_listing.wage_per_day_community_coin
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_listing.company_id,
    'position', v_listing.position_title,
    'wage_cc', v_listing.wage_per_day_community_coin
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Cancel listing (return items to seller)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS cancel_market_listing(UUID, UUID);
CREATE OR REPLACE FUNCTION cancel_market_listing(
  p_listing_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing RECORD;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_public_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get listing
  SELECT * INTO v_listing
  FROM market_listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Verify ownership
  IF v_listing.listing_type = 'product' AND v_listing.seller_id != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to cancel this listing';
  ELSIF v_listing.listing_type = 'exchange' AND v_listing.exchanger_id != p_user_id THEN
    RAISE EXCEPTION 'Not authorized to cancel this listing';
  ELSIF v_listing.listing_type = 'job' THEN
    -- Check if user owns the company
    IF NOT EXISTS(SELECT 1 FROM companies WHERE id = v_listing.company_id AND owner_id = p_user_id) THEN
      RAISE EXCEPTION 'Not authorized to cancel this listing';
    END IF;
  END IF;

  -- Return items to seller (if product listing)
  IF v_listing.listing_type = 'product' THEN
    INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
    VALUES (v_listing.seller_id, v_listing.resource_id, v_listing.quality_id, v_listing.quantity)
    ON CONFLICT (user_id, resource_id, quality_id)
    DO UPDATE SET
      quantity = user_inventory.quantity + v_listing.quantity,
      updated_at = NOW();
  END IF;

  -- Mark as cancelled
  UPDATE market_listings
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_listing_id;

  RETURN true;
END;
$$;

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

-- Anyone can view active listings
DROP POLICY IF EXISTS "market_listings_select_all" ON market_listings;
CREATE POLICY "market_listings_select_all" ON market_listings
  FOR SELECT
  USING (status = 'active' OR status = 'filled');

-- Only seller/owner can insert their own listings
DROP POLICY IF EXISTS "market_listings_insert_own" ON market_listings;
CREATE POLICY "market_listings_insert_own" ON market_listings
  FOR INSERT
  WITH CHECK (
    (listing_type = 'product' AND seller_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)) OR
    (listing_type = 'exchange' AND exchanger_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)) OR
    (listing_type = 'job' AND company_id IN (
      SELECT id FROM public.companies
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)
    ))
  );

-- Only seller/owner can cancel their listings
DROP POLICY IF EXISTS "market_listings_update_own" ON market_listings;
CREATE POLICY "market_listings_update_own" ON market_listings
  FOR UPDATE
  USING (
    (listing_type = 'product' AND seller_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)) OR
    (listing_type = 'exchange' AND exchanger_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)) OR
    (listing_type = 'job' AND company_id IN (
      SELECT id FROM public.companies
      WHERE owner_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)
    ))
  );

-- Trade history: view your own trades
DROP POLICY IF EXISTS "trade_history_select_own" ON trade_history;
CREATE POLICY "trade_history_select_own" ON trade_history
  FOR SELECT
  USING (
    buyer_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)
    OR seller_id IN (SELECT id FROM public.users WHERE auth_id::text = auth.uid()::text)
  );

-- ============================================================================
-- 5. CLEANUP EXPIRED LISTINGS (CRON JOB)
-- ============================================================================
DROP FUNCTION IF EXISTS cleanup_expired_market_listings();

CREATE OR REPLACE FUNCTION cleanup_expired_market_listings()
RETURNS INT AS $$
DECLARE
  v_updated_count INT;
BEGIN
  -- Return items to sellers for expired product listings
  INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
  SELECT
    seller_id,
    resource_id,
    quality_id,
    quantity
  FROM market_listings
  WHERE listing_type = 'product'
    AND status = 'active'
    AND expires_at < NOW()
  ON CONFLICT (user_id, resource_id, quality_id)
  DO UPDATE SET
    quantity = user_inventory.quantity + EXCLUDED.quantity,
    updated_at = NOW();

  -- Mark all expired listings as expired
  UPDATE market_listings
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Add to cron (run hourly)
-- SELECT cron.schedule('cleanup-expired-listings', '0 * * * *', 'SELECT cleanup_expired_market_listings();');

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON market_listings TO authenticated;
GRANT INSERT ON market_listings TO authenticated;
GRANT UPDATE ON market_listings TO authenticated;
GRANT SELECT ON trade_history TO authenticated;
GRANT INSERT ON trade_history TO authenticated;

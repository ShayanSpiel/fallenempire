-- ============================================================================
-- COMPREHENSIVE FIX: RLS + Column Error + Production Quantities
-- Apply this ONCE in Supabase SQL Editor
-- ============================================================================

-- 1. Enable RLS
ALTER TABLE market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;

-- 2. Drop and recreate RLS policies
DROP POLICY IF EXISTS "market_listings_select_all" ON market_listings;
DROP POLICY IF EXISTS "market_listings_insert_own" ON market_listings;
DROP POLICY IF EXISTS "market_listings_update_own" ON market_listings;
DROP POLICY IF EXISTS "trade_history_select_own" ON trade_history;

CREATE POLICY "market_listings_select_all" ON market_listings
  FOR SELECT
  USING (status = 'active' OR status = 'filled');

CREATE POLICY "market_listings_insert_own" ON market_listings
  FOR INSERT
  WITH CHECK (
    (listing_type = 'product' AND seller_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
    (listing_type = 'exchange' AND exchanger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
    (listing_type = 'job' AND company_id IN (SELECT id FROM companies WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())))
  );

CREATE POLICY "market_listings_update_own" ON market_listings
  FOR UPDATE
  USING (
    (listing_type = 'product' AND seller_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
    (listing_type = 'exchange' AND exchanger_id IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR
    (listing_type = 'job' AND company_id IN (SELECT id FROM companies WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())))
  );

CREATE POLICY "trade_history_select_own" ON trade_history
  FOR SELECT
  USING (buyer_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR seller_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- 3. Fix get_market_listings function (q.stars -> q.quality_level)
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
  company_id UUID,
  company_name TEXT,
  company_owner_id UUID,
  company_owner_username TEXT,
  position_title TEXT,
  positions_available INT,
  wage_per_day_community_coin NUMERIC,
  requirements JSONB,
  exchanger_id UUID,
  exchanger_username TEXT,
  offer_currency_type TEXT,
  offer_amount NUMERIC,
  want_currency_type TEXT,
  want_amount NUMERIC,
  exchange_rate NUMERIC,
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
    ml.company_id,
    c.name AS company_name,
    c.owner_id AS company_owner_id,
    owner.username AS company_owner_username,
    ml.position_title,
    ml.positions_available,
    ml.wage_per_day_community_coin,
    ml.requirements,
    ml.exchanger_id,
    exchanger.username AS exchanger_username,
    ml.offer_currency_type,
    ml.offer_amount,
    ml.want_currency_type,
    ml.want_amount,
    ml.exchange_rate,
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

-- 4. Fix production quantities (10 resources per harvest)
DO $$
DECLARE
  v_grain_id UUID;
  v_iron_id UUID;
  v_oil_id UUID;
BEGIN
  SELECT id INTO v_grain_id FROM resources WHERE key = 'grain';
  SELECT id INTO v_iron_id FROM resources WHERE key = 'iron';
  SELECT id INTO v_oil_id FROM resources WHERE key = 'oil';

  UPDATE production_recipes
  SET outputs = jsonb_build_object(
    v_grain_id::TEXT, jsonb_build_object('base_quantity', 10, 'quality_level', 1)
  )
  WHERE key = 'harvest_grain';

  UPDATE production_recipes
  SET outputs = jsonb_build_object(
    v_iron_id::TEXT, jsonb_build_object('base_quantity', 10, 'quality_level', 1)
  )
  WHERE key = 'mine_iron';

  UPDATE production_recipes
  SET outputs = jsonb_build_object(
    v_oil_id::TEXT, jsonb_build_object('base_quantity', 10, 'quality_level', 1)
  )
  WHERE key = 'drill_oil';

  RAISE NOTICE '✅ Production quantities updated';
END $$;

-- 5. Add missing column: employment_contracts.employee_type (if doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employment_contracts' AND column_name = 'employee_type'
  ) THEN
    ALTER TABLE employment_contracts
    ADD COLUMN employee_type TEXT DEFAULT 'player' CHECK (employee_type IN ('player', 'ai'));

    RAISE NOTICE '✅ Added employee_type column to employment_contracts';
  ELSE
    RAISE NOTICE '⏭️  employee_type column already exists';
  END IF;
END $$;

-- 6. Remove community_coin_type from user_wallets (deprecated column causing errors)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_wallets' AND column_name = 'community_coin_type'
  ) THEN
    ALTER TABLE user_wallets DROP COLUMN community_coin_type;
    RAISE NOTICE '✅ Removed deprecated community_coin_type column from user_wallets';
  ELSE
    RAISE NOTICE '⏭️  community_coin_type column does not exist';
  END IF;
END $$;

-- Final notice
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '✅ ALL FIXES APPLIED SUCCESSFULLY!';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed:';
  RAISE NOTICE '  ✅ Market listings RLS policies';
  RAISE NOTICE '  ✅ get_market_listings function (q.stars → q.quality_level)';
  RAISE NOTICE '  ✅ Production quantities (1 → 10 resources per harvest)';
  RAISE NOTICE '  ✅ employment_contracts.employee_type column';
  RAISE NOTICE '  ✅ Removed deprecated user_wallets.community_coin_type';
  RAISE NOTICE '';
  RAISE NOTICE 'You can now:';
  RAISE NOTICE '  • Sell inventory items from /inventory';
  RAISE NOTICE '  • Browse /market without column errors';
  RAISE NOTICE '  • View company employees in /ventures';
  RAISE NOTICE '  • Harvest 10 resources per work (not 1)';
  RAISE NOTICE '';
END $$;

-- Central Bank Analytics RPC Functions
-- Comprehensive analytics for economic monitoring and visualization

-- ============================================================================
-- MONEY SUPPLY FUNCTIONS
-- ============================================================================

-- Get total gold supply in circulation
CREATE OR REPLACE FUNCTION get_total_gold_supply()
RETURNS NUMERIC AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(gold_coins) FROM user_wallets WHERE currency_type = 'gold'),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total community currencies count and total supply
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

-- ============================================================================
-- GOLD FLOW TRACKING (Added vs Burnt)
-- ============================================================================

-- Get gold flow for a date range (added vs burnt)
CREATE OR REPLACE FUNCTION get_gold_flow(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_added NUMERIC;
  v_burnt NUMERIC;
BEGIN
  -- Gold ADDED (credited to users)
  SELECT COALESCE(SUM(amount), 0) INTO v_added
  FROM currency_transactions
  WHERE currency_type = 'gold'
    AND to_user_id IS NOT NULL
    AND from_user_id IS NULL  -- System adding gold
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- Gold BURNT (debited without recipient)
  SELECT COALESCE(SUM(amount), 0) INTO v_burnt
  FROM currency_transactions
  WHERE currency_type = 'gold'
    AND from_user_id IS NOT NULL
    AND to_user_id IS NULL  -- Gold removed from game
    AND created_at BETWEEN p_start_date AND p_end_date;

  RETURN jsonb_build_object(
    'added', v_added,
    'burnt', v_burnt,
    'net_change', v_added - v_burnt
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRANSACTION ANALYTICS
-- ============================================================================

-- Get transaction volume by type for a scope and date range
CREATE OR REPLACE FUNCTION get_transaction_volume_by_type(
  p_scope TEXT DEFAULT NULL,  -- 'personal', 'community', 'global', or NULL for all
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  transaction_type TEXT,
  count BIGINT,
  total_volume NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.transaction_type::TEXT,
    COUNT(*)::BIGINT as count,
    COALESCE(SUM(ct.amount), 0)::NUMERIC as total_volume
  FROM currency_transactions ct
  WHERE ct.created_at BETWEEN p_start_date AND p_end_date
    AND (p_scope IS NULL OR ct.scope = p_scope)
  GROUP BY ct.transaction_type
  ORDER BY total_volume DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user transaction history with pagination
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

-- ============================================================================
-- MARKET ANALYTICS
-- ============================================================================

-- Get goods market statistics
CREATE OR REPLACE FUNCTION get_market_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  resource_key TEXT,
  resource_name TEXT,
  quality_key TEXT,
  total_traded BIGINT,
  avg_price_gold NUMERIC,
  total_volume_gold NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.key::TEXT as resource_key,
    r.name::TEXT as resource_name,
    rq.key::TEXT as quality_key,
    COUNT(DISTINCT th.id)::BIGINT as total_traded,
    AVG((th.amount_transferred->>'gold_paid')::NUMERIC)::NUMERIC as avg_price_gold,
    SUM((th.amount_transferred->>'gold_paid')::NUMERIC)::NUMERIC as total_volume_gold
  FROM trade_history th
  JOIN market_listings ml ON th.listing_id = ml.id
  JOIN resources r ON ml.resource_id = r.id
  JOIN resource_qualities rq ON ml.quality_id = rq.id
  WHERE th.created_at BETWEEN p_start_date AND p_end_date
    AND th.trade_type = 'product'
  GROUP BY r.key, r.name, rq.key
  ORDER BY total_volume_gold DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get market price trends over time
CREATE OR REPLACE FUNCTION get_price_trends(
  p_resource_id UUID,
  p_quality_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  date DATE,
  avg_price_gold NUMERIC,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(th.created_at) as date,
    AVG((th.amount_transferred->>'gold_paid')::NUMERIC)::NUMERIC as avg_price_gold,
    COUNT(*)::BIGINT as transaction_count
  FROM trade_history th
  JOIN market_listings ml ON th.listing_id = ml.id
  WHERE th.created_at BETWEEN p_start_date AND p_end_date
    AND ml.resource_id = p_resource_id
    AND ml.quality_id = p_quality_id
    AND th.trade_type = 'product'
  GROUP BY DATE(th.created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- JOB MARKET ANALYTICS
-- ============================================================================

-- Get job market statistics
CREATE OR REPLACE FUNCTION get_job_market_statistics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  community_id UUID,
  community_name TEXT,
  total_active_jobs BIGINT,
  total_employees BIGINT,
  avg_wage_local NUMERIC,
  avg_wage_gold_equivalent NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as community_id,
    c.name::TEXT as community_name,
    (SELECT COUNT(*)::BIGINT
     FROM market_listings ml
     WHERE ml.community_id = c.id
       AND ml.listing_type = 'job'
       AND ml.status = 'active') as total_active_jobs,
    (SELECT COUNT(*)::BIGINT
     FROM employment_contracts ec
     JOIN companies comp ON ec.company_id = comp.id
     WHERE comp.community_id = c.id
       AND ec.active = true) as total_employees,
    (SELECT AVG(ec.wage_per_day_community_coin)::NUMERIC
     FROM employment_contracts ec
     JOIN companies comp ON ec.company_id = comp.id
     WHERE comp.community_id = c.id
       AND ec.active = true) as avg_wage_local,
    (SELECT AVG(ec.wage_per_day_community_coin / cc.exchange_rate_to_gold)::NUMERIC
     FROM employment_contracts ec
     JOIN companies comp ON ec.company_id = comp.id
     JOIN community_currencies cc ON comp.community_id = cc.community_id
     WHERE comp.community_id = c.id
       AND ec.active = true) as avg_wage_gold_equivalent
  FROM communities c
  WHERE EXISTS (
    SELECT 1 FROM companies WHERE community_id = c.id
  )
  ORDER BY total_employees DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TIME-SERIES DATA FOR CHARTS
-- ============================================================================

-- Get money supply over time (daily aggregation)
CREATE OR REPLACE FUNCTION get_money_supply_timeseries(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  date DATE,
  total_gold_supply NUMERIC,
  gold_added_that_day NUMERIC,
  gold_burnt_that_day NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_flow AS (
    SELECT
      DATE(created_at) as day,
      SUM(CASE WHEN to_user_id IS NOT NULL AND from_user_id IS NULL THEN amount ELSE 0 END) as added,
      SUM(CASE WHEN from_user_id IS NOT NULL AND to_user_id IS NULL THEN amount ELSE 0 END) as burnt
    FROM currency_transactions
    WHERE currency_type = 'gold'
      AND created_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(created_at)
  ),
  date_series AS (
    SELECT generate_series(
      DATE(p_start_date),
      DATE(p_end_date),
      '1 day'::interval
    )::DATE as day
  )
  SELECT
    ds.day as date,
    get_total_gold_supply() as total_gold_supply,  -- Current total
    COALESCE(df.added, 0)::NUMERIC as gold_added_that_day,
    COALESCE(df.burnt, 0)::NUMERIC as gold_burnt_that_day
  FROM date_series ds
  LEFT JOIN daily_flow df ON ds.day = df.day
  ORDER BY ds.day DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get transaction volume timeseries
CREATE OR REPLACE FUNCTION get_transaction_volume_timeseries(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE(
  date DATE,
  transaction_count BIGINT,
  total_volume NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    COUNT(*)::BIGINT as transaction_count,
    SUM(amount)::NUMERIC as total_volume
  FROM currency_transactions
  WHERE created_at BETWEEN p_start_date AND p_end_date
    AND currency_type = 'gold'
  GROUP BY DATE(created_at)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMUNITY ECONOMICS
-- ============================================================================

-- Get community economic stats
CREATE OR REPLACE FUNCTION get_community_economic_stats(
  p_community_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_currency_id UUID;
BEGIN
  -- Get community currency
  SELECT id INTO v_currency_id
  FROM community_currencies
  WHERE community_id = p_community_id;

  SELECT jsonb_build_object(
    'transaction_count', COUNT(*),
    'total_volume', COALESCE(SUM(amount), 0),
    'avg_transaction', COALESCE(AVG(amount), 0),
    'top_earners', (
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT
          to_user_id as user_id,
          SUM(amount) as total_earned
        FROM currency_transactions
        WHERE community_currency_id = v_currency_id
          AND to_user_id IS NOT NULL
          AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY to_user_id
        ORDER BY total_earned DESC
        LIMIT 10
      ) t
    )
  ) INTO v_result
  FROM currency_transactions
  WHERE community_currency_id = v_currency_id
    AND created_at BETWEEN p_start_date AND p_end_date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_total_gold_supply TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_currencies_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_gold_flow TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_volume_by_type TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION get_market_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_price_trends TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_market_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_money_supply_timeseries TO authenticated;
GRANT EXECUTE ON FUNCTION get_transaction_volume_timeseries TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_economic_stats TO authenticated;

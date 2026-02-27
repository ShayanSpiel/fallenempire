-- Fix order book visibility to show ALL offers from everywhere
-- UI will handle disabling offers if user is not in the community territory
-- Remove location filtering entirely from the database layer

CREATE OR REPLACE FUNCTION get_order_book_aggregated(
  p_community_currency_id UUID,
  p_requesting_user_id UUID
)
RETURNS TABLE(
  order_type TEXT,
  exchange_rate NUMERIC,
  total_gold_amount NUMERIC,
  total_currency_amount NUMERIC,
  order_count BIGINT
) AS $$
BEGIN
  -- Show all active offers regardless of location
  -- UI will disable interaction if user is not in territory
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

GRANT EXECUTE ON FUNCTION get_order_book_aggregated(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION get_order_book_individual(
  p_community_currency_id UUID,
  p_exchange_rate NUMERIC,
  p_order_type TEXT,
  p_requesting_user_id UUID
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
  -- Show all active offers regardless of location
  -- UI will disable interaction if user is not in territory
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

GRANT EXECUTE ON FUNCTION get_order_book_individual(UUID, NUMERIC, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION get_order_book_aggregated IS 'Get aggregated order book - shows ALL offers from everywhere (UI handles location restrictions)';
COMMENT ON FUNCTION get_order_book_individual IS 'Get individual orders at a price level - shows ALL offers from everywhere (UI handles location restrictions)';

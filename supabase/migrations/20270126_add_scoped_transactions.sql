-- Enhanced transaction retrieval with scope filtering and total count
-- Supports Personal, Community, and Global tabs with pagination

-- Get user transactions filtered by scope with total count
CREATE OR REPLACE FUNCTION get_user_transactions_scoped(
  p_user_id UUID,
  p_scope TEXT DEFAULT NULL,  -- NULL (all), 'personal', 'community', 'inter_community', 'global'
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
  created_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*) INTO v_total_count
  FROM currency_transactions ct
  WHERE (ct.from_user_id = p_user_id OR ct.to_user_id = p_user_id)
    AND (p_scope IS NULL OR ct.scope = p_scope);

  -- Return paginated results with total count
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
    ct.created_at,
    v_total_count
  FROM currency_transactions ct
  WHERE (ct.from_user_id = p_user_id OR ct.to_user_id = p_user_id)
    AND (p_scope IS NULL OR ct.scope = p_scope)
  ORDER BY ct.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get global transactions (for premium users)
-- These are system-wide events not specific to any user
CREATE OR REPLACE FUNCTION get_global_transactions(
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
  created_at TIMESTAMPTZ,
  total_count BIGINT
) AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total_count
  FROM currency_transactions ct
  WHERE ct.scope = 'global';

  -- Return paginated global transactions
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
    ct.created_at,
    v_total_count
  FROM currency_transactions ct
  WHERE ct.scope = 'global'
  ORDER BY ct.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_transactions_scoped TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_transactions TO authenticated;

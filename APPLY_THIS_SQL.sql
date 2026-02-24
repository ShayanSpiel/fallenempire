-- Fix company queries to use public_user_id and include region names

DROP FUNCTION IF EXISTS get_user_companies(UUID);
CREATE OR REPLACE FUNCTION get_user_companies(p_public_user_id UUID)
RETURNS TABLE (
  id UUID, name TEXT, company_type_key TEXT, company_type_name TEXT,
  hex_id TEXT, custom_name TEXT, level INT, health INT,
  can_work_today BOOLEAN, available_recipes JSONB, created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.name, ct.key, ct.name, c.hex_id, wr.custom_name AS custom_name,
    c.level, c.health,
    (c.last_worked_at IS NULL OR c.last_worked_at::date < CURRENT_DATE),
    ct.available_recipes, c.created_at
  FROM companies c
  JOIN company_types ct ON c.company_type_key = ct.key
  LEFT JOIN world_regions wr ON c.hex_id = wr.hex_id
  WHERE c.owner_id = p_public_user_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS get_user_employments(UUID);
CREATE OR REPLACE FUNCTION get_user_employments(p_public_user_id UUID)
RETURNS TABLE (
  id UUID, company_id UUID, company_name TEXT,
  company_type_key TEXT, company_type_name TEXT,
  owner_username TEXT, hex_id TEXT, custom_name TEXT,
  wage_per_day_community_coin NUMERIC,
  can_work_today BOOLEAN, available_recipes JSONB, hired_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id, c.id, c.name, ct.key, ct.name, u.username, c.hex_id, wr.custom_name AS custom_name,
    ec.wage_per_day_community_coin,
    can_work_today(p_public_user_id, c.id),
    ct.available_recipes, ec.hired_at
  FROM employee_contracts ec
  JOIN companies c ON ec.company_id = c.id
  JOIN company_types ct ON c.company_type_key = ct.key
  JOIN users u ON c.owner_id = u.id
  LEFT JOIN world_regions wr ON c.hex_id = wr.hex_id
  WHERE ec.employee_id = p_public_user_id AND ec.status = 'active'
  ORDER BY ec.hired_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

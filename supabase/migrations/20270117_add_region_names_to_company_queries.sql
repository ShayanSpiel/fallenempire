-- Add region custom_name to company queries

-- Update get_user_companies to include region custom_name
DROP FUNCTION IF EXISTS get_user_companies(UUID);
CREATE OR REPLACE FUNCTION get_user_companies(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  company_type_key TEXT,
  company_type_name TEXT,
  hex_id TEXT,
  custom_name TEXT,
  level INT,
  health INT,
  can_work_today BOOLEAN,
  available_recipes JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    ct.key AS company_type_key,
    ct.name AS company_type_name,
    c.hex_id,
    wr.custom_name AS custom_name,
    c.level,
    c.health,
    can_work_today(p_user_id, c.id) AS can_work_today,
    ct.can_produce_recipes AS available_recipes,
    c.created_at
  FROM public.companies c
  JOIN public.company_types ct ON c.company_type_id = ct.id
  LEFT JOIN public.world_regions wr ON btrim(c.hex_id) = wr.hex_id
  WHERE c.owner_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_user_employments to include region custom_name
DROP FUNCTION IF EXISTS get_user_employments(UUID);
CREATE OR REPLACE FUNCTION get_user_employments(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  company_name TEXT,
  company_type_key TEXT,
  company_type_name TEXT,
  owner_username TEXT,
  hex_id TEXT,
  custom_name TEXT,
  wage_per_day_community_coin NUMERIC,
  can_work_today BOOLEAN,
  available_recipes JSONB,
  hired_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ec.id,
    c.id as company_id,
    c.name as company_name,
    ct.key AS company_type_key,
    ct.name AS company_type_name,
    u.username AS owner_username,
    c.hex_id,
    wr.custom_name AS custom_name,
    ec.wage_per_day_community_coin,
    can_work_today(p_user_id, c.id) as can_work_today,
    ct.can_produce_recipes AS available_recipes,
    ec.hired_at
  FROM public.employment_contracts ec
  JOIN public.companies c ON ec.company_id = c.id
  JOIN public.company_types ct ON c.company_type_id = ct.id
  JOIN public.users u ON c.owner_id = u.id
  LEFT JOIN public.world_regions wr ON btrim(c.hex_id) = wr.hex_id
  WHERE ec.employee_id = p_user_id
    AND ec.active = true
  ORDER BY ec.hired_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

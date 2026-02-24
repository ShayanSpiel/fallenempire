-- ============================================================================
-- Add company_type_key to getUserEmployments and getUserCompanies
-- ============================================================================
-- Needed to display company icons in the ventures list

-- Drop existing function first
DROP FUNCTION IF EXISTS get_user_employments(UUID);

-- Recreate with company_type_key
CREATE OR REPLACE FUNCTION get_user_employments(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  company_name TEXT,
  company_type_key TEXT,
  company_type_name TEXT,
  owner_username TEXT,
  hex_id TEXT,
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
    ct.key as company_type_key,
    ct.name as company_type_name,
    u.username as owner_username,
    c.hex_id,
    ec.wage_per_day_community_coin,
    can_work_today(p_user_id, c.id) as can_work_today,
    ct.can_produce_recipes as available_recipes,
    ec.hired_at
  FROM employment_contracts ec
  JOIN companies c ON ec.company_id = c.id
  JOIN company_types ct ON c.company_type_id = ct.id
  JOIN public.users u ON c.owner_id = u.id
  WHERE ec.employee_id = p_user_id
    AND ec.active = true
  ORDER BY ec.hired_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

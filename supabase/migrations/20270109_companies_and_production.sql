-- ============================================================================
-- COMPANIES & PRODUCTION SYSTEM
-- ============================================================================
-- Personal companies only (community companies later)
-- Company inventory = User inventory (founder brings materials, gets output)
-- Once per day per company work limit
-- No taxes for now (incremental addition later)
-- ============================================================================

-- ============================================================================
-- COMPANY TYPES (Config-driven)
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  build_cost_gold NUMERIC NOT NULL CHECK (build_cost_gold >= 0),
  build_cost_resources JSONB DEFAULT '{}', -- {resource_id: quantity}
  can_produce_recipes JSONB DEFAULT '[]', -- [recipe_id1, recipe_id2]
  icon TEXT DEFAULT 'building',

  -- Metadata for future extensions (pollution, upgrades, etc)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_types_key ON company_types(key);

-- ============================================================================
-- PRODUCTION RECIPES (Config-driven)
-- ============================================================================
CREATE TABLE IF NOT EXISTS production_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Inputs from worker's personal inventory
  -- Format: {resource_id: quantity}
  -- Example: {"uuid-grain": 10}
  inputs JSONB NOT NULL DEFAULT '{}',

  -- Outputs to worker's personal inventory
  -- Format: {resource_id: {base_quantity: N, quality_level: Q}}
  -- Example: {"uuid-food": {"base_quantity": 1, "quality_level": 1}}
  outputs JSONB NOT NULL,

  -- Work cost (always 1 for now)
  time_cost_work_days INT DEFAULT 1,

  -- Metadata for future extensions (skill requirements, unlocks, etc)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_recipes_key ON production_recipes(key);

-- ============================================================================
-- COMPANIES (User-owned only for now)
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_type_id UUID NOT NULL REFERENCES company_types(id) ON DELETE RESTRICT,

  -- Location (can build anywhere, not restricted to owned hexes yet)
  hex_id TEXT NOT NULL,

  -- Company details
  name TEXT NOT NULL,
  level INT DEFAULT 1 CHECK (level >= 1),
  health INT DEFAULT 100 CHECK (health >= 0 AND health <= 100),

  -- Future: Community context (for taxes, tariffs, sanctions)
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,

  -- Output destination ('founder' for now, 'community' later)
  output_destination TEXT DEFAULT 'founder' CHECK (output_destination IN ('founder', 'community')),

  -- Metadata for future extensions
  -- {pollution_level, build_progress_days, build_complete, etc}
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner_id ON companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_companies_hex_id ON companies(hex_id);
CREATE INDEX IF NOT EXISTS idx_companies_community_id ON companies(community_id);
CREATE INDEX IF NOT EXISTS idx_companies_type_id ON companies(company_type_id);

-- ============================================================================
-- EMPLOYMENT CONTRACTS (Hiring system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS employment_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Employee classification (player vs AI hires later)
  employee_type TEXT DEFAULT 'player' CHECK (employee_type IN ('player', 'ai')),

  -- Wage in local community currency ONLY (not gold)
  wage_per_day_community_coin NUMERIC DEFAULT 0 CHECK (wage_per_day_community_coin >= 0),
  community_coin_type UUID REFERENCES community_currencies(id) ON DELETE SET NULL,

  -- Position (for future role-based permissions)
  position TEXT DEFAULT 'worker',

  -- Contract status
  hired_at TIMESTAMPTZ DEFAULT NOW(),
  last_worked_at TIMESTAMPTZ,
  total_work_days INT DEFAULT 0,
  active BOOLEAN DEFAULT true,

  -- One employee can only work at one company once
  UNIQUE(company_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employment_contracts_company_id ON employment_contracts(company_id);
CREATE INDEX IF NOT EXISTS idx_employment_contracts_employee_id ON employment_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employment_contracts_active ON employment_contracts(active) WHERE active = true;

-- ============================================================================
-- WORK HISTORY (Tracking cooldowns and production)
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Work type ('manager' = own company, 'employee' = hired at someone else's)
  work_type TEXT NOT NULL CHECK (work_type IN ('manager', 'employee')),

  -- Production details
  recipe_id UUID REFERENCES production_recipes(id) ON DELETE SET NULL,
  resources_consumed JSONB, -- {resource_id: quantity}
  resources_produced JSONB, -- {resource_id: {quantity, quality_id}}

  -- Hex bonuses applied (for analytics)
  hex_bonuses_applied JSONB DEFAULT '{}', -- {resource_id: bonus_percentage}

  -- Wages/payments (0 for managers working own companies)
  wage_earned NUMERIC DEFAULT 0,
  currency_type TEXT, -- 'gold' | 'community_coin'

  worked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_history_user_id ON work_history(user_id);
CREATE INDEX IF NOT EXISTS idx_work_history_company_id ON work_history(company_id);
CREATE INDEX IF NOT EXISTS idx_work_history_worked_at ON work_history(worked_at DESC);

-- Unique constraint: One work per company per day per user
-- Using date_trunc which is IMMUTABLE
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_history_cooldown
ON work_history(user_id, company_id, ((worked_at AT TIME ZONE 'UTC')::date));

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Company types: Public read
ALTER TABLE company_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Company types are viewable by everyone" ON company_types;
CREATE POLICY "Company types are viewable by everyone" ON company_types FOR SELECT USING (true);

-- Production recipes: Public read
ALTER TABLE production_recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Production recipes are viewable by everyone" ON production_recipes;
CREATE POLICY "Production recipes are viewable by everyone" ON production_recipes FOR SELECT USING (true);

-- Companies: Owner can do anything, others can view
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Companies are viewable by everyone" ON companies;
CREATE POLICY "Companies are viewable by everyone" ON companies
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own companies" ON companies;
CREATE POLICY "Users can create their own companies" ON companies
FOR INSERT WITH CHECK (
  owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update their own companies" ON companies;
CREATE POLICY "Users can update their own companies" ON companies
FOR UPDATE USING (
  owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own companies" ON companies;
CREATE POLICY "Users can delete their own companies" ON companies
FOR DELETE USING (
  owner_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

-- Employment contracts: Company owner and employee can view
ALTER TABLE employment_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employment contracts viewable by involved parties" ON employment_contracts;
CREATE POLICY "Employment contracts viewable by involved parties" ON employment_contracts
FOR SELECT USING (
  employee_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Company owners can create contracts" ON employment_contracts;
CREATE POLICY "Company owners can create contracts" ON employment_contracts
FOR INSERT WITH CHECK (
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Company owners can update contracts" ON employment_contracts;
CREATE POLICY "Company owners can update contracts" ON employment_contracts
FOR UPDATE USING (
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

DROP POLICY IF EXISTS "Company owners can delete contracts" ON employment_contracts;
CREATE POLICY "Company owners can delete contracts" ON employment_contracts
FOR DELETE USING (
  (SELECT id FROM public.users WHERE auth_id = auth.uid())
    IN (SELECT owner_id FROM companies WHERE id = company_id)
);

-- Work history: User can view their own work
ALTER TABLE work_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own work history" ON work_history;
CREATE POLICY "Users can view their own work history" ON work_history
FOR SELECT USING (
  user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can create their own work records" ON work_history;
CREATE POLICY "Users can create their own work records" ON work_history
FOR INSERT WITH CHECK (
  user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user can work at a company today
CREATE OR REPLACE FUNCTION can_work_today(
  p_user_id UUID,
  p_company_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM work_history
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND (worked_at AT TIME ZONE 'UTC')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's companies (for manager view)
DROP FUNCTION IF EXISTS get_user_companies(UUID);
CREATE OR REPLACE FUNCTION get_user_companies(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  company_type_key TEXT,
  company_type_name TEXT,
  hex_id TEXT,
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
    ct.key as company_type_key,
    ct.name as company_type_name,
    c.hex_id,
    c.level,
    c.health,
    can_work_today(p_user_id, c.id) as can_work_today,
    ct.can_produce_recipes as available_recipes,
    c.created_at
  FROM companies c
  JOIN company_types ct ON c.company_type_id = ct.id
  WHERE c.owner_id = p_user_id
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user's employment contracts (for employee view)
DROP FUNCTION IF EXISTS get_user_employments(UUID);
CREATE OR REPLACE FUNCTION get_user_employments(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  company_name TEXT,
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

-- ============================================================================
-- WORK FUNCTION (The Core of Production)
-- ============================================================================
CREATE OR REPLACE FUNCTION perform_work(
  p_worker_id UUID,
  p_company_id UUID,
  p_recipe_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_company RECORD;
  v_recipe RECORD;
  v_contract RECORD;
  v_founder_id UUID;
  v_work_type TEXT;
  v_wage NUMERIC := 0;
  v_inputs JSONB;
  v_outputs JSONB;
  v_hex_bonuses JSONB := '{}';
  v_result JSONB;
  v_resource_id UUID;
  v_required_qty NUMERIC;
  v_current_qty NUMERIC;
  v_quality_id UUID;
BEGIN
  -- 1. Check cooldown (one work per company per day)
  IF NOT can_work_today(p_worker_id, p_company_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already worked at this company today'
    );
  END IF;

  -- 2. Get company details
  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;

  v_founder_id := v_company.owner_id;

  -- 3. Determine work type (manager vs employee)
  IF p_worker_id = v_founder_id THEN
    v_work_type := 'manager';
  ELSE
    -- Check employment contract
    SELECT * INTO v_contract
    FROM employment_contracts
    WHERE company_id = p_company_id
      AND employee_id = p_worker_id
      AND active = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not employed at this company');
    END IF;

    v_work_type := 'employee';
    v_wage := v_contract.wage_per_day_community_coin;
  END IF;

  -- 4. Get recipe
  SELECT * INTO v_recipe FROM production_recipes WHERE id = p_recipe_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipe not found');
  END IF;

  v_inputs := v_recipe.inputs;
  v_outputs := v_recipe.outputs;

  -- 5. Check FOUNDER has required inputs in their inventory
  FOR v_resource_id, v_required_qty IN
    SELECT (key::UUID), (value::TEXT)::NUMERIC
    FROM jsonb_each(v_inputs)
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_current_qty
    FROM user_inventory
    WHERE user_id = v_founder_id
      AND resource_id = v_resource_id;

    IF v_current_qty < v_required_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Founder lacks required materials'
      );
    END IF;
  END LOOP;

  -- 6. Consume inputs from FOUNDER's inventory
  FOR v_resource_id, v_required_qty IN
    SELECT (key::UUID), (value::TEXT)::NUMERIC
    FROM jsonb_each(v_inputs)
  LOOP
    UPDATE user_inventory
    SET quantity = quantity - v_required_qty,
        updated_at = NOW()
    WHERE user_id = v_founder_id
      AND resource_id = v_resource_id;
  END LOOP;

  -- 7. Produce outputs to FOUNDER's inventory (with hex bonuses, quality level 1 for now)
  -- TODO: Apply hex bonuses from hex_resources table
  -- TODO: Quality rolls for higher levels
  SELECT id INTO v_quality_id FROM resource_qualities WHERE key = 'common' LIMIT 1;

  FOR v_resource_id IN
    SELECT (key::UUID)
    FROM jsonb_each(v_outputs)
  LOOP
    INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
    VALUES (v_founder_id, v_resource_id, v_quality_id, 1)
    ON CONFLICT (user_id, resource_id, quality_id)
    DO UPDATE SET
      quantity = user_inventory.quantity + 1,
      updated_at = NOW();
  END LOOP;

  -- 8. Pay wage if employee (from founder's wallet to employee's wallet)
  IF v_work_type = 'employee' AND v_wage > 0 THEN
    -- Deduct from founder's community coin wallet
    UPDATE user_wallets
    SET community_coins = community_coins - v_wage,
        updated_at = NOW()
    WHERE user_id = v_founder_id
      AND currency_type = 'community'
      AND community_currency_id = v_contract.community_coin_type;

    -- Add to employee's community coin wallet
    INSERT INTO user_wallets (
      user_id,
      currency_type,
      community_currency_id,
      community_coins
    )
    VALUES (p_worker_id, 'community', v_contract.community_coin_type, v_wage)
    ON CONFLICT (user_id, community_currency_id)
    DO UPDATE SET
      community_coins = user_wallets.community_coins + v_wage,
      updated_at = NOW();

    -- Update contract stats
    UPDATE employment_contracts
    SET last_worked_at = NOW(),
        total_work_days = total_work_days + 1
    WHERE id = v_contract.id;
  END IF;

  -- 9. Record work history
  INSERT INTO work_history (
    user_id,
    company_id,
    work_type,
    recipe_id,
    resources_consumed,
    resources_produced,
    hex_bonuses_applied,
    wage_earned,
    currency_type,
    worked_at
  ) VALUES (
    p_worker_id,
    p_company_id,
    v_work_type,
    p_recipe_id,
    v_inputs,
    v_outputs,
    v_hex_bonuses,
    v_wage,
    CASE WHEN v_wage > 0 THEN 'community_coin' ELSE NULL END,
    NOW()
  );

  -- 10. Return success
  v_result := jsonb_build_object(
    'success', true,
    'work_type', v_work_type,
    'inputs_consumed', v_inputs,
    'outputs_produced', v_outputs,
    'wage_earned', v_wage,
    'hex_bonuses', v_hex_bonuses
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE company_types IS 'Configuration table for different company types (Farm, Mine, Smithy, etc). Fully data-driven.';
COMMENT ON TABLE production_recipes IS 'Configuration table for production recipes. Inputs from FOUNDER inventory, outputs to FOUNDER inventory.';
COMMENT ON TABLE companies IS 'User-owned companies placed on hex map. Company inventory = FOUNDER inventory. Employees use founder materials.';
COMMENT ON TABLE employment_contracts IS 'Hiring relationships. Employees paid in local community currency only. They provide labor, founder provides materials.';
COMMENT ON TABLE work_history IS 'Tracks all work performed. One work per company per user per day. Manager vs Employee modes.';

COMMENT ON COLUMN companies.output_destination IS 'Where production goes: founder inventory (now) or community treasury (later)';
COMMENT ON COLUMN companies.metadata IS 'Future extensions: {pollution_level, build_progress_days, build_complete}';
COMMENT ON COLUMN work_history.work_type IS 'manager = working own company, employee = working for hire';

COMMENT ON FUNCTION perform_work IS 'Core production function. Materials from FOUNDER inventory, output to FOUNDER inventory, employee gets wage only.';

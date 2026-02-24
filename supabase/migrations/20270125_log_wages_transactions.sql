-- Update perform_work function to log wages in currency_transactions
-- This ensures wages are tracked in the single source of truth

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

    -- **NEW: Log wage payment in currency_transactions (single source of truth)**
    INSERT INTO currency_transactions (
      from_user_id,
      to_user_id,
      currency_type,
      community_currency_id,
      amount,
      transaction_type,
      description,
      metadata,
      scope
    )
    VALUES (
      v_founder_id,
      p_worker_id,
      'community',
      v_contract.community_coin_type,
      v_wage,
      'wage_payment',
      'Daily work wage',
      jsonb_build_object(
        'company_id', p_company_id,
        'company_name', v_company.name,
        'contract_id', v_contract.id,
        'position', v_contract.position,
        'recipe_id', p_recipe_id
      ),
      'community'
    );

    -- Update contract stats
    UPDATE employment_contracts
    SET last_worked_at = NOW(),
        total_work_days = total_work_days + 1
    WHERE id = v_contract.id;
  END IF;

  -- 9. Record work history (keep existing tracking)
  INSERT INTO work_history (
    user_id,
    company_id,
    work_type,
    recipe_id,
    resources_consumed,
    resources_produced,
    hex_bonuses_applied,
    wage_earned
  )
  VALUES (
    p_worker_id,
    p_company_id,
    v_work_type,
    p_recipe_id,
    v_inputs,
    v_outputs,
    v_hex_bonuses,
    v_wage
  );

  RETURN jsonb_build_object(
    'success', true,
    'work_type', v_work_type,
    'wage_earned', v_wage,
    'resources_consumed', v_inputs,
    'resources_produced', v_outputs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

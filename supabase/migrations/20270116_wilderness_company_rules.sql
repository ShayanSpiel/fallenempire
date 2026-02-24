-- Wilderness company rules + inventory provenance (for market restrictions)
-- - Company governance follows land ownership (hex owner community)
-- - Wilderness companies: no employees, manager-only work, 3x energy cost
-- - Wilderness-produced goods cannot be sold on the market (until licenses exist)

-- ============================================================================
-- 1. Inventory metadata for provenance tracking
-- ============================================================================

ALTER TABLE public.user_inventory
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 2. Helper: active community membership (handles optional left_at)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_active_community_member(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_left_at BOOLEAN;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF p_user_id IS NULL OR p_community_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_user_id
        AND cm.community_id = p_community_id
        AND cm.left_at IS NULL
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.community_members cm
    WHERE cm.user_id = p_user_id
      AND cm.community_id = p_community_id
  );
END;
$$;

-- ============================================================================
-- 3. Backfill companies.community_id from world_regions
-- ============================================================================

DO $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Normalize hex ids (avoid whitespace mismatches with world_regions.hex_id)
  UPDATE public.companies
  SET hex_id = btrim(hex_id),
      updated_at = NOW()
  WHERE hex_id IS NOT NULL
    AND hex_id <> btrim(hex_id);

  UPDATE public.companies c
  SET community_id = wr.owner_community_id,
  updated_at = NOW()
  FROM public.world_regions wr
  WHERE wr.hex_id = btrim(c.hex_id)
    AND c.community_id IS DISTINCT FROM wr.owner_community_id;
END $$;

-- ============================================================================
-- 4. Work function: wilderness restrictions + 3x energy cost + provenance tagging
-- ============================================================================

CREATE OR REPLACE FUNCTION public.perform_work(
  p_worker_id UUID,
  p_company_id UUID,
  p_recipe_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  v_hex_owner_community_id UUID;
  v_effective_company_community_id UUID;
  v_is_wilderness BOOLEAN := false;

  v_base_energy_cost NUMERIC := 10;
  v_energy_multiplier NUMERIC := 1;
  v_energy_cost NUMERIC := 0;
  v_current_energy NUMERIC := 0;
  v_remaining_energy NUMERIC := 0;

  v_resource_id UUID;
  v_required_qty NUMERIC;
  v_current_qty NUMERIC;
  v_remaining_qty NUMERIC;
  v_quality_id UUID;

  v_inv RECORD;
  v_consume NUMERIC;
  v_inv_wilderness NUMERIC;
  v_new_wilderness NUMERIC;

  v_output_spec JSONB;
  v_output_qty NUMERIC;
  v_existing_wilderness NUMERIC;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- 1. Check cooldown (one work per company per day)
  IF NOT public.can_work_today(p_worker_id, p_company_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already worked at this company today'
    );
  END IF;

  -- 2. Get company details
  SELECT * INTO v_company FROM public.companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Company not found');
  END IF;

  v_founder_id := v_company.owner_id;

  -- Determine which community (if any) this company is actually allowed to belong to.
  SELECT owner_community_id
  INTO v_hex_owner_community_id
  FROM public.world_regions
  WHERE hex_id = btrim(v_company.hex_id);

  v_effective_company_community_id := v_hex_owner_community_id;

  v_is_wilderness := (v_effective_company_community_id IS NULL);

  -- Keep stored community_id in sync (best-effort)
  IF v_company.community_id IS DISTINCT FROM v_effective_company_community_id THEN
    UPDATE public.companies
    SET community_id = v_effective_company_community_id,
        updated_at = NOW()
    WHERE id = p_company_id;
  END IF;

  -- 3. Determine work type (manager vs employee)
  IF p_worker_id = v_founder_id THEN
    v_work_type := 'manager';
    IF v_is_wilderness THEN
      v_energy_multiplier := 3;
    END IF;
	  ELSE
	    IF v_is_wilderness THEN
	      RETURN jsonb_build_object(
	        'success', false,
	        'error', 'Company is in wilderness. No employees can work here.'
	      );
	    END IF;

	    -- Check employment contract
	    SELECT * INTO v_contract
	    FROM public.employment_contracts
	    WHERE company_id = p_company_id
	      AND employee_id = p_worker_id
	      AND active = true;

	    IF NOT FOUND THEN
	      RETURN jsonb_build_object('success', false, 'error', 'Not employed at this company');
	    END IF;

	    -- Employees must be currently located in the governing community's territory.
	    -- (Non-members can work too, but they must travel into the community first.)
	    IF (SELECT u.main_community_id FROM public.users u WHERE u.id = p_worker_id)
	      IS DISTINCT FROM v_effective_company_community_id THEN
	      RETURN jsonb_build_object(
	        'success', false,
	        'error', 'Travel to this community before working as an employee here'
	      );
	    END IF;

	    v_work_type := 'employee';
	    v_wage := v_contract.wage_per_day_community_coin;
	    v_energy_multiplier := 1;
	  END IF;

  -- 4. Get recipe
  SELECT * INTO v_recipe FROM public.production_recipes WHERE id = p_recipe_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipe not found');
  END IF;

  v_inputs := v_recipe.inputs;
  v_outputs := v_recipe.outputs;

  -- 5. Charge energy (10 per work day, 3x in wilderness for managers)
  v_energy_cost := COALESCE(v_recipe.time_cost_work_days, 1) * v_base_energy_cost * v_energy_multiplier;

  SELECT COALESCE(u.energy, 0) INTO v_current_energy
  FROM public.users u
  WHERE u.id = p_worker_id;

  IF v_current_energy < v_energy_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient energy (have: %s, need: %s)', v_current_energy, v_energy_cost)
    );
  END IF;

  UPDATE public.users
  SET energy = energy - v_energy_cost,
      energy_updated_at = NOW()
  WHERE id = p_worker_id
    AND energy >= v_energy_cost
  RETURNING energy INTO v_remaining_energy;

  IF v_remaining_energy IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient energy'
    );
  END IF;

  -- 6. Check FOUNDER has required inputs in their inventory (any quality)
  FOR v_resource_id, v_required_qty IN
    SELECT (key::UUID), (value::TEXT)::NUMERIC
    FROM jsonb_each(v_inputs)
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO v_current_qty
    FROM public.user_inventory
    WHERE user_id = v_founder_id
      AND resource_id = v_resource_id;

    IF v_current_qty < v_required_qty THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Founder lacks required materials'
      );
    END IF;
  END LOOP;

  -- 7. Consume inputs from FOUNDER's inventory (lowest quality first)
  FOR v_resource_id, v_required_qty IN
    SELECT (key::UUID), (value::TEXT)::NUMERIC
    FROM jsonb_each(v_inputs)
  LOOP
    v_remaining_qty := v_required_qty;

    FOR v_inv IN
      SELECT ui.id, ui.quantity, ui.metadata, q.quality_level
      FROM public.user_inventory ui
      JOIN public.resource_qualities q ON ui.quality_id = q.id
      WHERE ui.user_id = v_founder_id
        AND ui.resource_id = v_resource_id
        AND ui.quantity > 0
      ORDER BY q.quality_level ASC
    LOOP
      EXIT WHEN v_remaining_qty <= 0;

      v_consume := LEAST(v_inv.quantity, v_remaining_qty);

      v_inv_wilderness := COALESCE((v_inv.metadata->>'wilderness_qty')::NUMERIC, 0);
      v_new_wilderness := GREATEST(0, v_inv_wilderness - v_consume);

      UPDATE public.user_inventory
      SET quantity = quantity - v_consume,
          metadata = CASE
            WHEN v_inv_wilderness > 0 THEN jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{wilderness_qty}',
              to_jsonb(v_new_wilderness),
              true
            )
            ELSE COALESCE(metadata, '{}'::jsonb)
          END,
          updated_at = NOW()
      WHERE id = v_inv.id;

      v_remaining_qty := v_remaining_qty - v_consume;
    END LOOP;

    IF v_remaining_qty > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Founder lacks required materials'
      );
    END IF;
  END LOOP;

  -- 8. Produce outputs to FOUNDER's inventory (quality = common for now)
  SELECT id INTO v_quality_id FROM public.resource_qualities WHERE key = 'common' LIMIT 1;

  FOR v_resource_id, v_output_spec IN
    SELECT (key::UUID), value
    FROM jsonb_each(v_outputs)
  LOOP
    v_output_qty := COALESCE((v_output_spec->>'base_quantity')::NUMERIC, 1);

    INSERT INTO public.user_inventory (user_id, resource_id, quality_id, quantity, metadata)
    VALUES (
      v_founder_id,
      v_resource_id,
      v_quality_id,
      v_output_qty,
      CASE
        WHEN v_is_wilderness THEN jsonb_build_object('wilderness_qty', v_output_qty)
        ELSE '{}'::jsonb
      END
    )
    ON CONFLICT (user_id, resource_id, quality_id)
    DO UPDATE SET
      quantity = public.user_inventory.quantity + v_output_qty,
      metadata = CASE
        WHEN v_is_wilderness THEN
          jsonb_set(
            COALESCE(public.user_inventory.metadata, '{}'::jsonb),
            '{wilderness_qty}',
            to_jsonb(
              COALESCE((public.user_inventory.metadata->>'wilderness_qty')::NUMERIC, 0) + v_output_qty
            ),
            true
          )
        ELSE COALESCE(public.user_inventory.metadata, '{}'::jsonb)
      END,
      updated_at = NOW();
  END LOOP;

  -- 9. Pay wage if employee (from founder's wallet to employee's wallet)
  IF v_work_type = 'employee' AND v_wage > 0 THEN
    UPDATE public.user_wallets
    SET community_coins = community_coins - v_wage,
        updated_at = NOW()
    WHERE user_id = v_founder_id
      AND currency_type = 'community'
      AND community_currency_id = v_contract.community_coin_type;

    INSERT INTO public.user_wallets (
      user_id,
      currency_type,
      community_currency_id,
      community_coins
    )
    VALUES (p_worker_id, 'community', v_contract.community_coin_type, v_wage)
    ON CONFLICT (user_id, community_currency_id)
    DO UPDATE SET
      community_coins = public.user_wallets.community_coins + v_wage,
      updated_at = NOW();

    UPDATE public.employment_contracts
    SET last_worked_at = NOW(),
        total_work_days = total_work_days + 1
    WHERE id = v_contract.id;
  END IF;

  -- 10. Record work history
  INSERT INTO public.work_history (
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

  v_result := jsonb_build_object(
    'success', true,
    'work_type', v_work_type,
    'inputs_consumed', v_inputs,
    'outputs_produced', v_outputs,
    'wage_earned', v_wage,
    'hex_bonuses', v_hex_bonuses,
    'energy_spent', v_energy_cost,
    'energy_multiplier', v_energy_multiplier,
    'is_wilderness', v_is_wilderness,
    'remaining_energy', v_remaining_energy
  );

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. Keep companies.community_id synced to region ownership changes
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_sync_company_governance_to_hex_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('row_security', 'off', true);

  UPDATE public.companies
  SET community_id = NEW.owner_community_id,
      updated_at = NOW()
  WHERE hex_id = NEW.hex_id;

  -- Keep job listings aligned with the governing community.
  -- If a hex becomes wilderness, cancel any active job listings on that hex.
  IF to_regclass('public.market_listings') IS NOT NULL THEN
    IF NEW.owner_community_id IS NULL THEN
      UPDATE public.market_listings ml
      SET status = 'cancelled',
          updated_at = NOW()
      FROM public.companies c
      WHERE c.hex_id = NEW.hex_id
        AND ml.company_id = c.id
        AND ml.listing_type = 'job'
        AND ml.status = 'active';
    ELSE
      UPDATE public.market_listings ml
      SET community_id = NEW.owner_community_id,
          updated_at = NOW()
      FROM public.companies c
      WHERE c.hex_id = NEW.hex_id
        AND ml.company_id = c.id
        AND ml.listing_type = 'job'
        AND ml.status = 'active'
        AND ml.community_id IS DISTINCT FROM NEW.owner_community_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_governance_to_hex_owner ON public.world_regions;
CREATE TRIGGER trg_sync_company_governance_to_hex_owner
AFTER INSERT OR UPDATE OF owner_community_id ON public.world_regions
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_company_governance_to_hex_owner();

-- ============================================================================
-- 6. Ensure companies.community_id matches hex ownership on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_set_company_community_from_hex_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hex_owner_community_id UUID;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  IF NEW.hex_id IS NOT NULL THEN
    NEW.hex_id := btrim(NEW.hex_id);
  END IF;

  SELECT owner_community_id
  INTO v_hex_owner_community_id
  FROM public.world_regions
  WHERE hex_id = NEW.hex_id;

  NEW.community_id := v_hex_owner_community_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_company_community_from_hex_owner ON public.companies;
CREATE TRIGGER trg_set_company_community_from_hex_owner
BEFORE INSERT OR UPDATE OF hex_id ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_company_community_from_hex_owner();

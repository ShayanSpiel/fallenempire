-- ============================================================================
-- SEED DATA: Company Types & Production Recipes
-- ============================================================================
-- Zero hardcoding - all driven by config
-- Quality 1 production: 10 resources → 1 product
-- ============================================================================

-- Get resource IDs (created in previous migration)
DO $$
DECLARE
  v_grain_id UUID;
  v_iron_id UUID;
  v_oil_id UUID;
  v_food_id UUID;
  v_weapon_id UUID;
  v_ticket_id UUID;
BEGIN
  -- Fetch resource IDs
  SELECT id INTO v_grain_id FROM resources WHERE key = 'grain';
  SELECT id INTO v_iron_id FROM resources WHERE key = 'iron';
  SELECT id INTO v_oil_id FROM resources WHERE key = 'oil';
  SELECT id INTO v_food_id FROM resources WHERE key = 'food';
  SELECT id INTO v_weapon_id FROM resources WHERE key = 'weapon';
  SELECT id INTO v_ticket_id FROM resources WHERE key = 'ticket';

  -- ============================================================================
  -- PRODUCTION RECIPES (Quality 1 only for now)
  -- ============================================================================

  -- HARVEST GRAIN (no inputs, produces 1 grain from hex resources)
  INSERT INTO production_recipes (
    key,
    name,
    description,
    inputs,
    outputs,
    time_cost_work_days,
    metadata
  ) VALUES (
    'harvest_grain',
    'Harvest Grain',
    'Extract grain from farmland. No materials required, depends on hex fertility.',
    '{}',
    jsonb_build_object(
      v_grain_id::TEXT, jsonb_build_object(
        'base_quantity', 1,
        'quality_level', 1
      )
    ),
    1,
    '{"category": "harvesting", "skill_requirement": null}'
  );

  -- MINE IRON (no inputs, produces 1 iron from hex resources)
  INSERT INTO production_recipes (
    key,
    name,
    description,
    inputs,
    outputs,
    time_cost_work_days,
    metadata
  ) VALUES (
    'mine_iron',
    'Mine Iron Ore',
    'Extract iron ore from mineral deposits. No materials required, depends on hex geology.',
    '{}',
    jsonb_build_object(
      v_iron_id::TEXT, jsonb_build_object(
        'base_quantity', 1,
        'quality_level', 1
      )
    ),
    1,
    '{"category": "mining", "skill_requirement": null}'
  );

  -- DRILL OIL (no inputs, produces 1 oil from hex resources)
  INSERT INTO production_recipes (
    key,
    name,
    description,
    inputs,
    outputs,
    time_cost_work_days,
    metadata
  ) VALUES (
    'drill_oil',
    'Drill for Oil',
    'Extract crude oil from underground reservoirs. No materials required, depends on hex petroleum deposits.',
    '{}',
    jsonb_build_object(
      v_oil_id::TEXT, jsonb_build_object(
        'base_quantity', 1,
        'quality_level', 1
      )
    ),
    1,
    '{"category": "extraction", "skill_requirement": null}'
  );

  -- BAKE BREAD (10 grain → 1 food)
  INSERT INTO production_recipes (
    key,
    name,
    description,
    inputs,
    outputs,
    time_cost_work_days,
    metadata
  ) VALUES (
    'bake_bread',
    'Bake Bread',
    'Process grain into consumable food. Requires 10 grain to produce 1 food ration.',
    jsonb_build_object(v_grain_id::TEXT, 10),
    jsonb_build_object(
      v_food_id::TEXT, jsonb_build_object(
        'base_quantity', 1,
        'quality_level', 1
      )
    ),
    1,
    '{"category": "processing", "skill_requirement": null}'
  );

  -- FORGE WEAPON (10 iron → 1 weapon)
  INSERT INTO production_recipes (
    key,
    name,
    description,
    inputs,
    outputs,
    time_cost_work_days,
    metadata
  ) VALUES (
    'forge_weapon',
    'Forge Weapon',
    'Smelt iron ore into combat weapons. Requires 10 iron to produce 1 weapon.',
    jsonb_build_object(v_iron_id::TEXT, 10),
    jsonb_build_object(
      v_weapon_id::TEXT, jsonb_build_object(
        'base_quantity', 1,
        'quality_level', 1
      )
    ),
    1,
    '{"category": "smithing", "skill_requirement": null}'
  );

  -- ISSUE TICKET (1 oil → 1 ticket)
  INSERT INTO production_recipes (
    key,
    name,
    description,
    inputs,
    outputs,
    time_cost_work_days,
    metadata
  ) VALUES (
    'issue_ticket',
    'Issue Travel Ticket',
    'Convert oil into travel tickets for inter-community movement. Requires 1 oil per ticket.',
    jsonb_build_object(v_oil_id::TEXT, 1),
    jsonb_build_object(
      v_ticket_id::TEXT, jsonb_build_object(
        'base_quantity', 1,
        'quality_level', 1
      )
    ),
    1,
    '{"category": "services", "skill_requirement": null}'
  );

  -- ============================================================================
  -- COMPANY TYPES
  -- ============================================================================

  -- Get recipe IDs for can_produce arrays
  DECLARE
    v_harvest_grain_id UUID;
    v_mine_iron_id UUID;
    v_drill_oil_id UUID;
    v_bake_bread_id UUID;
    v_forge_weapon_id UUID;
    v_issue_ticket_id UUID;
  BEGIN
    SELECT id INTO v_harvest_grain_id FROM production_recipes WHERE key = 'harvest_grain';
    SELECT id INTO v_mine_iron_id FROM production_recipes WHERE key = 'mine_iron';
    SELECT id INTO v_drill_oil_id FROM production_recipes WHERE key = 'drill_oil';
    SELECT id INTO v_bake_bread_id FROM production_recipes WHERE key = 'bake_bread';
    SELECT id INTO v_forge_weapon_id FROM production_recipes WHERE key = 'forge_weapon';
    SELECT id INTO v_issue_ticket_id FROM production_recipes WHERE key = 'issue_ticket';

    -- FARM (harvests grain, can also process into food)
    INSERT INTO company_types (
      key,
      name,
      description,
      build_cost_gold,
      build_cost_resources,
      can_produce_recipes,
      icon,
      metadata
    ) VALUES (
      'farm',
      'Grain Farm',
      'Extract grain from fertile farmland.',
      100,
      '{}',
      jsonb_build_array(v_harvest_grain_id::TEXT, v_bake_bread_id::TEXT),
      'wheat',
      '{"pollution_per_work": 1, "upgradeable": true, "max_level": 5}'
    );

    -- MINE (extracts iron ore)
    INSERT INTO company_types (
      key,
      name,
      description,
      build_cost_gold,
      build_cost_resources,
      can_produce_recipes,
      icon,
      metadata
    ) VALUES (
      'mine',
      'Iron Mine',
      'Extract iron ore from underground deposits.',
      150,
      '{}',
      jsonb_build_array(v_mine_iron_id::TEXT),
      'mountain',
      '{"pollution_per_work": 3, "upgradeable": true, "max_level": 5}'
    );

    -- SMITHY (forges weapons from iron)
    INSERT INTO company_types (
      key,
      name,
      description,
      build_cost_gold,
      build_cost_resources,
      can_produce_recipes,
      icon,
      metadata
    ) VALUES (
      'smithy',
      'Weapon Factory',
      'Forge weapons from iron ore.',
      200,
      jsonb_build_object(v_iron_id::TEXT, 10),
      jsonb_build_array(v_forge_weapon_id::TEXT),
      'hammer',
      '{"pollution_per_work": 2, "upgradeable": true, "max_level": 5}'
    );

    -- OIL RIG (extracts oil)
    INSERT INTO company_types (
      key,
      name,
      description,
      build_cost_gold,
      build_cost_resources,
      can_produce_recipes,
      icon,
      metadata
    ) VALUES (
      'oil_rig',
      'Oil Drill',
      'Extract crude oil from petroleum reservoirs.',
      300,
      '{}',
      jsonb_build_array(v_drill_oil_id::TEXT),
      'droplet',
      '{"pollution_per_work": 5, "upgradeable": true, "max_level": 3}'
    );

    -- TRANSIT STATION (issues travel tickets from oil)
    INSERT INTO company_types (
      key,
      name,
      description,
      build_cost_gold,
      build_cost_resources,
      can_produce_recipes,
      icon,
      metadata
    ) VALUES (
      'transit_station',
      'Logistics Hub',
      'Convert oil into travel tickets for movement.',
      250,
      jsonb_build_object(v_oil_id::TEXT, 5),
      jsonb_build_array(v_issue_ticket_id::TEXT),
      'train',
      '{"pollution_per_work": 1, "upgradeable": true, "max_level": 5}'
    );
  END;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
DO $$
DECLARE
  v_company_types_count INT;
  v_recipes_count INT;
BEGIN
  SELECT COUNT(*) INTO v_company_types_count FROM company_types;
  SELECT COUNT(*) INTO v_recipes_count FROM production_recipes;

  RAISE NOTICE 'Seed complete: % company types, % recipes', v_company_types_count, v_recipes_count;

  IF v_company_types_count < 5 THEN
    RAISE EXCEPTION 'Company types seed failed - expected 5, got %', v_company_types_count;
  END IF;

  IF v_recipes_count < 6 THEN
    RAISE EXCEPTION 'Recipes seed failed - expected 6, got %', v_recipes_count;
  END IF;
END $$;

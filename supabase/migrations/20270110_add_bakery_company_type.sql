-- ============================================================================
-- Add Bakery Company Type
-- ============================================================================
-- Separate food production from farming (grain extraction)
-- Farm should ONLY harvest grain, Bakery processes grain → food
-- ============================================================================

DO $$
DECLARE
  v_grain_id UUID;
  v_food_id UUID;
  v_bake_bread_id UUID;
  v_harvest_grain_id UUID;
BEGIN
  -- Get resource IDs
  SELECT id INTO v_grain_id FROM resources WHERE key = 'grain';
  SELECT id INTO v_food_id FROM resources WHERE key = 'food';

  -- Get recipe IDs
  SELECT id INTO v_bake_bread_id FROM production_recipes WHERE key = 'bake_bread';
  SELECT id INTO v_harvest_grain_id FROM production_recipes WHERE key = 'harvest_grain';

  -- Add Bakery company type
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
    'bakery',
    'Bakery',
    'Process grain into food rations.',
    150,
    jsonb_build_object(v_grain_id::TEXT, 10),
    jsonb_build_array(v_bake_bread_id::TEXT),
    'cooking-pot',
    '{"pollution_per_work": 1, "upgradeable": true, "max_level": 5}'
  )
  ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    build_cost_gold = EXCLUDED.build_cost_gold,
    build_cost_resources = EXCLUDED.build_cost_resources,
    can_produce_recipes = EXCLUDED.can_produce_recipes,
    icon = EXCLUDED.icon,
    metadata = EXCLUDED.metadata;

  -- Update Farm to ONLY harvest grain (remove bake_bread)
  UPDATE company_types
  SET can_produce_recipes = jsonb_build_array(v_harvest_grain_id::TEXT)
  WHERE key = 'farm';

  RAISE NOTICE 'Bakery company type added successfully';
END $$;

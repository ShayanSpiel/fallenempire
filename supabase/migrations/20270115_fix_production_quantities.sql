-- Fix production recipe quantities
-- Harvesting should produce 10 resources per work
-- (Conversion recipes already correct at 10:1 ratio)

DO $$
DECLARE
  v_grain_id UUID;
  v_iron_id UUID;
  v_oil_id UUID;
BEGIN
  -- Get resource IDs
  SELECT id INTO v_grain_id FROM resources WHERE key = 'grain';
  SELECT id INTO v_iron_id FROM resources WHERE key = 'iron';
  SELECT id INTO v_oil_id FROM resources WHERE key = 'oil';

  -- Update HARVEST GRAIN: 0 inputs → 10 grain
  UPDATE production_recipes
  SET outputs = jsonb_build_object(
    v_grain_id::TEXT, jsonb_build_object(
      'base_quantity', 10,
      'quality_level', 1
    )
  )
  WHERE key = 'harvest_grain';

  -- Update MINE IRON: 0 inputs → 10 iron
  UPDATE production_recipes
  SET outputs = jsonb_build_object(
    v_iron_id::TEXT, jsonb_build_object(
      'base_quantity', 10,
      'quality_level', 1
    )
  )
  WHERE key = 'mine_iron';

  -- Update DRILL OIL: 0 inputs → 10 oil
  UPDATE production_recipes
  SET outputs = jsonb_build_object(
    v_oil_id::TEXT, jsonb_build_object(
      'base_quantity', 10,
      'quality_level', 1
    )
  )
  WHERE key = 'drill_oil';

  RAISE NOTICE 'Production quantities updated: harvest recipes now produce 10 units';
END $$;

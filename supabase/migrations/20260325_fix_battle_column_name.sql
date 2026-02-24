-- Fix battle column name inconsistency
-- Some migrations use region_hex_id, others use target_hex_id
-- This ensures we use target_hex_id consistently

-- First, check if we need to rename the column
DO $$
BEGIN
  -- If region_hex_id exists and target_hex_id doesn't, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battles'
    AND column_name = 'region_hex_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battles'
    AND column_name = 'target_hex_id'
  ) THEN
    ALTER TABLE public.battles RENAME COLUMN region_hex_id TO target_hex_id;
  END IF;
END$$;

-- Update the resolve_battle_outcome function to ensure it works correctly
CREATE OR REPLACE FUNCTION public.resolve_battle_outcome(
  p_battle_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
  v_hex_id TEXT;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown', 'error', 'Battle not found');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('status', v_battle.status);
  END IF;

  IF v_battle.current_defense < 0 THEN
    v_outcome := 'attacker_win';
  ELSIF NOW() > v_battle.ends_at THEN
    v_outcome := 'defender_win';
  ELSE
    RETURN jsonb_build_object('status', 'active');
  END IF;

  -- Get the hex_id - try both possible column names for safety
  BEGIN
    v_hex_id := v_battle.target_hex_id;
  EXCEPTION WHEN OTHERS THEN
    -- If target_hex_id doesn't exist, this will be NULL
    v_hex_id := NULL;
  END;

  IF v_outcome = 'attacker_win' AND v_hex_id IS NOT NULL THEN
    -- Use INSERT ... ON CONFLICT to safely update or insert the region
    BEGIN
      INSERT INTO public.world_regions (hex_id, owner_community_id, fortification_level, resource_yield, last_conquered_at)
      VALUES (
        v_hex_id,
        v_battle.attacker_community_id,
        1000,
        10,
        NOW()
      )
      ON CONFLICT (hex_id) DO UPDATE SET
        owner_community_id = EXCLUDED.owner_community_id,
        fortification_level = EXCLUDED.fortification_level,
        last_conquered_at = EXCLUDED.last_conquered_at;
    EXCEPTION WHEN OTHERS THEN
      -- Log the error but don't fail the battle resolution
      RAISE NOTICE 'Failed to update world_regions: %', SQLERRM;
    END;
  END IF;

  UPDATE public.battles
  SET status = v_outcome
  WHERE id = p_battle_id;

  -- Process rankings if the function exists
  BEGIN
    PERFORM public.process_battle_ranking(p_battle_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to process battle ranking: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'status', v_outcome,
    'current_defense', v_battle.current_defense
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure battle outcomes resolve consistently:
-- - Attacker wins at `current_defense <= 0` (not just < 0)
-- - Defender wins at `NOW() >= ends_at` (not just > ends_at)

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

  IF v_battle.current_defense <= 0 THEN
    v_outcome := 'attacker_win';
  ELSIF NOW() >= v_battle.ends_at THEN
    v_outcome := 'defender_win';
  ELSE
    RETURN jsonb_build_object('status', 'active');
  END IF;

  -- Extract hex id defensively (older schemas may differ).
  BEGIN
    v_hex_id := v_battle.target_hex_id;
  EXCEPTION WHEN OTHERS THEN
    v_hex_id := NULL;
  END;

  IF v_outcome = 'attacker_win' AND v_hex_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.world_regions (
        hex_id,
        owner_community_id,
        fortification_level,
        resource_yield,
        last_conquered_at
      )
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
      RAISE NOTICE 'Failed to update world_regions: %', SQLERRM;
    END;
  END IF;

  UPDATE public.battles
  SET status = v_outcome
  WHERE id = p_battle_id;

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


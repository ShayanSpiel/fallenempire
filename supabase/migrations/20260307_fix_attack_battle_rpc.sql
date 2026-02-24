-- Fix attack_battle to resolve actor IDs and keep battle logs consistent

DROP FUNCTION IF EXISTS public.attack_battle(UUID, INT);
DROP FUNCTION IF EXISTS public.attack_battle(UUID, INT, UUID);

CREATE OR REPLACE FUNCTION public.attack_battle(
  p_battle_id UUID,
  p_damage INT DEFAULT 10,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_actor_id UUID;
  v_actor_username TEXT := 'system';
  v_side TEXT := 'attacker';
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF v_battle.status <> 'active' THEN
    RAISE EXCEPTION 'This battle is finished.';
  END IF;

  IF p_actor_id IS NOT NULL THEN
    SELECT id INTO v_actor_id
    FROM public.users
    WHERE id = p_actor_id;

    IF v_actor_id IS NULL THEN
      SELECT id INTO v_actor_id
      FROM public.users
      WHERE auth_id = p_actor_id;
    END IF;
  ELSE
    SELECT id INTO v_actor_id
    FROM public.users
    WHERE auth_id = auth.uid();
  END IF;

  IF v_actor_id IS NULL AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.users (auth_id, username, email, is_bot)
    SELECT
      au.id AS auth_id,
      COALESCE(
        NULLIF(TRIM(au.raw_user_meta_data ->> 'username'), ''),
        LOWER(NULLIF(SPLIT_PART(COALESCE(au.email, ''), '@', 1), '')),
        'player-' || LEFT(au.id::text, 8)
      ) AS username,
      au.email,
      FALSE
    FROM auth.users au
    WHERE au.id = auth.uid()
    ON CONFLICT (auth_id) DO NOTHING
    RETURNING id INTO v_actor_id;

    IF v_actor_id IS NULL THEN
      SELECT id INTO v_actor_id
      FROM public.users
      WHERE auth_id = auth.uid();
    END IF;
  END IF;

  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(username, 'Unknown') INTO v_actor_username
    FROM public.users
    WHERE id = v_actor_id;
  END IF;

  IF p_damage < 0 THEN
    v_side := 'defender';
  END IF;

  UPDATE public.battles
  SET current_defense = current_defense - p_damage,
      attacker_score = attacker_score + GREATEST(p_damage, 0),
      defender_score = defender_score + GREATEST(-p_damage, 0)
  WHERE id = p_battle_id
  RETURNING current_defense, attacker_score, defender_score
  INTO v_battle.current_defense, v_battle.attacker_score, v_battle.defender_score;

  INSERT INTO public.battle_logs (battle_id, actor_id, actor_username, action_type, damage_amount, side)
  VALUES (p_battle_id, v_actor_id, v_actor_username, 'strike', p_damage, v_side);

  -- Resolve battle if conditions are met so rankings/medals update immediately
  PERFORM public.resolve_battle_outcome(p_battle_id);

  RETURN jsonb_build_object(
    'current_defense', v_battle.current_defense,
    'attacker_score', v_battle.attacker_score,
    'defender_score', v_battle.defender_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FIX: attack_battle() to use correct battle_logs column names
-- ============================================================================
-- The battle_logs table uses: user_id, username, damage, side
-- NOT: actor_id, actor_username, damage_amount, side, result
-- ============================================================================

DROP FUNCTION IF EXISTS public.attack_battle(UUID, INT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.attack_battle(
  p_battle_id UUID,
  p_damage INT DEFAULT 10,
  p_actor_id UUID DEFAULT NULL,
  p_result TEXT DEFAULT 'HIT'
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_actor_id UUID;
  v_actor_username TEXT := 'system';
  v_actor_avatar_url TEXT;
  v_side TEXT := 'attacker';
  v_target_auth_id UUID;
BEGIN
  -- Validate inputs
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000';
  END IF;

  IF p_battle_id IS NULL OR p_damage IS NULL THEN
    RAISE EXCEPTION 'Missing battleId or damage' USING ERRCODE = '22004';
  END IF;

  -- Prevent actor spoofing (only service_role can set actor_id)
  IF p_actor_id IS NOT NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF v_battle.status <> 'active' THEN
    RAISE EXCEPTION 'This battle is finished.';
  END IF;

  -- Try to resolve actor_id to public.users.id
  IF p_actor_id IS NOT NULL THEN
    -- First try: p_actor_id is public.users.id
    SELECT id INTO v_actor_id
    FROM public.users
    WHERE id = p_actor_id;

    -- Second try: p_actor_id might be auth.users.id
    IF v_actor_id IS NULL THEN
      SELECT id INTO v_actor_id
      FROM public.users
      WHERE auth_id = p_actor_id;
    END IF;
  ELSE
    -- Use authenticated user
    SELECT id INTO v_actor_id
    FROM public.users
    WHERE auth_id = auth.uid();
  END IF;

  -- If still no actor found, try to create user
  IF v_actor_id IS NULL THEN
    -- Determine which auth_id to use
    v_target_auth_id := auth.uid();

    -- Only try to create if we have an auth_id
    IF v_target_auth_id IS NOT NULL THEN
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
      WHERE au.id = v_target_auth_id
      ON CONFLICT (auth_id) DO NOTHING
      RETURNING id INTO v_actor_id;

      -- If INSERT didn't return (conflict), try SELECT again
      IF v_actor_id IS NULL THEN
        SELECT id INTO v_actor_id
        FROM public.users
        WHERE auth_id = v_target_auth_id;
      END IF;
    END IF;
  END IF;

  -- Get username if we have an actor
  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(username, 'Unknown'), avatar_url
    INTO v_actor_username, v_actor_avatar_url
    FROM public.users
    WHERE id = v_actor_id;
  END IF;

  -- Determine side based on damage sign
  IF p_damage < 0 THEN
    v_side := 'defender';
  END IF;

  -- Update battle state
  UPDATE public.battles
  SET current_defense = current_defense - p_damage,
      attacker_score = attacker_score + GREATEST(p_damage, 0),
      defender_score = defender_score + GREATEST(-p_damage, 0)
  WHERE id = p_battle_id
  RETURNING current_defense, attacker_score, defender_score
  INTO v_battle.current_defense, v_battle.attacker_score, v_battle.defender_score;

  -- Insert battle log with CORRECT COLUMN NAMES (include result when available)
  IF v_actor_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.battle_logs (
        battle_id,
        user_id,        -- NOT actor_id
        username,       -- NOT actor_username
        damage,         -- NOT damage_amount
        side,
        result,
        actor_avatar_url
      )
      VALUES (
        p_battle_id,
        v_actor_id,
        v_actor_username,
        p_damage,
        v_side,
        p_result,
        v_actor_avatar_url
      );
    EXCEPTION WHEN undefined_column THEN
      BEGIN
        INSERT INTO public.battle_logs (
          battle_id,
          user_id,        -- NOT actor_id
          username,       -- NOT actor_username
          damage,         -- NOT damage_amount
          side,
          result
        )
        VALUES (
          p_battle_id,
          v_actor_id,
          v_actor_username,
          p_damage,
          v_side,
          p_result
        );
      EXCEPTION WHEN undefined_column THEN
        INSERT INTO public.battle_logs (
          battle_id,
          user_id,        -- NOT actor_id
          username,       -- NOT actor_username
          damage,         -- NOT damage_amount
          side
        )
        VALUES (
          p_battle_id,
          v_actor_id,
          v_actor_username,
          p_damage,
          v_side
        );
      END;
    END;
  END IF;

  -- ============================================================================
  -- CRITICAL: Record participation (this triggers morale/rage updates)
  -- ============================================================================
  IF v_actor_id IS NOT NULL THEN
    PERFORM public.record_battle_participation(
      v_actor_id,
      p_battle_id,
      v_side,
      ABS(p_damage)
    );
  END IF;

  -- Resolve battle if conditions are met
  PERFORM public.resolve_battle_outcome(p_battle_id);

  RETURN jsonb_build_object(
    'current_defense', v_battle.current_defense,
    'attacker_score', v_battle.attacker_score,
    'defender_score', v_battle.defender_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- COMPLETION NOTE
-- ============================================================================
-- Fixed column name mismatch:
-- - battle_logs uses: user_id, username, damage (NOT actor_id, actor_username, damage_amount)
-- - result is inserted when the column exists, otherwise ignored
-- - battle_action_log tracks hit/critical regardless of battle_logs schema
-- ============================================================================

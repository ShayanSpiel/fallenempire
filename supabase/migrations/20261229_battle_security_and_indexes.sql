-- Security + performance hardening
-- - Harden SECURITY DEFINER battle RPCs (auth checks, safe search_path, no actor spoofing)
-- - Add missing indexes for common feed/comment/reaction queries

-- Comments are fetched by post_id ordered by created_at
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at
ON public.comments(post_id, created_at);

-- Reactions are counted by (post_id, type) and looked up by (post_id, user_id)
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id_type
ON public.post_reactions(post_id, type);

-- Avoid PostgREST ambiguity (PGRST203) when multiple overloads exist.
DROP FUNCTION IF EXISTS public.attack_battle(uuid, integer);

-- Battle attack RPC: enforce authenticated caller + prevent actor spoofing; record participation for missions/stats.
CREATE OR REPLACE FUNCTION public.attack_battle(
  p_battle_id UUID,
  p_damage INT DEFAULT 10,
  p_actor_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_actor_id UUID;
  v_actor_auth_id UUID;
  v_actor_username TEXT := 'system';
  v_side TEXT := 'attacker';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000';
  END IF;

  IF p_battle_id IS NULL OR p_damage IS NULL THEN
    RAISE EXCEPTION 'Missing battleId or damage' USING ERRCODE = '22004';
  END IF;

  -- Prevent clients from spoofing who performed the action.
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

  -- Resolve actor to public.users.id (creates the row if missing)
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_actor_id
    FROM public.users
    WHERE auth_id = auth.uid();
  ELSIF p_actor_id IS NOT NULL THEN
    SELECT id INTO v_actor_id
    FROM public.users
    WHERE id = p_actor_id;

    IF v_actor_id IS NULL THEN
      SELECT id INTO v_actor_id
      FROM public.users
      WHERE auth_id = p_actor_id;
    END IF;
  END IF;

  IF v_actor_id IS NULL THEN
    -- Only attempt to auto-create when we have an auth user id
    IF auth.uid() IS NOT NULL THEN
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
  END IF;

  IF v_actor_id IS NOT NULL THEN
    SELECT COALESCE(username, 'Unknown') INTO v_actor_username
    FROM public.users
    WHERE id = v_actor_id;

    SELECT auth_id INTO v_actor_auth_id
    FROM public.users
    WHERE id = v_actor_id;
  END IF;

  IF p_damage < 0 THEN
    v_side := 'defender';
  END IF;

  UPDATE public.battles
  SET current_defense = GREATEST(current_defense - p_damage, 0),
      attacker_score = attacker_score + GREATEST(p_damage, 0),
      defender_score = defender_score + GREATEST(-p_damage, 0)
  WHERE id = p_battle_id
  RETURNING current_defense, attacker_score, defender_score
  INTO v_battle.current_defense, v_battle.attacker_score, v_battle.defender_score;

  -- Insert into battle_logs (schema differs across migrations/projects; handle common variants).
  BEGIN
    BEGIN
      INSERT INTO public.battle_logs (battle_id, user_id, username, damage, side)
      VALUES (
        p_battle_id,
        COALESCE(auth.uid(), v_actor_auth_id),
        v_actor_username,
        p_damage,
        v_side
      );
    EXCEPTION WHEN foreign_key_violation THEN
      -- Some schemas use public.users.id as user_id instead of auth.users.id
      INSERT INTO public.battle_logs (battle_id, user_id, username, damage, side)
      VALUES (p_battle_id, v_actor_id, v_actor_username, p_damage, v_side);
    END;
  EXCEPTION WHEN undefined_column THEN
    -- Older schema: actor_id + action_type + damage_amount
    INSERT INTO public.battle_logs (battle_id, actor_id, actor_username, action_type, damage_amount, side)
    VALUES (p_battle_id, v_actor_id, v_actor_username, 'strike', p_damage, v_side);
  END;

  -- Wire participation missions + military stats to actual fighting
  IF auth.uid() IS NOT NULL AND v_actor_id IS NOT NULL THEN
    PERFORM public.record_battle_participation(
      auth.uid(),
      p_battle_id,
      v_side,
      ABS(p_damage)
    );
  END IF;

  -- Resolve battle if conditions are met so rankings/medals update immediately
  PERFORM public.resolve_battle_outcome(p_battle_id);

  RETURN jsonb_build_object(
    'current_defense', v_battle.current_defense,
    'attacker_score', v_battle.attacker_score,
    'defender_score', v_battle.defender_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Ensure battle outcome respects the timer (no early finish).
CREATE OR REPLACE FUNCTION public.resolve_battle_outcome(
  p_battle_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('status', v_battle.status);
  END IF;

  IF NOW() < v_battle.ends_at THEN
    RETURN jsonb_build_object('status', 'active', 'current_defense', v_battle.current_defense);
  END IF;

  IF v_battle.current_defense <= 0 THEN
    v_outcome := 'attacker_win';
  ELSE
    v_outcome := 'defender_win';
  END IF;

  IF v_outcome = 'attacker_win' THEN
    INSERT INTO public.world_regions (hex_id, owner_community_id, fortification_level, resource_yield, last_conquered_at)
    VALUES (
      v_battle.target_hex_id,
      v_battle.attacker_community_id,
      1000,
      10,
      NOW()
    )
    ON CONFLICT (hex_id) DO UPDATE SET
      owner_community_id = EXCLUDED.owner_community_id,
      fortification_level = EXCLUDED.fortification_level,
      last_conquered_at = EXCLUDED.last_conquered_at;
  END IF;

  UPDATE public.battles
  SET status = v_outcome
  WHERE id = p_battle_id;

  PERFORM public.process_battle_ranking(p_battle_id);

  RETURN jsonb_build_object(
    'status', v_outcome,
    'current_defense', v_battle.current_defense
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Participation + mission progress: enforce caller ownership unless service_role.
CREATE OR REPLACE FUNCTION public.record_battle_participation(
  p_user_id UUID,
  p_battle_id UUID,
  p_side TEXT,
  p_damage INT
)
RETURNS TABLE (
  total_damage_dealt BIGINT,
  highest_damage_battle INT,
  battles_fought INT,
  current_military_rank TEXT,
  military_rank_score BIGINT
) AS $$
DECLARE
  v_user_id UUID;
  v_caller_user_id UUID;
  v_participant_damage INT;
  v_is_new_battle BOOLEAN := FALSE;
  v_user_stats RECORD;
  v_medal_count INT := 0;
  v_new_score BIGINT := 0;
  v_new_rank TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '28000';
  END IF;

  IF p_user_id IS NULL OR p_battle_id IS NULL OR p_damage IS NULL THEN
    RETURN;
  END IF;

  IF p_side IS NULL OR p_side NOT IN ('attacker', 'defender') THEN
    RAISE EXCEPTION 'Invalid side' USING ERRCODE = '22023';
  END IF;

  p_damage := ABS(p_damage);

  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    -- Allow passing either auth.uid() or the caller's public.users.id.
    IF p_user_id <> auth.uid() THEN
      SELECT id INTO v_caller_user_id FROM public.users WHERE auth_id = auth.uid();
      IF v_caller_user_id IS NULL OR p_user_id <> v_caller_user_id THEN
        RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  SELECT id INTO v_user_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_id = p_user_id;
  END IF;

  IF v_user_id IS NULL THEN
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
    WHERE au.id = p_user_id
    ON CONFLICT (auth_id) DO NOTHING
    RETURNING id INTO v_user_id;

    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE auth_id = p_user_id;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.battle_participants (user_id, battle_id, side, damage_dealt)
  VALUES (v_user_id, p_battle_id, p_side, p_damage)
  ON CONFLICT (user_id, battle_id) DO UPDATE
    SET damage_dealt = public.battle_participants.damage_dealt + EXCLUDED.damage_dealt,
        side = EXCLUDED.side
  RETURNING damage_dealt, (xmax = 0) AS inserted
  INTO v_participant_damage, v_is_new_battle;

  -- Only count missions once per battle (first time user participates).
  IF v_is_new_battle THEN
    BEGIN
      PERFORM 1 FROM public.update_mission_progress(v_user_id, 'daily-battle', 1);
      PERFORM 1 FROM public.update_mission_progress(v_user_id, 'weekly-battles', 1);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END IF;

  UPDATE public.users u
  SET total_damage_dealt = COALESCE(u.total_damage_dealt, 0) + p_damage,
      highest_damage_battle = GREATEST(COALESCE(u.highest_damage_battle, 0), v_participant_damage),
      battles_fought = COALESCE(u.battles_fought, 0) + CASE WHEN v_is_new_battle THEN 1 ELSE 0 END
  WHERE u.id = v_user_id
  RETURNING u.battles_fought, u.battles_won, u.total_damage_dealt, u.highest_damage_battle, u.win_streak
  INTO v_user_stats;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_medal_count
  FROM public.user_medals um
  JOIN public.medals m ON um.medal_id = m.id
  WHERE um.user_id = v_user_id
    AND m.key = 'battle_hero';

  v_new_score := public.calculate_military_rank_score(
    COALESCE(v_user_stats.total_damage_dealt, 0),
    COALESCE(v_user_stats.battles_won, 0)::INT,
    v_medal_count::INT,
    COALESCE(v_user_stats.win_streak, 0)::INT,
    GREATEST(COALESCE(v_user_stats.battles_fought, 0), 1)::INT
  );

  v_new_rank := public.get_military_rank_from_score(v_new_score);

  UPDATE public.users
  SET military_rank_score = v_new_score,
      current_military_rank = v_new_rank
  WHERE id = v_user_id;

  RETURN QUERY
  SELECT
    v_user_stats.total_damage_dealt,
    v_user_stats.highest_damage_battle,
    v_user_stats.battles_fought,
    v_new_rank,
    v_new_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.attack_battle(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attack_battle(uuid, integer, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.record_battle_participation(uuid, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_battle_participation(uuid, uuid, text, integer) TO authenticated, service_role;

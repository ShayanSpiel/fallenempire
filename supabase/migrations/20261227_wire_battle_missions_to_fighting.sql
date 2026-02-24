-- Wire battle participation missions to actual fighting.
-- Previously, battle missions were incorrectly incremented on war declaration (not on fight).

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
  v_participant_damage INT;
  v_is_new_battle BOOLEAN := FALSE;
  v_user_stats RECORD;
  v_medal_count INT := 0;
  v_new_score BIGINT := 0;
  v_new_rank TEXT;
BEGIN
  IF p_user_id IS NULL OR p_battle_id IS NULL OR p_damage IS NULL THEN
    RETURN;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


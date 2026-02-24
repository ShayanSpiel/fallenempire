-- 1. Track ranking processing state
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS rankings_processed_at TIMESTAMPTZ;

-- 2. Helper to accumulate battle participant damage
CREATE OR REPLACE FUNCTION public.record_battle_participation(
  p_user_id UUID,
  p_battle_id UUID,
  p_side TEXT,
  p_damage INT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.battle_participants (user_id, battle_id, side, damage_dealt)
  VALUES (p_user_id, p_battle_id, p_side, p_damage)
  ON CONFLICT (user_id, battle_id) DO UPDATE
  SET damage_dealt = battle_participants.damage_dealt + EXCLUDED.damage_dealt,
      side = EXCLUDED.side;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Score math helpers
CREATE OR REPLACE FUNCTION public.calculate_military_rank_score(
  p_total_damage BIGINT,
  p_battles_won INT,
  p_battle_hero_medals INT,
  p_win_streak INT,
  p_total_battles INT
)
RETURNS BIGINT AS $$
DECLARE
  v_score NUMERIC := 0;
  v_avg_damage NUMERIC := 0;
  v_win_bonus NUMERIC := 0;
  v_hero_bonus BIGINT := 0;
  v_streak_multiplier NUMERIC := 0;
  v_streak_bonus NUMERIC := 0;
BEGIN
  IF p_total_battles <= 0 THEN
    RETURN 0;
  END IF;

  v_score := COALESCE(p_total_damage, 0);
  v_avg_damage := v_score::NUMERIC / p_total_battles;
  v_win_bonus := FLOOR(p_battles_won * (v_avg_damage * 0.1));
  v_score := v_score + v_win_bonus;

  v_hero_bonus := COALESCE(p_battle_hero_medals, 0) * 5000;
  v_score := v_score + v_hero_bonus;

  v_streak_multiplier := LEAST(COALESCE(p_win_streak, 0) * 0.02, 0.2);
  v_streak_bonus := FLOOR(v_score * v_streak_multiplier);
  v_score := v_score + v_streak_bonus;

  RETURN GREATEST(0, FLOOR(v_score))::BIGINT;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_military_rank_from_score(p_score BIGINT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN p_score >= 600000 THEN 'General'
    WHEN p_score >= 300000 THEN 'Colonel'
    WHEN p_score >= 150000 THEN 'Major'
    WHEN p_score >= 75000 THEN 'Captain'
    WHEN p_score >= 35000 THEN 'Lieutenant'
    WHEN p_score >= 15000 THEN 'Sergeant'
    WHEN p_score >= 5000 THEN 'Corporal'
    WHEN p_score >= 1000 THEN 'Private'
    ELSE 'Recruit'
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Process ranking updates for a resolved battle
CREATE OR REPLACE FUNCTION public.process_battle_ranking(p_battle_id UUID)
RETURNS VOID AS $$
DECLARE
  v_battle RECORD;
  v_winner TEXT;
  v_participant RECORD;
  v_user_stats RECORD;
  v_new_battles_fought INT;
  v_new_battles_won INT;
  v_new_total_damage BIGINT;
  v_new_highest_damage INT;
  v_new_win_streak INT;
  v_new_score BIGINT;
  v_new_rank TEXT;
  v_medal_count INT;
  v_participant_won BOOLEAN;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL OR v_battle.status = 'active' OR v_battle.rankings_processed_at IS NOT NULL THEN
    RETURN;
  END IF;

  v_winner := CASE
    WHEN v_battle.status IN ('attacker_win', 'attacker_won') THEN 'attacker'
    WHEN v_battle.status IN ('defender_win', 'defender_won') THEN 'defender'
    ELSE NULL
  END;

  IF v_winner IS NULL THEN
    RETURN;
  END IF;

  FOR v_participant IN
    SELECT user_id, side, COALESCE(damage_dealt, 0) AS damage_dealt
    FROM public.battle_participants
    WHERE battle_id = p_battle_id
  LOOP
    IF v_participant.user_id IS NULL THEN
      CONTINUE;
    END IF;

    SELECT battles_fought, battles_won, total_damage_dealt, highest_damage_battle, win_streak
    INTO v_user_stats
    FROM public.users
    WHERE id = v_participant.user_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_participant_won := v_participant.side = v_winner;
    v_new_battles_fought := COALESCE(v_user_stats.battles_fought, 0) + 1;
    v_new_battles_won :=
      COALESCE(v_user_stats.battles_won, 0) + CASE WHEN v_participant_won THEN 1 ELSE 0 END;
    v_new_total_damage := COALESCE(v_user_stats.total_damage_dealt, 0) + v_participant.damage_dealt;
    v_new_highest_damage := GREATEST(COALESCE(v_user_stats.highest_damage_battle, 0), v_participant.damage_dealt);
    v_new_win_streak := CASE WHEN v_participant_won THEN COALESCE(v_user_stats.win_streak, 0) + 1 ELSE 0 END;

    -- Count only battle_hero medals to match client-side logic
    SELECT COUNT(*) INTO v_medal_count
    FROM public.user_medals um
    JOIN public.medals m ON um.medal_id = m.id
    WHERE um.user_id = v_participant.user_id
    AND m.key = 'battle_hero';

    v_new_score := public.calculate_military_rank_score(
      v_new_total_damage,
      v_new_battles_won,
      v_medal_count,
      v_new_win_streak,
      v_new_battles_fought
    );

    v_new_rank := public.get_military_rank_from_score(v_new_score);

    UPDATE public.users
    SET battles_fought = v_new_battles_fought,
        battles_won = v_new_battles_won,
        total_damage_dealt = v_new_total_damage,
        highest_damage_battle = v_new_highest_damage,
        win_streak = v_new_win_streak,
        last_battle_win = v_participant_won,
        current_military_rank = v_new_rank,
        military_rank_score = v_new_score
    WHERE id = v_participant.user_id;

    UPDATE public.battle_participants
    SET won = v_participant_won
    WHERE battle_id = p_battle_id AND user_id = v_participant.user_id;
  END LOOP;

  UPDATE public.battles
  SET rankings_processed_at = NOW()
  WHERE id = p_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Ensure battle resolution triggers ranking updates
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

  IF v_battle.current_defense < 0 THEN
    v_outcome := 'attacker_win';
  ELSIF NOW() > v_battle.ends_at THEN
    v_outcome := 'defender_win';
  ELSE
    RETURN jsonb_build_object('status', 'active');
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

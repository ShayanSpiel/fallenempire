-- Reset functions so return types can change safely
DROP FUNCTION IF EXISTS public.record_battle_participation(uuid, uuid, text, integer) CASCADE;

-- Ensure battle participation updates user military stats in real time
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

  INSERT INTO public.battle_participants (user_id, battle_id, side, damage_dealt)
  VALUES (p_user_id, p_battle_id, p_side, p_damage)
  ON CONFLICT (user_id, battle_id) DO UPDATE
    SET damage_dealt = public.battle_participants.damage_dealt + EXCLUDED.damage_dealt,
        side = EXCLUDED.side
  RETURNING damage_dealt, (xmax = 0) AS inserted
  INTO v_participant_damage, v_is_new_battle;

  UPDATE public.users u
  SET total_damage_dealt = COALESCE(u.total_damage_dealt, 0) + p_damage,
      highest_damage_battle = GREATEST(COALESCE(u.highest_damage_battle, 0), v_participant_damage),
      battles_fought = COALESCE(u.battles_fought, 0) + CASE WHEN v_is_new_battle THEN 1 ELSE 0 END
  WHERE u.id = p_user_id
  RETURNING u.battles_fought, u.battles_won, u.total_damage_dealt, u.highest_damage_battle, u.win_streak
  INTO v_user_stats;

  SELECT COUNT(*)
  INTO v_medal_count
  FROM public.user_medals um
  JOIN public.medals m ON um.medal_id = m.id
  WHERE um.user_id = p_user_id
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
  WHERE id = p_user_id;

  RETURN QUERY
  SELECT
    v_user_stats.total_damage_dealt,
    v_user_stats.highest_damage_battle,
    v_user_stats.battles_fought,
    v_new_rank,
    v_new_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Avoid double-counting damage when resolving a battle; only update win/loss state and recompute rank
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
    v_new_battles_fought := GREATEST(COALESCE(v_user_stats.battles_fought, 0), 1);
    v_new_battles_won :=
      COALESCE(v_user_stats.battles_won, 0) + CASE WHEN v_participant_won THEN 1 ELSE 0 END;
    v_new_total_damage := COALESCE(v_user_stats.total_damage_dealt, 0);
    v_new_highest_damage := GREATEST(COALESCE(v_user_stats.highest_damage_battle, 0), v_participant.damage_dealt);
    v_new_win_streak := CASE WHEN v_participant_won THEN COALESCE(v_user_stats.win_streak, 0) + 1 ELSE 0 END;

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

-- Align existing participant win markers with recorded battle outcomes
UPDATE public.battle_participants bp
SET won = CASE
  WHEN b.status IN ('attacker_win', 'attacker_won') AND bp.side = 'attacker' THEN TRUE
  WHEN b.status IN ('defender_win', 'defender_won') AND bp.side = 'defender' THEN TRUE
  WHEN b.status IN ('attacker_win', 'attacker_won', 'defender_win', 'defender_won') THEN FALSE
  ELSE bp.won
END
FROM public.battles b
WHERE bp.battle_id = b.id
  AND b.status <> 'active';

-- Backfill user stats from existing battle_participants so leaderboards/profile show current rankings
WITH participant_stats AS (
  SELECT
    bp.user_id,
    COUNT(DISTINCT bp.battle_id) AS battles_fought,
    SUM(bp.damage_dealt)::BIGINT AS total_damage,
    MAX(bp.damage_dealt) AS highest_damage,
    SUM(CASE WHEN bp.won IS TRUE THEN 1 ELSE 0 END) AS battles_won
  FROM public.battle_participants bp
  GROUP BY bp.user_id
),
medal_counts AS (
  SELECT um.user_id, COUNT(*) AS medal_count
  FROM public.user_medals um
  JOIN public.medals m ON um.medal_id = m.id
  WHERE m.key = 'battle_hero'
  GROUP BY um.user_id
),
recalculated AS (
  SELECT
    ps.user_id,
    COALESCE(ps.total_damage, 0) AS total_damage,
    COALESCE(ps.highest_damage, 0) AS highest_damage,
    COALESCE(ps.battles_fought, 0) AS battles_fought,
    COALESCE(ps.battles_won, 0) AS battles_won,
    COALESCE(mc.medal_count, 0) AS medal_count
  FROM participant_stats ps
  LEFT JOIN medal_counts mc ON mc.user_id = ps.user_id
)
UPDATE public.users u
SET total_damage_dealt = r.total_damage,
    highest_damage_battle = GREATEST(COALESCE(u.highest_damage_battle, 0), r.highest_damage),
    battles_fought = r.battles_fought,
    battles_won = r.battles_won,
    military_rank_score = public.calculate_military_rank_score(
      r.total_damage,
      r.battles_won::INT,
      r.medal_count::INT,
      COALESCE(u.win_streak, 0)::INT,
      GREATEST(r.battles_fought, 1)::INT
    ),
    current_military_rank = public.get_military_rank_from_score(
      public.calculate_military_rank_score(
        r.total_damage,
        r.battles_won::INT,
        r.medal_count::INT,
        COALESCE(u.win_streak, 0)::INT,
        GREATEST(r.battles_fought, 1)::INT
      )
    )
FROM recalculated r
WHERE u.id = r.user_id;

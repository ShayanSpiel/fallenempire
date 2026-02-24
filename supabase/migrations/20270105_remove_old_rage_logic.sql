-- Remove Old Rage Logic from Battle Participation
-- Date: January 5, 2027
-- Description: Removes the old "+5 rage when wall < 2000" logic that was replaced by the Adrenaline Rule

-- ============================================================================
-- Drop all existing versions of record_battle_participation
-- ============================================================================

-- Drop all function overloads (we'll recreate the one we need)
DROP FUNCTION IF EXISTS public.record_battle_participation(UUID, UUID, INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.record_battle_participation CASCADE;

-- ============================================================================
-- Recreate record_battle_participation WITHOUT the old rage logic
-- ============================================================================

CREATE FUNCTION public.record_battle_participation(
  p_user_id UUID,
  p_battle_id UUID,
  p_damage INT,
  p_side TEXT
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

  -- Resolve user ID (handle both auth_id and public.users.id)
  SELECT id INTO v_user_id
  FROM public.users
  WHERE id = p_user_id;

  -- If user_id was actually an auth_id, try looking it up
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_id = p_user_id;
  END IF;

  -- Still no user? Create one on-the-fly
  IF v_user_id IS NULL THEN
    DECLARE
      v_auth RECORD;
    BEGIN
      SELECT * INTO v_auth FROM auth.users WHERE id = p_user_id;
      IF FOUND THEN
        INSERT INTO public.users (
          auth_id,
          username,
          email,
          is_bot,
          energy,
          energy_updated_at
        ) VALUES (
          v_auth.id,
          COALESCE(
            v_auth.raw_user_meta_data->>'username',
            v_auth.raw_user_meta_data->>'name',
            SPLIT_PART(v_auth.email, '@', 1),
            'player-' || SUBSTRING(v_auth.id::TEXT, 1, 8)
          ),
          v_auth.email,
          FALSE,
          100,
          NOW()
        )
        ON CONFLICT (auth_id) DO NOTHING
        RETURNING id INTO v_user_id;
      END IF;
    END;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Record participation in battle_participants table
  INSERT INTO public.battle_participants (user_id, battle_id, side, damage_dealt)
  VALUES (v_user_id, p_battle_id, p_side, p_damage)
  ON CONFLICT (user_id, battle_id) DO UPDATE
    SET damage_dealt = public.battle_participants.damage_dealt + EXCLUDED.damage_dealt,
        side = EXCLUDED.side
  RETURNING damage_dealt, (xmax = 0) AS inserted
  INTO v_participant_damage, v_is_new_battle;

  -- Record in user_battle_stats for aggregation
  INSERT INTO public.user_battle_stats (user_id, battle_id, damage_dealt, side)
  VALUES (v_user_id, p_battle_id, p_damage, p_side)
  ON CONFLICT (user_id, battle_id) DO UPDATE
    SET damage_dealt = public.user_battle_stats.damage_dealt + EXCLUDED.damage_dealt,
        side = EXCLUDED.side;

  -- Update user battle stats
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

  -- Calculate and update military rank
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

  -- ============================================================================
  -- Apply morale impact from battle participation (small cost per action)
  -- ============================================================================
  BEGIN
    PERFORM public.record_morale_event(
      v_user_id,
      'battle',
      'battle_action',
      -0.5,  -- Small morale cost per battle action
      NULL,
      jsonb_build_object(
        'battle_id', p_battle_id,
        'damage', p_damage,
        'side', p_side
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- If morale function fails, don't block battle participation
    RAISE WARNING 'Failed to record morale event: %', SQLERRM;
  END;

  -- NOTE: Old rage logic REMOVED
  -- The "+5 rage when wall < 2000" mechanic has been replaced by the Adrenaline Rule system
  -- Adrenaline rage is now calculated client-side and validated server-side during attacks

  RETURN QUERY
  SELECT
    v_user_stats.total_damage_dealt,
    v_user_stats.highest_damage_battle,
    v_user_stats.battles_fought,
    v_new_rank,
    v_new_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.record_battle_participation TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_battle_participation TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION public.record_battle_participation IS
'Records battle participation and updates user stats. Old rage logic removed - replaced by Adrenaline Rule.';

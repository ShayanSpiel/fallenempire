-- Complete fix for get_user_battle_pass_data function
-- Removes all ambiguous column references

DROP FUNCTION IF EXISTS get_user_battle_pass_data(UUID);

CREATE FUNCTION get_user_battle_pass_data(
  p_user_id UUID
)
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
  v_season_id UUID;
  v_season_name TEXT;
  v_season_number INTEGER;
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_xp_per_tier INTEGER;
  v_total_tiers INTEGER;
  v_total_xp INTEGER;
  v_current_tier INTEGER;
  v_has_keeper_pass BOOLEAN;
  v_last_daily_login_date DATE;
  v_tiers JSONB;
  v_claimed JSONB;
BEGIN
  -- Get active season
  SELECT 
    s.id,
    s.name,
    s.season_number,
    s.start_date,
    s.end_date,
    s.xp_per_tier,
    s.total_tiers
  INTO 
    v_season_id,
    v_season_name,
    v_season_number,
    v_start_date,
    v_end_date,
    v_xp_per_tier,
    v_total_tiers
  FROM battle_pass_seasons s
  WHERE s.is_active = true
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active season');
  END IF;

  -- Get or create user progress
  INSERT INTO user_battle_pass_progress (user_id, season_id, total_xp, current_tier)
  VALUES (p_user_id, v_season_id, 0, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  -- Get user progress
  SELECT 
    prog.total_xp,
    prog.current_tier,
    prog.has_keeper_pass,
    prog.last_daily_login_date
  INTO
    v_total_xp,
    v_current_tier,
    v_has_keeper_pass,
    v_last_daily_login_date
  FROM user_battle_pass_progress prog
  WHERE prog.user_id = p_user_id 
    AND prog.season_id = v_season_id;

  -- Get all tiers for this season
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', tier.id,
      'tier_number', tier.tier_number,
      'tier_type', tier.tier_type,
      'reward_type', tier.reward_type,
      'reward_amount', tier.reward_amount,
      'reward_data', tier.reward_data
    ) ORDER BY tier.tier_number, tier.tier_type
  ) INTO v_tiers
  FROM battle_pass_tiers tier
  WHERE tier.season_id = v_season_id;

  -- Get claimed rewards
  SELECT jsonb_agg(
    jsonb_build_object(
      'tier_number', reward.tier_number,
      'tier_type', reward.tier_type,
      'claimed_at', reward.claimed_at
    )
  ) INTO v_claimed
  FROM user_battle_pass_rewards reward
  WHERE reward.user_id = p_user_id 
    AND reward.season_id = v_season_id;

  -- Return all data
  RETURN jsonb_build_object(
    'success', true,
    'season', jsonb_build_object(
      'id', v_season_id,
      'name', v_season_name,
      'season_number', v_season_number,
      'start_date', v_start_date,
      'end_date', v_end_date,
      'xp_per_tier', v_xp_per_tier,
      'total_tiers', v_total_tiers
    ),
    'progress', jsonb_build_object(
      'total_xp', v_total_xp,
      'current_tier', v_current_tier,
      'has_keeper_pass', v_has_keeper_pass,
      'last_daily_login_date', v_last_daily_login_date
    ),
    'tiers', COALESCE(v_tiers, '[]'::jsonb),
    'claimed_rewards', COALESCE(v_claimed, '[]'::jsonb)
  );
END;
$$;

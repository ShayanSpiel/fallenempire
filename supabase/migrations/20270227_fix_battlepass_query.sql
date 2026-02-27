-- Fix ambiguous column reference in get_user_battle_pass_data function

CREATE OR REPLACE FUNCTION get_user_battle_pass_data(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_season_id UUID;
  v_progress RECORD;
  v_tiers JSONB;
  v_claimed JSONB;
BEGIN
  -- Get active season
  SELECT id INTO v_season_id
  FROM battle_pass_seasons
  WHERE is_active = true
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active season');
  END IF;

  -- Get or create progress
  PERFORM get_or_create_user_battle_pass_progress(p_user_id);

  -- Get progress data with explicit table aliases
  SELECT
    p.id,
    p.season_id,
    p.total_xp,
    p.current_tier,
    p.has_keeper_pass,
    p.last_daily_login_date,
    s.name as season_name,
    s.season_number,
    s.start_date,
    s.end_date,
    s.xp_per_tier,
    s.total_tiers
  INTO v_progress
  FROM user_battle_pass_progress p
  JOIN battle_pass_seasons s ON s.id = p.season_id
  WHERE p.user_id = p_user_id AND p.season_id = v_season_id;

  -- Get all tiers for this season
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'tier_number', t.tier_number,
      'tier_type', t.tier_type,
      'reward_type', t.reward_type,
      'reward_amount', t.reward_amount,
      'reward_data', t.reward_data
    ) ORDER BY t.tier_number, t.tier_type
  ) INTO v_tiers
  FROM battle_pass_tiers t
  WHERE t.season_id = v_season_id;

  -- Get claimed rewards for this user and season
  SELECT jsonb_agg(
    jsonb_build_object(
      'tier_number', r.tier_number,
      'tier_type', r.tier_type,
      'claimed_at', r.claimed_at
    )
  ) INTO v_claimed
  FROM user_battle_pass_rewards r
  WHERE r.user_id = p_user_id AND r.season_id = v_season_id;

  RETURN jsonb_build_object(
    'success', true,
    'season', jsonb_build_object(
      'id', v_season_id,
      'name', v_progress.season_name,
      'season_number', v_progress.season_number,
      'start_date', v_progress.start_date,
      'end_date', v_progress.end_date,
      'xp_per_tier', v_progress.xp_per_tier,
      'total_tiers', v_progress.total_tiers
    ),
    'progress', jsonb_build_object(
      'total_xp', v_progress.total_xp,
      'current_tier', v_progress.current_tier,
      'has_keeper_pass', v_progress.has_keeper_pass,
      'last_daily_login_date', v_progress.last_daily_login_date
    ),
    'tiers', COALESCE(v_tiers, '[]'::jsonb),
    'claimed_rewards', COALESCE(v_claimed, '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

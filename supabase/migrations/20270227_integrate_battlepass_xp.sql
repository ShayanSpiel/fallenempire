-- Integration: Hook Battle Pass XP into the award_xp function
-- This ensures that whenever a user earns regular XP, they also earn Battle Pass XP

-- Update the award_xp function to also award battle pass XP
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_source TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user RECORD;
  v_daily_cap INTEGER;
  v_xp_to_award INTEGER;
  v_new_total_xp BIGINT;
  v_new_level INTEGER;
  v_new_xp_in_level INTEGER;
  v_previous_level INTEGER;
  v_level_ups INTEGER := 0;
  v_level_calc RECORD;
  v_bp_result JSONB;
BEGIN
  -- Validate inputs
  IF p_xp_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'XP amount must be positive');
  END IF;

  IF p_source NOT IN ('battle', 'post', 'comment', 'training', 'mission') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid XP source');
  END IF;

  -- Get current user state
  SELECT
    total_xp, current_level, xp_in_current_level,
    daily_xp_earned, last_xp_reset
  INTO v_user
  FROM users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if daily reset needed (UTC midnight)
  IF v_user.last_xp_reset < CURRENT_DATE THEN
    UPDATE users SET
      daily_xp_earned = 0,
      last_xp_reset = CURRENT_DATE
    WHERE id = p_user_id;

    v_user.daily_xp_earned := 0;
  END IF;

  -- Apply daily cap logic per source type
  CASE p_source
    WHEN 'battle' THEN v_daily_cap := 500;
    WHEN 'post', 'comment' THEN v_daily_cap := 300;
    WHEN 'training' THEN v_daily_cap := 50;
    ELSE v_daily_cap := 1000;
  END CASE;

  -- Calculate XP to award with soft cap
  IF v_user.daily_xp_earned >= v_daily_cap THEN
    -- Already hit hard cap: award 25% of XP
    v_xp_to_award := GREATEST(1, FLOOR(p_xp_amount * 0.25)::INTEGER);
  ELSIF v_user.daily_xp_earned + p_xp_amount > v_daily_cap THEN
    -- Partial cap: award full up to cap, then 25% for overflow
    v_xp_to_award := (v_daily_cap - v_user.daily_xp_earned) +
                     FLOOR(((v_user.daily_xp_earned + p_xp_amount - v_daily_cap) * 0.25)::NUMERIC)::INTEGER;
  ELSE
    -- No cap: award full amount
    v_xp_to_award := p_xp_amount;
  END IF;

  -- Calculate new total XP and level
  v_new_total_xp := v_user.total_xp + v_xp_to_award;
  v_previous_level := v_user.current_level;

  -- Get new level from total XP
  SELECT level, xp_in_level, xp_for_next_level INTO v_level_calc
  FROM calculate_level_from_xp(v_new_total_xp);

  v_new_level := v_level_calc.level;
  v_new_xp_in_level := v_level_calc.xp_in_level;
  v_level_ups := GREATEST(0, v_new_level - v_previous_level);

  -- Update user record
  UPDATE users SET
    total_xp = v_new_total_xp,
    current_level = v_new_level,
    xp_in_current_level = v_new_xp_in_level,
    daily_xp_earned = LEAST(v_user.daily_xp_earned + v_xp_to_award, v_daily_cap + 1000),
    xp_updated_at = NOW()
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO xp_transactions (user_id, xp_amount, source, metadata)
  VALUES (p_user_id, v_xp_to_award, p_source, p_metadata || jsonb_build_object('awarded_at', NOW()));

  -- ⭐ NEW: Award battle pass XP (non-blocking, ignore errors)
  -- Award the ORIGINAL XP amount to battle pass (before daily caps)
  BEGIN
    SELECT award_battle_pass_xp(p_user_id, p_xp_amount, p_source) INTO v_bp_result;
  EXCEPTION WHEN OTHERS THEN
    -- Silently continue if battle pass system is unavailable
    RAISE NOTICE 'Battle pass XP award failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', v_xp_to_award,
    'xp_capped', (v_xp_to_award < p_xp_amount),
    'new_total_xp', v_new_total_xp,
    'previous_level', v_previous_level,
    'new_level', v_new_level,
    'level_ups', v_level_ups,
    'xp_for_next_level', v_level_calc.xp_for_next_level,
    'daily_xp_earned', v_user.daily_xp_earned + v_xp_to_award,
    'battle_pass_result', v_bp_result
  );
END;
$$;

-- Add mission as a valid source
COMMENT ON FUNCTION award_xp IS 'Awards XP to a user with daily caps. Also awards battle pass XP automatically. Valid sources: battle, post, comment, training, mission';

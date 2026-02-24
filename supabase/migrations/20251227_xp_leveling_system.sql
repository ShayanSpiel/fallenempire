-- XP Leveling System Migration
-- Adds experience points, level progression, and daily activity caps

-- Add XP columns to users table (one by one to avoid syntax issues)
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp BIGINT DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_in_current_level INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_xp_earned INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_xp_reset DATE DEFAULT CURRENT_DATE NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Add constraints separately
ALTER TABLE users ADD CONSTRAINT xp_current_level_range CHECK (current_level >= 1 AND current_level <= 100);
ALTER TABLE users ADD CONSTRAINT xp_in_level_nonnegative CHECK (xp_in_current_level >= 0);

-- Create XP transaction audit table for analytics and debugging
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_level_leaderboard ON users(current_level DESC, total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_time ON xp_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_source ON xp_transactions(source, created_at DESC);

-- Grant appropriate permissions
GRANT SELECT, INSERT ON xp_transactions TO anon, authenticated;

-- Create function to calculate level from total XP
-- Uses exponential curve: Levels 1-10: 100 XP/lvl, 11-30: 300 XP/lvl, etc.
CREATE OR REPLACE FUNCTION calculate_level_from_xp(p_total_xp BIGINT)
RETURNS TABLE (
  level INTEGER,
  xp_in_level INTEGER,
  xp_for_next_level INTEGER
) LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_remaining_xp BIGINT := p_total_xp;
  v_current_level INTEGER := 1;
  v_tier_xp_cost INTEGER;
  v_levels_in_tier INTEGER;
  v_total_tier_xp BIGINT;
BEGIN
  -- Tier 1: Levels 1-10, 100 XP per level
  v_tier_xp_cost := 100;
  v_levels_in_tier := 10;
  v_total_tier_xp := v_tier_xp_cost * v_levels_in_tier;

  IF v_remaining_xp >= v_total_tier_xp THEN
    v_remaining_xp := v_remaining_xp - v_total_tier_xp;
    v_current_level := 10;
  ELSE
    v_current_level := 1 + (v_remaining_xp / v_tier_xp_cost);
    v_remaining_xp := v_remaining_xp % v_tier_xp_cost;
    RETURN QUERY SELECT v_current_level, v_remaining_xp::INTEGER, v_tier_xp_cost;
    RETURN;
  END IF;

  -- Tier 2: Levels 11-30, 300 XP per level
  v_tier_xp_cost := 300;
  v_levels_in_tier := 20;
  v_total_tier_xp := v_tier_xp_cost * v_levels_in_tier;

  IF v_remaining_xp >= v_total_tier_xp THEN
    v_remaining_xp := v_remaining_xp - v_total_tier_xp;
    v_current_level := 30;
  ELSE
    v_current_level := 11 + (v_remaining_xp / v_tier_xp_cost);
    v_remaining_xp := v_remaining_xp % v_tier_xp_cost;
    RETURN QUERY SELECT v_current_level, v_remaining_xp::INTEGER, v_tier_xp_cost;
    RETURN;
  END IF;

  -- Tier 3: Levels 31-50, 800 XP per level
  v_tier_xp_cost := 800;
  v_levels_in_tier := 20;
  v_total_tier_xp := v_tier_xp_cost * v_levels_in_tier;

  IF v_remaining_xp >= v_total_tier_xp THEN
    v_remaining_xp := v_remaining_xp - v_total_tier_xp;
    v_current_level := 50;
  ELSE
    v_current_level := 31 + (v_remaining_xp / v_tier_xp_cost);
    v_remaining_xp := v_remaining_xp % v_tier_xp_cost;
    RETURN QUERY SELECT v_current_level, v_remaining_xp::INTEGER, v_tier_xp_cost;
    RETURN;
  END IF;

  -- Tier 4: Levels 51-75, 2000 XP per level
  v_tier_xp_cost := 2000;
  v_levels_in_tier := 25;
  v_total_tier_xp := v_tier_xp_cost * v_levels_in_tier;

  IF v_remaining_xp >= v_total_tier_xp THEN
    v_remaining_xp := v_remaining_xp - v_total_tier_xp;
    v_current_level := 75;
  ELSE
    v_current_level := 51 + (v_remaining_xp / v_tier_xp_cost);
    v_remaining_xp := v_remaining_xp % v_tier_xp_cost;
    RETURN QUERY SELECT v_current_level, v_remaining_xp::INTEGER, v_tier_xp_cost;
    RETURN;
  END IF;

  -- Tier 5: Levels 76-100, 5000 XP per level
  v_tier_xp_cost := 5000;
  v_current_level := 76 + (v_remaining_xp / v_tier_xp_cost);
  v_current_level := LEAST(v_current_level, 100);
  v_remaining_xp := v_remaining_xp % v_tier_xp_cost;

  RETURN QUERY SELECT v_current_level, v_remaining_xp::INTEGER, v_tier_xp_cost;
END;
$$;

-- Main XP award function with daily cap enforcement
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
BEGIN
  -- Validate inputs
  IF p_xp_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'XP amount must be positive');
  END IF;

  IF p_source NOT IN ('battle', 'post', 'comment', 'training') THEN
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

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', v_xp_to_award,
    'xp_capped', (v_xp_to_award < p_xp_amount),
    'new_total_xp', v_new_total_xp,
    'new_level', v_new_level,
    'previous_level', v_previous_level,
    'level_ups', v_level_ups,
    'xp_in_level', v_new_xp_in_level
  );
END;
$$;

-- Create function to get user progression data
CREATE OR REPLACE FUNCTION get_user_progression(p_user_id UUID)
RETURNS TABLE (
  total_xp BIGINT,
  current_level INTEGER,
  xp_in_current_level INTEGER,
  xp_for_next_level INTEGER,
  progress_percent NUMERIC,
  daily_xp_earned INTEGER,
  daily_xp_remaining INTEGER
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_user RECORD;
  v_next_level_cost INTEGER;
BEGIN
  SELECT
    u.total_xp, u.current_level, u.xp_in_current_level, u.daily_xp_earned
  INTO v_user
  FROM users u WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Determine next level XP cost
  CASE
    WHEN v_user.current_level < 10 THEN v_next_level_cost := 100;
    WHEN v_user.current_level < 30 THEN v_next_level_cost := 300;
    WHEN v_user.current_level < 50 THEN v_next_level_cost := 800;
    WHEN v_user.current_level < 75 THEN v_next_level_cost := 2000;
    WHEN v_user.current_level < 100 THEN v_next_level_cost := 5000;
    ELSE v_next_level_cost := 0;
  END CASE;

  RETURN QUERY SELECT
    v_user.total_xp,
    v_user.current_level,
    v_user.xp_in_current_level,
    v_next_level_cost,
    CASE
      WHEN v_next_level_cost = 0 THEN 100::NUMERIC
      ELSE ROUND((v_user.xp_in_current_level::NUMERIC / v_next_level_cost) * 100, 2)
    END,
    v_user.daily_xp_earned,
    GREATEST(0, 850 - v_user.daily_xp_earned)
  FROM (SELECT 1) AS t;
END;
$$;

-- Backfill existing users with default XP values
UPDATE users
SET
  total_xp = COALESCE(total_xp, 0),
  current_level = COALESCE(current_level, 1),
  xp_in_current_level = COALESCE(xp_in_current_level, 0),
  daily_xp_earned = COALESCE(daily_xp_earned, 0),
  last_xp_reset = COALESCE(last_xp_reset, CURRENT_DATE)
WHERE total_xp IS NULL OR current_level IS NULL;

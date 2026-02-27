-- Battle Pass System Migration
-- Creates tables, functions, and seed data for monthly battle pass with 40 tiers

-- =====================================================
-- TABLES
-- =====================================================

-- Battle Pass Seasons
CREATE TABLE IF NOT EXISTS battle_pass_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  season_number INTEGER NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT false,
  xp_per_tier INTEGER NOT NULL DEFAULT 500,
  total_tiers INTEGER NOT NULL DEFAULT 40,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_season_number UNIQUE (season_number),
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT valid_tiers CHECK (total_tiers > 0 AND total_tiers <= 100)
);

-- Battle Pass Tier Rewards
CREATE TABLE IF NOT EXISTS battle_pass_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  tier_number INTEGER NOT NULL,
  tier_type TEXT NOT NULL CHECK (tier_type IN ('free', 'keeper')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('gold', 'food', 'ticket', 'resource')),
  reward_amount INTEGER NOT NULL DEFAULT 1,
  reward_data JSONB DEFAULT '{}'::jsonb, -- { resource_key, quality_key, icon_name }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_season_tier UNIQUE (season_id, tier_number, tier_type),
  CONSTRAINT valid_tier CHECK (tier_number >= 1 AND tier_number <= 100),
  CONSTRAINT valid_amount CHECK (reward_amount > 0)
);

-- User Battle Pass Progress
CREATE TABLE IF NOT EXISTS user_battle_pass_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_tier INTEGER NOT NULL DEFAULT 0,
  last_daily_login_date DATE,
  has_keeper_pass BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_season UNIQUE (user_id, season_id),
  CONSTRAINT valid_xp CHECK (total_xp >= 0),
  CONSTRAINT valid_tier CHECK (current_tier >= 0)
);

-- User Battle Pass Claimed Rewards
CREATE TABLE IF NOT EXISTS user_battle_pass_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  tier_number INTEGER NOT NULL,
  tier_type TEXT NOT NULL CHECK (tier_type IN ('free', 'keeper')),
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_claimed_reward UNIQUE (user_id, season_id, tier_number, tier_type),
  CONSTRAINT valid_tier_num CHECK (tier_number >= 1)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_battle_pass_seasons_active ON battle_pass_seasons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_battle_pass_tiers_season ON battle_pass_tiers(season_id, tier_number);
CREATE INDEX IF NOT EXISTS idx_user_bp_progress_user ON user_battle_pass_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bp_progress_season ON user_battle_pass_progress(season_id);
CREATE INDEX IF NOT EXISTS idx_user_bp_rewards_user ON user_battle_pass_rewards(user_id, season_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE battle_pass_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_pass_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_battle_pass_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_battle_pass_rewards ENABLE ROW LEVEL SECURITY;

-- Anyone can view seasons and tiers
CREATE POLICY "Anyone can view seasons"
  ON battle_pass_seasons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can view tier rewards"
  ON battle_pass_tiers FOR SELECT
  TO authenticated
  USING (true);

-- Users can view their own progress
CREATE POLICY "Users view own progress"
  ON user_battle_pass_progress FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users view own claimed rewards"
  ON user_battle_pass_rewards FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Service role can manage everything
CREATE POLICY "Service can insert progress"
  ON user_battle_pass_progress FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service can update progress"
  ON user_battle_pass_progress FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Service can insert rewards"
  ON user_battle_pass_rewards FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Get or create user's battle pass progress for active season
CREATE OR REPLACE FUNCTION get_or_create_user_battle_pass_progress(
  p_user_id UUID
)
RETURNS TABLE (
  progress_id UUID,
  season_id UUID,
  season_name TEXT,
  season_end_date TIMESTAMPTZ,
  total_xp INTEGER,
  current_tier INTEGER,
  xp_per_tier INTEGER,
  total_tiers INTEGER,
  has_keeper_pass BOOLEAN,
  last_daily_login_date DATE
) AS $$
DECLARE
  v_season_id UUID;
  v_progress_id UUID;
BEGIN
  -- Get active season
  SELECT s.id INTO v_season_id
  FROM battle_pass_seasons s
  WHERE s.is_active = true
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'No active battle pass season found';
  END IF;

  -- Get or create progress
  INSERT INTO user_battle_pass_progress (user_id, season_id, total_xp, current_tier)
  VALUES (p_user_id, v_season_id, 0, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  -- Return progress data
  RETURN QUERY
  SELECT
    p.id,
    p.season_id,
    s.name,
    s.end_date,
    p.total_xp,
    p.current_tier,
    s.xp_per_tier,
    s.total_tiers,
    p.has_keeper_pass,
    p.last_daily_login_date
  FROM user_battle_pass_progress p
  JOIN battle_pass_seasons s ON s.id = p.season_id
  WHERE p.user_id = p_user_id AND p.season_id = v_season_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award battle pass XP and auto-unlock tiers
CREATE OR REPLACE FUNCTION award_battle_pass_xp(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_source TEXT DEFAULT 'mission'
)
RETURNS JSONB AS $$
DECLARE
  v_season_id UUID;
  v_old_xp INTEGER;
  v_new_xp INTEGER;
  v_old_tier INTEGER;
  v_new_tier INTEGER;
  v_xp_per_tier INTEGER;
  v_total_tiers INTEGER;
  v_unlocked_tiers INTEGER := 0;
BEGIN
  -- Get active season
  SELECT id, xp_per_tier, total_tiers INTO v_season_id, v_xp_per_tier, v_total_tiers
  FROM battle_pass_seasons
  WHERE is_active = true
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active season'
    );
  END IF;

  -- Get or create user progress
  INSERT INTO user_battle_pass_progress (user_id, season_id, total_xp, current_tier)
  VALUES (p_user_id, v_season_id, 0, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  -- Get current progress
  SELECT total_xp, current_tier INTO v_old_xp, v_old_tier
  FROM user_battle_pass_progress
  WHERE user_id = p_user_id AND season_id = v_season_id;

  -- Calculate new XP and tier
  v_new_xp := v_old_xp + p_xp_amount;
  v_new_tier := LEAST(FLOOR(v_new_xp / v_xp_per_tier), v_total_tiers);
  v_unlocked_tiers := v_new_tier - v_old_tier;

  -- Update progress
  UPDATE user_battle_pass_progress
  SET
    total_xp = v_new_xp,
    current_tier = v_new_tier,
    updated_at = NOW()
  WHERE user_id = p_user_id AND season_id = v_season_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_xp', v_old_xp,
    'new_xp', v_new_xp,
    'old_tier', v_old_tier,
    'new_tier', v_new_tier,
    'unlocked_tiers', v_unlocked_tiers,
    'xp_per_tier', v_xp_per_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check and award daily login XP (100 XP once per day)
CREATE OR REPLACE FUNCTION check_and_award_daily_login_xp(
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_season_id UUID;
  v_last_login DATE;
  v_today DATE := CURRENT_DATE;
  v_xp_result JSONB;
BEGIN
  -- Get active season
  SELECT id INTO v_season_id
  FROM battle_pass_seasons
  WHERE is_active = true
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active season'
    );
  END IF;

  -- Get or create progress
  INSERT INTO user_battle_pass_progress (user_id, season_id, total_xp, current_tier)
  VALUES (p_user_id, v_season_id, 0, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  -- Get last login date
  SELECT last_daily_login_date INTO v_last_login
  FROM user_battle_pass_progress
  WHERE user_id = p_user_id AND season_id = v_season_id;

  -- Check if already logged in today
  IF v_last_login = v_today THEN
    RETURN jsonb_build_object(
      'success', false,
      'already_claimed', true,
      'message', 'Daily login XP already claimed today'
    );
  END IF;

  -- Award XP
  SELECT award_battle_pass_xp(p_user_id, 100, 'daily_login') INTO v_xp_result;

  -- Update last login date
  UPDATE user_battle_pass_progress
  SET last_daily_login_date = v_today
  WHERE user_id = p_user_id AND season_id = v_season_id;

  RETURN jsonb_build_object(
    'success', true,
    'xp_awarded', 100,
    'message', 'Daily login XP awarded',
    'xp_result', v_xp_result
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Claim battle pass tier reward
CREATE OR REPLACE FUNCTION claim_battle_pass_reward(
  p_user_id UUID,
  p_tier_number INTEGER,
  p_tier_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_season_id UUID;
  v_current_tier INTEGER;
  v_has_keeper BOOLEAN;
  v_tier_data RECORD;
  v_wallet_id UUID;
BEGIN
  -- Validate tier type
  IF p_tier_type NOT IN ('free', 'keeper') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier type');
  END IF;

  -- Get active season and user progress
  SELECT s.id, p.current_tier, p.has_keeper_pass
  INTO v_season_id, v_current_tier, v_has_keeper
  FROM battle_pass_seasons s
  JOIN user_battle_pass_progress p ON p.season_id = s.id
  WHERE s.is_active = true AND p.user_id = p_user_id
  LIMIT 1;

  IF v_season_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active season or progress found');
  END IF;

  -- Check if tier is unlocked
  IF p_tier_number > v_current_tier THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tier not yet unlocked');
  END IF;

  -- Check keeper access
  IF p_tier_type = 'keeper' AND NOT v_has_keeper THEN
    RETURN jsonb_build_object('success', false, 'error', 'Keeper Pass required');
  END IF;

  -- Check if already claimed
  IF EXISTS (
    SELECT 1 FROM user_battle_pass_rewards
    WHERE user_id = p_user_id
      AND season_id = v_season_id
      AND tier_number = p_tier_number
      AND tier_type = p_tier_type
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward already claimed');
  END IF;

  -- Get tier reward data
  SELECT * INTO v_tier_data
  FROM battle_pass_tiers
  WHERE season_id = v_season_id
    AND tier_number = p_tier_number
    AND tier_type = p_tier_type
  LIMIT 1;

  IF v_tier_data IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tier reward not found');
  END IF;

  -- Grant reward based on type
  IF v_tier_data.reward_type = 'gold' THEN
    -- Get or create wallet
    INSERT INTO user_wallets (user_id, currency_type, gold_coins)
    VALUES (p_user_id, 'gold', 0)
    ON CONFLICT (user_id, currency_type) DO NOTHING;

    -- Add gold
    UPDATE user_wallets
    SET gold_coins = gold_coins + v_tier_data.reward_amount
    WHERE user_id = p_user_id AND currency_type = 'gold';

    -- Log transaction
    INSERT INTO currency_transactions (
      from_user_id, to_user_id, currency_type, amount, transaction_type, metadata
    ) VALUES (
      NULL, p_user_id, 'gold', v_tier_data.reward_amount, 'reward',
      jsonb_build_object('source', 'battle_pass', 'tier', p_tier_number, 'tier_type', p_tier_type)
    );

  ELSIF v_tier_data.reward_type IN ('food', 'ticket', 'resource') THEN
    -- Get resource and quality IDs from reward_data
    DECLARE
      v_resource_id UUID;
      v_quality_id UUID;
    BEGIN
      SELECT id INTO v_resource_id
      FROM resources
      WHERE key = v_tier_data.reward_data->>'resource_key'
      LIMIT 1;

      IF v_tier_data.reward_data ? 'quality_key' THEN
        SELECT id INTO v_quality_id
        FROM resource_qualities
        WHERE key = v_tier_data.reward_data->>'quality_key'
        LIMIT 1;
      END IF;

      IF v_resource_id IS NOT NULL THEN
        -- Add to inventory
        INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity)
        VALUES (p_user_id, v_resource_id, v_quality_id, v_tier_data.reward_amount)
        ON CONFLICT (user_id, resource_id, quality_id)
        DO UPDATE SET quantity = user_inventory.quantity + v_tier_data.reward_amount;
      END IF;
    END;
  END IF;

  -- Mark as claimed
  INSERT INTO user_battle_pass_rewards (user_id, season_id, tier_number, tier_type)
  VALUES (p_user_id, v_season_id, p_tier_number, p_tier_type);

  RETURN jsonb_build_object(
    'success', true,
    'tier_number', p_tier_number,
    'tier_type', p_tier_type,
    'reward_type', v_tier_data.reward_type,
    'reward_amount', v_tier_data.reward_amount,
    'reward_data', v_tier_data.reward_data
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get comprehensive battle pass data for a user
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

  -- Get progress data
  SELECT
    p.*,
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

  -- Get all tiers
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'tier_number', tier_number,
      'tier_type', tier_type,
      'reward_type', reward_type,
      'reward_amount', reward_amount,
      'reward_data', reward_data
    ) ORDER BY tier_number, tier_type
  ) INTO v_tiers
  FROM battle_pass_tiers
  WHERE season_id = v_season_id;

  -- Get claimed rewards
  SELECT jsonb_agg(
    jsonb_build_object(
      'tier_number', tier_number,
      'tier_type', tier_type,
      'claimed_at', claimed_at
    )
  ) INTO v_claimed
  FROM user_battle_pass_rewards
  WHERE user_id = p_user_id AND season_id = v_season_id;

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

-- =====================================================
-- SEED DATA - Season 1 with 40 Tiers
-- =====================================================

-- Create Season 1
INSERT INTO battle_pass_seasons (
  name, season_number, start_date, end_date, is_active, xp_per_tier, total_tiers
) VALUES (
  'Season 1: Golden Dawn',
  1,
  NOW(),
  NOW() + INTERVAL '30 days',
  true,
  500,
  40
) ON CONFLICT (season_number) DO NOTHING;

-- Get Season 1 ID for tier insertion
DO $$
DECLARE
  v_season_id UUID;
  v_food_q1_id UUID;
  v_food_q2_id UUID;
  v_food_q3_id UUID;
  v_ticket_id UUID;
  v_quality_common UUID;
  v_quality_uncommon UUID;
  v_quality_rare UUID;
BEGIN
  SELECT id INTO v_season_id FROM battle_pass_seasons WHERE season_number = 1 LIMIT 1;

  -- Get resource IDs (using food as example, adjust based on your actual resources table)
  SELECT id INTO v_food_q1_id FROM resources WHERE key = 'bread' LIMIT 1;
  SELECT id INTO v_food_q2_id FROM resources WHERE key = 'meat' LIMIT 1;
  SELECT id INTO v_food_q3_id FROM resources WHERE key = 'wine' LIMIT 1;
  SELECT id INTO v_ticket_id FROM resources WHERE key = 'training_ticket' LIMIT 1;

  SELECT id INTO v_quality_common FROM resource_qualities WHERE key = 'common' LIMIT 1;
  SELECT id INTO v_quality_uncommon FROM resource_qualities WHERE key = 'uncommon' LIMIT 1;
  SELECT id INTO v_quality_rare FROM resource_qualities WHERE key = 'rare' LIMIT 1;

  -- Insert 40 tiers of rewards
  -- Format: (season_id, tier_number, tier_type, reward_type, reward_amount, reward_data)

  -- TIERS 1-10: Early rewards
  INSERT INTO battle_pass_tiers (season_id, tier_number, tier_type, reward_type, reward_amount, reward_data) VALUES
  -- Tier 1
  (v_season_id, 1, 'free', 'gold', 100, '{}'::jsonb),
  (v_season_id, 1, 'keeper', 'gold', 250, '{}'::jsonb),
  -- Tier 2
  (v_season_id, 2, 'free', 'food', 2, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 2, 'keeper', 'food', 3, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  -- Tier 3
  (v_season_id, 3, 'free', 'ticket', 1, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 3, 'keeper', 'ticket', 2, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 4
  (v_season_id, 4, 'free', 'food', 2, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 4, 'keeper', 'gold', 300, '{}'::jsonb),
  -- Tier 5
  (v_season_id, 5, 'free', 'gold', 150, '{}'::jsonb),
  (v_season_id, 5, 'keeper', 'food', 3, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 6
  (v_season_id, 6, 'free', 'food', 3, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 6, 'keeper', 'ticket', 3, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 7
  (v_season_id, 7, 'free', 'ticket', 1, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 7, 'keeper', 'gold', 400, '{}'::jsonb),
  -- Tier 8
  (v_season_id, 8, 'free', 'gold', 200, '{}'::jsonb),
  (v_season_id, 8, 'keeper', 'food', 4, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  -- Tier 9
  (v_season_id, 9, 'free', 'food', 2, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 9, 'keeper', 'gold', 500, '{}'::jsonb),
  -- Tier 10
  (v_season_id, 10, 'free', 'gold', 250, '{}'::jsonb),
  (v_season_id, 10, 'keeper', 'food', 5, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine'));

  -- TIERS 11-25: Mid rewards
  INSERT INTO battle_pass_tiers (season_id, tier_number, tier_type, reward_type, reward_amount, reward_data) VALUES
  -- Tier 11
  (v_season_id, 11, 'free', 'ticket', 2, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 11, 'keeper', 'gold', 600, '{}'::jsonb),
  -- Tier 12
  (v_season_id, 12, 'free', 'food', 3, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 12, 'keeper', 'ticket', 3, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 13
  (v_season_id, 13, 'free', 'gold', 300, '{}'::jsonb),
  (v_season_id, 13, 'keeper', 'food', 4, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  -- Tier 14
  (v_season_id, 14, 'free', 'food', 2, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 14, 'keeper', 'gold', 700, '{}'::jsonb),
  -- Tier 15
  (v_season_id, 15, 'free', 'gold', 350, '{}'::jsonb),
  (v_season_id, 15, 'keeper', 'food', 5, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 16
  (v_season_id, 16, 'free', 'ticket', 2, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 16, 'keeper', 'ticket', 4, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 17
  (v_season_id, 17, 'free', 'food', 3, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 17, 'keeper', 'gold', 800, '{}'::jsonb),
  -- Tier 18
  (v_season_id, 18, 'free', 'gold', 400, '{}'::jsonb),
  (v_season_id, 18, 'keeper', 'food', 5, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  -- Tier 19
  (v_season_id, 19, 'free', 'food', 3, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 19, 'keeper', 'gold', 900, '{}'::jsonb),
  -- Tier 20
  (v_season_id, 20, 'free', 'gold', 450, '{}'::jsonb),
  (v_season_id, 20, 'keeper', 'food', 6, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 21
  (v_season_id, 21, 'free', 'ticket', 2, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 21, 'keeper', 'ticket', 5, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 22
  (v_season_id, 22, 'free', 'food', 3, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 22, 'keeper', 'gold', 1000, '{}'::jsonb),
  -- Tier 23
  (v_season_id, 23, 'free', 'gold', 500, '{}'::jsonb),
  (v_season_id, 23, 'keeper', 'food', 6, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  -- Tier 24
  (v_season_id, 24, 'free', 'food', 4, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 24, 'keeper', 'gold', 1100, '{}'::jsonb),
  -- Tier 25
  (v_season_id, 25, 'free', 'gold', 550, '{}'::jsonb),
  (v_season_id, 25, 'keeper', 'food', 7, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine'));

  -- TIERS 26-40: Premium rewards
  INSERT INTO battle_pass_tiers (season_id, tier_number, tier_type, reward_type, reward_amount, reward_data) VALUES
  -- Tier 26
  (v_season_id, 26, 'free', 'ticket', 3, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 26, 'keeper', 'ticket', 6, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 27
  (v_season_id, 27, 'free', 'food', 4, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 27, 'keeper', 'gold', 1200, '{}'::jsonb),
  -- Tier 28
  (v_season_id, 28, 'free', 'gold', 600, '{}'::jsonb),
  (v_season_id, 28, 'keeper', 'food', 7, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 29
  (v_season_id, 29, 'free', 'food', 4, jsonb_build_object('resource_key', 'bread', 'quality_key', 'common', 'icon_name', 'Bread')),
  (v_season_id, 29, 'keeper', 'gold', 1300, '{}'::jsonb),
  -- Tier 30
  (v_season_id, 30, 'free', 'gold', 650, '{}'::jsonb),
  (v_season_id, 30, 'keeper', 'food', 8, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 31
  (v_season_id, 31, 'free', 'ticket', 3, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 31, 'keeper', 'ticket', 7, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 32
  (v_season_id, 32, 'free', 'food', 4, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 32, 'keeper', 'gold', 1400, '{}'::jsonb),
  -- Tier 33
  (v_season_id, 33, 'free', 'gold', 700, '{}'::jsonb),
  (v_season_id, 33, 'keeper', 'food', 8, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 34
  (v_season_id, 34, 'free', 'food', 5, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 34, 'keeper', 'gold', 1500, '{}'::jsonb),
  -- Tier 35
  (v_season_id, 35, 'free', 'gold', 750, '{}'::jsonb),
  (v_season_id, 35, 'keeper', 'food', 9, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 36
  (v_season_id, 36, 'free', 'ticket', 4, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'common', 'icon_name', 'Ticket')),
  (v_season_id, 36, 'keeper', 'ticket', 8, jsonb_build_object('resource_key', 'training_ticket', 'quality_key', 'uncommon', 'icon_name', 'Ticket')),
  -- Tier 37
  (v_season_id, 37, 'free', 'food', 5, jsonb_build_object('resource_key', 'meat', 'quality_key', 'uncommon', 'icon_name', 'Meat')),
  (v_season_id, 37, 'keeper', 'gold', 1600, '{}'::jsonb),
  -- Tier 38
  (v_season_id, 38, 'free', 'gold', 800, '{}'::jsonb),
  (v_season_id, 38, 'keeper', 'food', 10, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  -- Tier 39
  (v_season_id, 39, 'free', 'food', 5, jsonb_build_object('resource_key', 'wine', 'quality_key', 'rare', 'icon_name', 'Wine')),
  (v_season_id, 39, 'keeper', 'gold', 1700, '{}'::jsonb),
  -- Tier 40 - Grand finale
  (v_season_id, 40, 'free', 'gold', 1000, '{}'::jsonb),
  (v_season_id, 40, 'keeper', 'gold', 2500, '{}'::jsonb);

END $$;

-- Verification query (comment out after migration)
-- SELECT
--   'Season' as type, COUNT(*) as count
-- FROM battle_pass_seasons
-- UNION ALL
-- SELECT
--   'Tiers', COUNT(*)
-- FROM battle_pass_tiers;

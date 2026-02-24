-- Psychology System v2.0 Optimization
-- Adds heat-based spam protection, activity tracking, coherence history, and physical power

-- ============================================================================
-- NEW COLUMNS: Heat System & Physical Power
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS action_heat NUMERIC DEFAULT 0;
-- Heat starts at 0, increases by 10 per action, decays 5 per minute
-- When heat > 100, actions are blocked (spam protection)

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_action_timestamp TIMESTAMPTZ;
-- Tracks when last action occurred for heat decay calculation

ALTER TABLE users ADD COLUMN IF NOT EXISTS physical_power NUMERIC DEFAULT 50;
-- Physical Power: 0-150, represents combat effectiveness
-- Formula: PP = BasePower × (1 + Morale/200) × (1 + Coherence/2)

-- ============================================================================
-- NEW TABLE: Coherence History (for Moving Average Mental Power)
-- ============================================================================

CREATE TABLE IF NOT EXISTS coherence_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coherence NUMERIC NOT NULL,
  action_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_coherence_history_user_recent
  ON coherence_history(user_id, created_at DESC);

-- Store last 20 coherence values for moving average calculation
-- This replaces the unbounded Mental Power integral with a bounded moving average

-- ============================================================================
-- NEW TABLE: Action Records (for Activity Score calculation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS action_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_records_user_recent
  ON action_records(user_id, created_at DESC);

-- Store recent actions for diversity calculation
-- Activity Score = (type_diversity + target_diversity) / 2
-- Rewards varied gameplay, punishes spam

-- ============================================================================
-- FUNCTION: Get Recent Mental Power (Moving Average)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_mental_power_moving_average(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_coherence NUMERIC;
  v_mp NUMERIC;
BEGIN
  -- Get average of last 20 coherence values
  SELECT AVG(coherence) INTO v_avg_coherence
  FROM (
    SELECT coherence
    FROM coherence_history
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) AS recent;

  -- If no coherence history, return baseline
  IF v_avg_coherence IS NULL THEN
    RETURN 50;
  END IF;

  -- Convert -1..1 range to 0..100
  -- Formula: MP = 50 + (avg_coherence * 50)
  v_mp := 50 + (v_avg_coherence * 50);

  RETURN GREATEST(0, LEAST(100, ROUND(v_mp)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: Get Activity Score (Diversity-based)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_activity_score(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_action_types INTEGER;
  v_unique_targets INTEGER;
  v_total_actions INTEGER;
  v_type_diversity NUMERIC;
  v_target_diversity NUMERIC;
  v_base_score NUMERIC;
  v_repetition_penalty NUMERIC := 1.0;
  v_last_three_same BOOLEAN;
BEGIN
  -- Get recent action statistics (last 20 actions)
  SELECT
    COUNT(DISTINCT action_type),
    COUNT(DISTINCT target_id),
    COUNT(*)
  INTO v_action_types, v_unique_targets, v_total_actions
  FROM (
    SELECT action_type, target_id
    FROM action_records
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) AS recent;

  -- If no recent actions, full score
  IF v_total_actions = 0 THEN
    RETURN 100;
  END IF;

  -- Type diversity: how many different action types (max 10)
  v_type_diversity := (v_action_types::NUMERIC / 10) * 100;

  -- Target diversity: how many different targets
  v_target_diversity := (v_unique_targets::NUMERIC / v_total_actions) * 100;

  -- Base diversity is average of both
  v_base_score := (v_type_diversity + v_target_diversity) / 2;

  -- Check for spam (same action on same target 3 times)
  SELECT (COUNT(*) = 3 AND COUNT(DISTINCT action_type) = 1 AND COUNT(DISTINCT target_id) = 1)
  INTO v_last_three_same
  FROM (
    SELECT action_type, target_id
    FROM action_records
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 3
  ) AS last_three;

  IF v_last_three_same THEN
    v_repetition_penalty := 0.5; -- 50% penalty for spam
  END IF;

  RETURN GREATEST(0, LEAST(100, ROUND(v_base_score * v_repetition_penalty)));
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Calculate Heat Decay
-- ============================================================================

CREATE OR REPLACE FUNCTION update_heat_decay(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_current_heat NUMERIC;
  v_minutes_elapsed NUMERIC;
  v_decay_amount NUMERIC;
  v_new_heat NUMERIC;
  v_last_action TIMESTAMPTZ;
BEGIN
  -- Get current state
  SELECT action_heat, last_action_timestamp
  INTO v_current_heat, v_last_action
  FROM users
  WHERE id = p_user_id;

  -- If no heat, return 0
  IF v_current_heat IS NULL THEN
    RETURN 0;
  END IF;

  -- If no last action timestamp, return current heat
  IF v_last_action IS NULL THEN
    RETURN v_current_heat;
  END IF;

  -- Calculate minutes elapsed
  v_minutes_elapsed := EXTRACT(EPOCH FROM (NOW() - v_last_action)) / 60;

  -- Heat decays 5 per minute
  v_decay_amount := v_minutes_elapsed * 5;

  -- New heat can't go below 0
  v_new_heat := GREATEST(0, v_current_heat - v_decay_amount);

  RETURN v_new_heat;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Record Action and Update Heat
-- ============================================================================

CREATE OR REPLACE FUNCTION record_action_and_heat(
  p_user_id UUID,
  p_action_type TEXT,
  p_target_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_heat NUMERIC;
  v_decayed_heat NUMERIC;
  v_new_heat NUMERIC;
  v_action_allowed BOOLEAN;
  v_activity_score NUMERIC;
  v_result JSONB;
BEGIN
  -- Get current heat and decay it
  v_decayed_heat := update_heat_decay(p_user_id);

  -- Add 10 heat for this action
  v_new_heat := LEAST(200, v_decayed_heat + 10);

  -- Check if action is allowed (heat <= 100)
  v_action_allowed := v_new_heat <= 100;

  -- If action is allowed, record it
  IF v_action_allowed THEN
    INSERT INTO action_records (user_id, action_type, target_id, created_at)
    VALUES (p_user_id, p_action_type, p_target_id, NOW());

    -- Update user heat and timestamp
    UPDATE users
    SET
      action_heat = v_new_heat,
      last_action_timestamp = NOW()
    WHERE id = p_user_id;
  END IF;

  -- Calculate activity score
  v_activity_score := get_activity_score(p_user_id);

  -- Return result
  v_result := jsonb_build_object(
    'action_allowed', v_action_allowed,
    'current_heat', v_new_heat,
    'activity_score', v_activity_score,
    'message', CASE
      WHEN NOT v_action_allowed THEN 'Action blocked: Too much spam (heat > 100)'
      ELSE 'Action recorded'
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Calculate Physical Power
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_physical_power(
  p_morale NUMERIC,
  p_coherence NUMERIC,
  p_base_power NUMERIC DEFAULT 50
)
RETURNS NUMERIC AS $$
DECLARE
  v_morale_multiplier NUMERIC;
  v_coherence_multiplier NUMERIC;
  v_pp NUMERIC;
BEGIN
  -- Morale multiplier: 1 + (morale/200) = 0.5 to 1.5
  v_morale_multiplier := 1 + (p_morale / 200.0);

  -- Coherence multiplier: 1 + (coherence/2) = 0.5 to 1.5
  v_coherence_multiplier := 1 + (p_coherence / 2.0);

  -- PP = Base × Morale_Mult × Coherence_Mult
  v_pp := p_base_power * v_morale_multiplier * v_coherence_multiplier;

  RETURN GREATEST(0, LEAST(150, ROUND(v_pp)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- CREATE INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_action_heat ON users(action_heat);
CREATE INDEX IF NOT EXISTS idx_users_physical_power ON users(physical_power);
CREATE INDEX IF NOT EXISTS idx_action_records_type ON action_records(action_type);
CREATE INDEX IF NOT EXISTS idx_coherence_history_recent ON coherence_history(user_id DESC, created_at DESC);

-- ============================================================================
-- MIGRATION NOTE
-- ============================================================================

-- This migration introduces:
-- 1. Heat-based spam protection (action_heat, last_action_timestamp)
-- 2. Physical Power metric (physical_power)
-- 3. Coherence history tracking (coherence_history table)
-- 4. Action records for activity score (action_records table)
-- 5. Database functions for all calculations
--
-- Old Mental Power (unbounded integral) is replaced with:
-- - Moving Average Mental Power (50 + avg_coherence × 50)
-- - Reflects recent consistency, stays 0-100
--
-- Old Activity Score (hardcoded 10) is replaced with:
-- - Real Activity Score (type and target diversity)
-- - Rewards varied gameplay, punishes spam
--
-- See: lib/psychology.ts for TypeScript implementation

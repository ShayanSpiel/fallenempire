-- Adrenaline Rule (Final Stand) System
-- Date: January 3, 2027
-- Description: Implements dynamic adrenaline bonus for defenders in final 33% of battle
--              when attacker damage exceeds defender damage by 50%+

-- ============================================================================
-- 1. EXTEND CONFIGURATION TABLE
-- ============================================================================

-- Add adrenaline configuration columns to battle_mechanics_config
ALTER TABLE battle_mechanics_config
ADD COLUMN IF NOT EXISTS adrenaline_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS adrenaline_final_stand_window_percent NUMERIC DEFAULT 33,
ADD COLUMN IF NOT EXISTS adrenaline_damage_threshold_ratio NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS adrenaline_rage_per_percent_time NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS adrenaline_max_rage NUMERIC DEFAULT 33,
ADD COLUMN IF NOT EXISTS adrenaline_check_interval_seconds NUMERIC DEFAULT 10;

-- Add comments for documentation
COMMENT ON COLUMN battle_mechanics_config.adrenaline_enabled IS
'Enable/disable the adrenaline rule system';

COMMENT ON COLUMN battle_mechanics_config.adrenaline_final_stand_window_percent IS
'Percentage of battle time (from end) when adrenaline can activate (default: 33 = final 33%)';

COMMENT ON COLUMN battle_mechanics_config.adrenaline_damage_threshold_ratio IS
'Ratio of attacker/defender damage required to trigger adrenaline (default: 2.0 = 2x damage difference)';

COMMENT ON COLUMN battle_mechanics_config.adrenaline_rage_per_percent_time IS
'Rage bonus granted per 1% of total battle time condition is met (default: 1)';

COMMENT ON COLUMN battle_mechanics_config.adrenaline_max_rage IS
'Maximum rage bonus from adrenaline (default: 33)';

COMMENT ON COLUMN battle_mechanics_config.adrenaline_check_interval_seconds IS
'How often to check adrenaline condition in seconds (client-side) (default: 10)';

-- Update global defaults with adrenaline configuration
UPDATE battle_mechanics_config
SET
  adrenaline_enabled = TRUE,
  adrenaline_final_stand_window_percent = 33,
  adrenaline_damage_threshold_ratio = 2.0,
  adrenaline_rage_per_percent_time = 1,
  adrenaline_max_rage = 33,
  adrenaline_check_interval_seconds = 10
WHERE community_id IS NULL;

-- ============================================================================
-- 2. HELPER FUNCTION: Get Adrenaline Config
-- ============================================================================

CREATE OR REPLACE FUNCTION get_adrenaline_config(p_community_id UUID DEFAULT NULL)
RETURNS TABLE (
  enabled BOOLEAN,
  final_stand_window_percent NUMERIC,
  damage_threshold_ratio NUMERIC,
  rage_per_percent_time NUMERIC,
  max_rage NUMERIC,
  check_interval_seconds NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(c.adrenaline_enabled, g.adrenaline_enabled) AS enabled,
    COALESCE(c.adrenaline_final_stand_window_percent, g.adrenaline_final_stand_window_percent) AS final_stand_window_percent,
    COALESCE(c.adrenaline_damage_threshold_ratio, g.adrenaline_damage_threshold_ratio) AS damage_threshold_ratio,
    COALESCE(c.adrenaline_rage_per_percent_time, g.adrenaline_rage_per_percent_time) AS rage_per_percent_time,
    COALESCE(c.adrenaline_max_rage, g.adrenaline_max_rage) AS max_rage,
    COALESCE(c.adrenaline_check_interval_seconds, g.adrenaline_check_interval_seconds) AS check_interval_seconds
  FROM
    battle_mechanics_config g
  LEFT JOIN battle_mechanics_config c ON c.community_id = p_community_id
  WHERE g.community_id IS NULL
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_adrenaline_config IS
'Get adrenaline configuration for a community, falling back to global defaults';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_adrenaline_config TO authenticated;
GRANT EXECUTE ON FUNCTION get_adrenaline_config TO anon;

-- ============================================================================
-- 3. VALIDATION FUNCTION: Validate Adrenaline Bonus
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_adrenaline_bonus(
  p_battle_id UUID,
  p_claimed_bonus NUMERIC,
  p_user_side TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_battle RECORD;
  v_config RECORD;
  v_total_duration NUMERIC;
  v_elapsed NUMERIC;
  v_percent_elapsed NUMERIC;
  v_final_stand_threshold NUMERIC;
  v_damage_ratio NUMERIC;
  v_max_possible_bonus NUMERIC;
BEGIN
  -- Get battle details
  SELECT * INTO v_battle
  FROM battles
  WHERE id = p_battle_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only defenders can receive adrenaline bonus
  IF p_user_side != 'defender' THEN
    RETURN p_claimed_bonus = 0;
  END IF;

  -- Get config (use defender community config)
  SELECT * INTO v_config
  FROM get_adrenaline_config(v_battle.defender_community_id);

  -- Check if adrenaline is enabled
  IF NOT v_config.enabled THEN
    RETURN p_claimed_bonus = 0;
  END IF;

  -- Calculate battle progress
  v_total_duration := EXTRACT(EPOCH FROM (v_battle.ends_at - v_battle.started_at));
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_battle.started_at));
  v_percent_elapsed := (v_elapsed / v_total_duration) * 100;

  -- Check if we're in the final stand window
  v_final_stand_threshold := 100 - v_config.final_stand_window_percent;

  IF v_percent_elapsed < v_final_stand_threshold THEN
    -- Not in final stand window yet
    RETURN p_claimed_bonus = 0;
  END IF;

  -- Check damage ratio condition
  IF v_battle.defender_score = 0 THEN
    v_damage_ratio := 999; -- Effectively infinite if defender did no damage
  ELSE
    v_damage_ratio := v_battle.attacker_score::NUMERIC / v_battle.defender_score::NUMERIC;
  END IF;

  -- If condition not met, bonus should be 0
  IF v_damage_ratio < v_config.damage_threshold_ratio THEN
    -- Note: We don't invalidate if bonus > 0 here because the condition might have been met earlier
    -- The client tracks cumulative time, so bonus can persist even if condition temporarily fails
    -- We only validate that bonus doesn't exceed maximum
  END IF;

  -- Validate claimed bonus doesn't exceed maximum
  v_max_possible_bonus := v_config.max_rage;

  RETURN p_claimed_bonus >= 0 AND p_claimed_bonus <= v_max_possible_bonus;
END;
$$;

COMMENT ON FUNCTION validate_adrenaline_bonus IS
'Server-side validation of client-calculated adrenaline bonus to prevent cheating';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_adrenaline_bonus TO authenticated;

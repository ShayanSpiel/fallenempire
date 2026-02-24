-- Battle Mechanics System: Functions Migration
-- Version: 1.0
-- Date: December 29, 2025
-- Description: Business logic functions for Focus, Rage, Disarray, Momentum, and Exhaustion

-- ============================================================================
-- 1. DISARRAY FUNCTIONS
-- ============================================================================

-- Calculate current disarray energy cost multiplier
CREATE OR REPLACE FUNCTION get_disarray_multiplier(p_community_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_config RECORD;
  v_state RECORD;
  v_hours_since NUMERIC;
  v_multiplier NUMERIC;
BEGIN
  -- Get config (community-specific or global)
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF NOT v_config.disarray_enabled THEN
    RETURN 1.0;
  END IF;

  -- Get state
  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = p_community_id;

  IF v_state IS NULL OR NOT v_state.disarray_active OR v_state.disarray_started_at IS NULL THEN
    RETURN 1.0;
  END IF;

  -- Calculate hours since disarray started
  v_hours_since := EXTRACT(EPOCH FROM (NOW() - v_state.disarray_started_at)) / 3600;

  -- Check if disarray has expired
  IF v_hours_since >= v_config.disarray_duration_hours THEN
    -- Auto-clear disarray
    UPDATE community_battle_state
    SET disarray_active = FALSE,
        disarray_started_at = NULL,
        updated_at = NOW()
    WHERE community_id = p_community_id;

    RETURN 1.0;
  END IF;

  -- Linear decay: max_multiplier → 1.0 over duration
  v_multiplier := v_config.disarray_max_multiplier -
                  (v_hours_since / v_config.disarray_duration_hours) *
                  (v_config.disarray_max_multiplier - 1.0);

  RETURN GREATEST(1.0, v_multiplier);
END;
$$ LANGUAGE plpgsql;

-- Apply disarray to a community (after battle loss)
CREATE OR REPLACE FUNCTION apply_disarray(p_community_id UUID)
RETURNS VOID AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF NOT v_config.disarray_enabled THEN
    RETURN;
  END IF;

  UPDATE community_battle_state
  SET disarray_active = TRUE,
      disarray_started_at = NOW(),
      updated_at = NOW()
  WHERE community_id = p_community_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. MOMENTUM FUNCTIONS
-- ============================================================================

-- Apply momentum buff to a community (after battle victory)
CREATE OR REPLACE FUNCTION apply_momentum(p_community_id UUID)
RETURNS VOID AS $$
DECLARE
  v_config RECORD;
  v_members UUID[];
  v_member_id UUID;
BEGIN
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF NOT v_config.momentum_enabled THEN
    RETURN;
  END IF;

  -- Update state
  UPDATE community_battle_state
  SET momentum_active = TRUE,
      momentum_expires_at = NOW() + (v_config.momentum_duration_hours || ' hours')::INTERVAL,
      updated_at = NOW()
  WHERE community_id = p_community_id;

  -- Get all active members
  SELECT ARRAY_AGG(user_id) INTO v_members
  FROM community_members
  WHERE community_id = p_community_id AND left_at IS NULL;

  -- Apply morale bonus to all members
  IF v_members IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY v_members LOOP
      -- Using existing morale event system
      INSERT INTO morale_events (user_id, morale_change, event_type, event_trigger, created_at)
      VALUES (v_member_id, v_config.momentum_morale_bonus, 'battle', 'victory_momentum', NOW());

      -- Update user morale
      UPDATE users
      SET morale = LEAST(100, GREATEST(0, morale + v_config.momentum_morale_bonus)),
          updated_at = NOW()
      WHERE id = v_member_id;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Check if momentum is active for a community
CREATE OR REPLACE FUNCTION is_momentum_active(p_community_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_state RECORD;
BEGIN
  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = p_community_id;

  IF v_state IS NULL OR NOT v_state.momentum_active THEN
    RETURN FALSE;
  END IF;

  -- Check if expired
  IF v_state.momentum_expires_at IS NOT NULL AND NOW() >= v_state.momentum_expires_at THEN
    -- Auto-clear momentum
    UPDATE community_battle_state
    SET momentum_active = FALSE,
        momentum_expires_at = NULL,
        updated_at = NOW()
    WHERE community_id = p_community_id;

    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. EXHAUSTION FUNCTIONS
-- ============================================================================

-- Check and update exhaustion status
CREATE OR REPLACE FUNCTION check_exhaustion_status(p_community_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_config RECORD;
  v_state RECORD;
  v_recent_conquests INT;
  v_hours_since_last NUMERIC;
  v_clean_timestamps TIMESTAMPTZ[];
BEGIN
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF NOT v_config.exhaustion_enabled THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = p_community_id;

  -- Check time since last conquest for reset
  IF v_state.last_conquest_at IS NOT NULL THEN
    v_hours_since_last := EXTRACT(EPOCH FROM (NOW() - v_state.last_conquest_at)) / 3600;

    -- Reset if enough time passed
    IF v_hours_since_last >= v_config.exhaustion_reset_hours THEN
      UPDATE community_battle_state
      SET exhaustion_active = FALSE,
          exhaustion_started_at = NULL,
          conquest_timestamps = ARRAY[]::TIMESTAMPTZ[],
          updated_at = NOW()
      WHERE community_id = p_community_id;

      RETURN FALSE;
    END IF;
  END IF;

  -- Clean old timestamps (only keep those within reset window)
  SELECT ARRAY_AGG(ts) INTO v_clean_timestamps
  FROM UNNEST(v_state.conquest_timestamps) AS ts
  WHERE ts > NOW() - (v_config.exhaustion_reset_hours || ' hours')::INTERVAL;

  IF v_clean_timestamps IS NULL THEN
    v_clean_timestamps := ARRAY[]::TIMESTAMPTZ[];
  END IF;

  -- Count recent conquests
  v_recent_conquests := ARRAY_LENGTH(v_clean_timestamps, 1);
  IF v_recent_conquests IS NULL THEN
    v_recent_conquests := 0;
  END IF;

  -- Update cleaned timestamps
  UPDATE community_battle_state
  SET conquest_timestamps = v_clean_timestamps,
      updated_at = NOW()
  WHERE community_id = p_community_id;

  -- Check threshold
  IF v_recent_conquests >= v_config.exhaustion_conquest_threshold THEN
    UPDATE community_battle_state
    SET exhaustion_active = TRUE,
        exhaustion_started_at = COALESCE(exhaustion_started_at, NOW()),
        updated_at = NOW()
    WHERE community_id = p_community_id;

    RETURN TRUE;
  ELSE
    UPDATE community_battle_state
    SET exhaustion_active = FALSE,
        exhaustion_started_at = NULL,
        updated_at = NOW()
    WHERE community_id = p_community_id;

    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Track a conquest for exhaustion calculation
CREATE OR REPLACE FUNCTION track_conquest(p_community_id UUID, p_hex_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  -- Update conquest tracking
  UPDATE community_battle_state
  SET last_conquest_at = NOW(),
      conquest_timestamps = array_append(conquest_timestamps, NOW()),
      total_conquests = total_conquests + 1,
      current_win_streak = current_win_streak + 1,
      updated_at = NOW()
  WHERE community_id = p_community_id;

  -- Check exhaustion status
  PERFORM check_exhaustion_status(p_community_id);
END;
$$ LANGUAGE plpgsql;

-- Get energy regeneration rate for a user
CREATE OR REPLACE FUNCTION get_energy_regen_rate(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_config RECORD;
  v_state RECORD;
  v_community_id UUID;
  v_base_regen NUMERIC;
BEGIN
  -- Get user's community
  SELECT main_community_id INTO v_community_id
  FROM users
  WHERE id = p_user_id;

  IF v_community_id IS NULL THEN
    -- No community, use default regen
    RETURN 10;
  END IF;

  -- Get config
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = v_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  -- Base regen from energy system (10/hour)
  v_base_regen := 10;

  IF NOT v_config.exhaustion_enabled THEN
    RETURN v_base_regen;
  END IF;

  -- Check exhaustion status
  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = v_community_id;

  -- Update exhaustion status
  PERFORM check_exhaustion_status(v_community_id);

  -- Refresh state
  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = v_community_id;

  IF v_state IS NULL OR NOT v_state.exhaustion_active THEN
    RETURN v_base_regen;
  END IF;

  -- Apply exhaustion penalty
  RETURN v_base_regen * v_config.exhaustion_energy_regen_multiplier;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. RAGE FUNCTIONS
-- ============================================================================

-- Add rage to a user
CREATE OR REPLACE FUNCTION add_rage(
  p_user_id UUID,
  p_trigger_type TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  v_config RECORD;
  v_user RECORD;
  v_base_rage NUMERIC;
  v_base_override NUMERIC;
  v_scaling_factor NUMERIC;
  v_rage_gain NUMERIC;
  v_new_rage NUMERIC;
  v_community_id UUID;
BEGIN
  -- Get user's community
  SELECT main_community_id INTO v_community_id
  FROM users
  WHERE id = p_user_id;

  -- Get config
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = v_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF NOT v_config.rage_enabled THEN
    RETURN 0;
  END IF;

  -- Get base rage amount for trigger type (can be overridden via metadata)
  v_base_rage := CASE p_trigger_type
    WHEN 'hex_captured' THEN v_config.rage_trigger_hex_captured
    WHEN 'capital_captured' THEN v_config.rage_trigger_capital_captured
    WHEN 'ally_defeated' THEN v_config.rage_trigger_ally_defeated
    WHEN 'battle_loss' THEN v_config.rage_trigger_battle_loss
    WHEN 'enemy_attacks' THEN v_config.rage_trigger_enemy_attacks
    ELSE 0
  END;

  -- Optional override (numeric, > 0) passed via metadata
  IF p_metadata ? 'base_rage_override' THEN
    IF (p_metadata->>'base_rage_override') ~ '^[0-9]+(\\.[0-9]+)?$' THEN
      v_base_override := (p_metadata->>'base_rage_override')::NUMERIC;
    END IF;
  END IF;

  IF v_base_override IS NOT NULL AND v_base_override > 0 THEN
    v_base_rage := v_base_override;
  END IF;

  IF v_base_rage = 0 THEN
    RETURN 0;
  END IF;

  -- Get user state
  SELECT morale, rage INTO v_user
  FROM users
  WHERE id = p_user_id;

  -- Apply morale scaling if enabled
  IF v_config.rage_morale_scaling_enabled THEN
    v_scaling_factor := 1.0 + ((100 - COALESCE(v_user.morale, 50)) / 100.0);
    v_rage_gain := v_base_rage * v_scaling_factor;
  ELSE
    v_rage_gain := v_base_rage;
  END IF;

  -- Calculate new rage (capped at max)
  v_new_rage := LEAST(v_config.rage_max, COALESCE(v_user.rage, 0) + v_rage_gain);

  -- Update user
  UPDATE users
  SET rage = v_new_rage,
      last_rage_update = NOW(),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Log event
  INSERT INTO rage_events (user_id, rage_change, trigger_type, current_rage, metadata)
  VALUES (p_user_id, v_rage_gain, p_trigger_type, v_new_rage, p_metadata);

  RETURN v_new_rage;
END;
$$ LANGUAGE plpgsql;

-- Decay rage for all users (hourly cron)
CREATE OR REPLACE FUNCTION decay_rage()
RETURNS TABLE(users_updated INT, total_decay NUMERIC) AS $$
DECLARE
  v_updated INT := 0;
  v_total_decay NUMERIC := 0;
  v_user RECORD;
  v_config RECORD;
  v_decay NUMERIC;
BEGIN
  -- Process each user with rage > 0
  FOR v_user IN
    SELECT id, rage, main_community_id
    FROM users
    WHERE rage > 0
  LOOP
    -- Get config for user's community
    SELECT * INTO v_config
    FROM battle_mechanics_config
    WHERE community_id = v_user.main_community_id OR community_id IS NULL
    ORDER BY community_id NULLS LAST
    LIMIT 1;

    IF v_config.rage_enabled THEN
      v_decay := v_config.rage_decay_per_hour;

      -- Decay rage
      UPDATE users
      SET rage = GREATEST(0, rage - v_decay),
          last_rage_update = NOW(),
          updated_at = NOW()
      WHERE id = v_user.id;

      v_updated := v_updated + 1;
      v_total_decay := v_total_decay + v_decay;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_updated, v_total_decay;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. BATTLE RESOLUTION FUNCTIONS
-- ============================================================================

-- Complete battle resolution with all mechanics
CREATE OR REPLACE FUNCTION resolve_battle_with_mechanics(p_battle_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
  v_winner_community_id UUID;
  v_loser_community_id UUID;
  v_winner_members UUID[];
  v_loser_members UUID[];
  v_member_id UUID;
  v_is_capital BOOLEAN := FALSE;
BEGIN
  -- Get battle
  SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('error', 'Battle not found');
  END IF;

  -- Determine outcome
  IF v_battle.current_defense <= 0 THEN
    v_outcome := 'attacker_win';
    v_winner_community_id := v_battle.attacker_community_id;
    v_loser_community_id := v_battle.defender_community_id;
  ELSIF NOW() >= v_battle.ends_at THEN
    v_outcome := 'defender_win';
    v_winner_community_id := v_battle.defender_community_id;
    v_loser_community_id := v_battle.attacker_community_id;
  ELSE
    RETURN jsonb_build_object('status', 'ongoing');
  END IF;

  -- Get all members of both communities
  SELECT ARRAY_AGG(user_id) INTO v_winner_members
  FROM community_members
  WHERE community_id = v_winner_community_id AND left_at IS NULL;

  SELECT ARRAY_AGG(user_id) INTO v_loser_members
  FROM community_members
  WHERE community_id = v_loser_community_id AND left_at IS NULL;

  -- Check if this is a capital hex
  -- TODO: Add capital hex detection logic when capital system is implemented
  -- For now, assume non-capital
  v_is_capital := FALSE;

  -- ========================================
  -- WINNER EFFECTS
  -- ========================================

  -- Apply momentum
  PERFORM apply_momentum(v_winner_community_id);

  -- Track conquest
  IF v_outcome = 'attacker_win' THEN
    PERFORM track_conquest(v_winner_community_id, v_battle.hex_id);
  END IF;

  -- Update win streak
  UPDATE community_battle_state
  SET current_win_streak = current_win_streak + 1,
      updated_at = NOW()
  WHERE community_id = v_winner_community_id;

  -- ========================================
  -- LOSER EFFECTS
  -- ========================================

  -- Apply disarray
  PERFORM apply_disarray(v_loser_community_id);

  -- Reset win streak
  UPDATE community_battle_state
  SET current_win_streak = 0,
      updated_at = NOW()
  WHERE community_id = v_loser_community_id;

  -- Apply defeat morale to all loser members
  IF v_loser_members IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY v_loser_members LOOP
      -- Defeat morale penalty
      INSERT INTO morale_events (user_id, morale_change, event_type, event_trigger, created_at)
      VALUES (v_member_id, -10, 'battle', 'defeat', NOW());

      UPDATE users
      SET morale = GREATEST(0, morale - 10),
          updated_at = NOW()
      WHERE id = v_member_id;

      -- Trigger rage accumulation
      IF v_is_capital THEN
        PERFORM add_rage(v_member_id, 'capital_captured', jsonb_build_object('battle_id', p_battle_id));
      ELSE
        PERFORM add_rage(v_member_id, 'hex_captured', jsonb_build_object('battle_id', p_battle_id));
      END IF;

      -- Battle loss rage
      PERFORM add_rage(v_member_id, 'battle_loss', jsonb_build_object('battle_id', p_battle_id));
    END LOOP;
  END IF;

  -- Update battle status
  UPDATE battles
  SET status = v_outcome,
      resolved_at = NOW(),
      updated_at = NOW()
  WHERE id = p_battle_id;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'winner', v_winner_community_id,
    'loser', v_loser_community_id,
    'battle_id', p_battle_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Get complete battle mechanics state for a community
CREATE OR REPLACE FUNCTION get_battle_mechanics_state(p_community_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_config RECORD;
  v_state RECORD;
  v_disarray_multiplier NUMERIC;
  v_momentum_active BOOLEAN;
  v_exhaustion_active BOOLEAN;
BEGIN
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = p_community_id;

  v_disarray_multiplier := get_disarray_multiplier(p_community_id);
  v_momentum_active := is_momentum_active(p_community_id);
  v_exhaustion_active := check_exhaustion_status(p_community_id);

  RETURN jsonb_build_object(
    'config', row_to_json(v_config),
    'state', row_to_json(v_state),
    'disarray_multiplier', v_disarray_multiplier,
    'momentum_active', v_momentum_active,
    'exhaustion_active', v_exhaustion_active
  );
END;
$$ LANGUAGE plpgsql;

-- Get user's complete battle stats
CREATE OR REPLACE FUNCTION get_user_battle_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user RECORD;
  v_community_id UUID;
  v_disarray_multiplier NUMERIC;
  v_energy_regen_rate NUMERIC;
  v_stats RECORD;
BEGIN
  SELECT id, morale, rage, energy, main_community_id
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  v_community_id := v_user.main_community_id;

  IF v_community_id IS NOT NULL THEN
    v_disarray_multiplier := get_disarray_multiplier(v_community_id);
    v_energy_regen_rate := get_energy_regen_rate(p_user_id);
  ELSE
    v_disarray_multiplier := 1.0;
    v_energy_regen_rate := 10;
  END IF;

  -- Get combat stats from action log
  SELECT
    COUNT(*) as total_actions,
    SUM(CASE WHEN hit THEN 1 ELSE 0 END) as total_hits,
    SUM(CASE WHEN NOT hit THEN 1 ELSE 0 END) as total_misses,
    SUM(CASE WHEN critical THEN 1 ELSE 0 END) as total_crits,
    ROUND(AVG(CASE WHEN hit THEN 1.0 ELSE 0.0 END) * 100, 1) as hit_rate_pct,
    ROUND(AVG(CASE WHEN critical THEN 1.0 ELSE 0.0 END) * 100, 1) as crit_rate_pct,
    SUM(damage_dealt) as total_damage
  INTO v_stats
  FROM battle_action_log
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'morale', v_user.morale,
    'rage', v_user.rage,
    'energy', v_user.energy,
    'focus', v_user.morale,
    'disarray_multiplier', v_disarray_multiplier,
    'energy_cost_per_fight', 10 * v_disarray_multiplier,
    'energy_regen_rate', v_energy_regen_rate,
    'combat_stats', row_to_json(v_stats)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION get_disarray_multiplier IS 'Calculate current energy cost multiplier (1.0-3.0) based on disarray state';
COMMENT ON FUNCTION apply_disarray IS 'Apply disarray state to community after battle loss';
COMMENT ON FUNCTION apply_momentum IS 'Apply momentum buff (+15 morale for 12h) to community after victory';
COMMENT ON FUNCTION is_momentum_active IS 'Check if community currently has active momentum buff';
COMMENT ON FUNCTION check_exhaustion_status IS 'Check and update exhaustion based on recent conquests';
COMMENT ON FUNCTION track_conquest IS 'Track a conquest and check for exhaustion trigger';
COMMENT ON FUNCTION get_energy_regen_rate IS 'Get energy regen rate for user (10/h or 5/h if exhausted)';
COMMENT ON FUNCTION add_rage IS 'Add rage to user with morale scaling';
COMMENT ON FUNCTION decay_rage IS 'Decay rage for all users (hourly cron)';
COMMENT ON FUNCTION resolve_battle_with_mechanics IS 'Complete battle resolution with momentum, disarray, rage, exhaustion';
COMMENT ON FUNCTION get_battle_mechanics_state IS 'Get complete battle mechanics state for a community (for UI)';
COMMENT ON FUNCTION get_user_battle_stats IS 'Get user battle stats including focus, rage, disarray, energy regen (for UI)';

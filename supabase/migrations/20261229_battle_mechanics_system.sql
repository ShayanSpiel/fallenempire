-- Battle Mechanics System Implementation
-- Based on BATTLE_STRATEGY.md v1.0

-- ========================================
-- Configuration Table
-- ========================================

CREATE TABLE IF NOT EXISTS battle_mechanics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID UNIQUE REFERENCES communities(id),

  -- Focus System
  focus_enabled BOOLEAN DEFAULT TRUE,
  focus_morale_ratio NUMERIC DEFAULT 1.0,

  -- Rage System
  rage_enabled BOOLEAN DEFAULT TRUE,
  rage_crit_multiplier NUMERIC DEFAULT 3.0,
  rage_max NUMERIC DEFAULT 100,
  rage_decay_per_hour NUMERIC DEFAULT 5,
  rage_morale_scaling_enabled BOOLEAN DEFAULT TRUE,

  -- Rage Event Triggers
  rage_trigger_hex_captured NUMERIC DEFAULT 10,
  rage_trigger_capital_captured NUMERIC DEFAULT 20,
  rage_trigger_ally_defeated NUMERIC DEFAULT 15,
  rage_trigger_battle_loss NUMERIC DEFAULT 10,
  rage_trigger_enemy_attacks NUMERIC DEFAULT 5,

  -- Momentum System
  momentum_enabled BOOLEAN DEFAULT TRUE,
  momentum_morale_bonus NUMERIC DEFAULT 15,
  momentum_duration_hours NUMERIC DEFAULT 12,

  -- Disarray System
  disarray_enabled BOOLEAN DEFAULT TRUE,
  disarray_max_multiplier NUMERIC DEFAULT 3.0,
  disarray_duration_hours NUMERIC DEFAULT 12,

  -- Exhaustion System
  exhaustion_enabled BOOLEAN DEFAULT TRUE,
  exhaustion_conquest_threshold NUMERIC DEFAULT 2,
  exhaustion_energy_regen_multiplier NUMERIC DEFAULT 0.5,
  exhaustion_reset_hours NUMERIC DEFAULT 12,

  -- Battle Timing
  battle_duration_hours NUMERIC DEFAULT 6,
  base_energy_cost NUMERIC DEFAULT 10,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global defaults (community_id = NULL means global)
INSERT INTO battle_mechanics_config (community_id)
VALUES (NULL)
ON CONFLICT (community_id) DO NOTHING;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_battle_mechanics_config_community
ON battle_mechanics_config(community_id);

-- ========================================
-- Community Battle State Table
-- ========================================

CREATE TABLE IF NOT EXISTS community_battle_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID UNIQUE REFERENCES communities(id) ON DELETE CASCADE,

  -- Disarray tracking
  disarray_active BOOLEAN DEFAULT FALSE,
  disarray_started_at TIMESTAMPTZ,

  -- Momentum tracking
  momentum_active BOOLEAN DEFAULT FALSE,
  momentum_expires_at TIMESTAMPTZ,

  -- Exhaustion tracking
  exhaustion_active BOOLEAN DEFAULT FALSE,
  exhaustion_started_at TIMESTAMPTZ,
  last_conquest_at TIMESTAMPTZ,
  conquest_timestamps TIMESTAMPTZ[] DEFAULT ARRAY[]::TIMESTAMPTZ[],

  -- Statistics
  total_conquests BIGINT DEFAULT 0,
  current_win_streak INT DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create state on community creation
CREATE OR REPLACE FUNCTION create_battle_state_on_community()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_battle_state (community_id)
  VALUES (NEW.id)
  ON CONFLICT (community_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_battle_state ON communities;
CREATE TRIGGER trigger_create_battle_state
AFTER INSERT ON communities
FOR EACH ROW
EXECUTE FUNCTION create_battle_state_on_community();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_community_battle_state_community
ON community_battle_state(community_id);

-- ========================================
-- Rage Events Table
-- ========================================

CREATE TABLE IF NOT EXISTS rage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  rage_change NUMERIC NOT NULL,
  trigger_type TEXT NOT NULL,
  current_rage NUMERIC,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rage_events_user_time
ON rage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rage_events_trigger
ON rage_events(trigger_type);

-- ========================================
-- Battle Action Log Table
-- ========================================

CREATE TABLE IF NOT EXISTS battle_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT DEFAULT 'FIGHT',

  -- Combat resolution
  hit BOOLEAN NOT NULL,
  critical BOOLEAN DEFAULT FALSE,
  damage_dealt NUMERIC DEFAULT 0,

  -- State at time of action
  user_morale NUMERIC,
  user_rage NUMERIC,
  user_energy NUMERIC,
  energy_cost NUMERIC,
  disarray_multiplier NUMERIC,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_battle_action_log_battle
ON battle_action_log(battle_id, created_at);

CREATE INDEX IF NOT EXISTS idx_battle_action_log_user
ON battle_action_log(user_id, created_at DESC);

-- ========================================
-- User Modifications
-- ========================================

-- Add rage column to users if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS rage NUMERIC DEFAULT 0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_rage_update TIMESTAMPTZ DEFAULT NOW();

-- Add constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_rage_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_rage_check CHECK (rage >= 0 AND rage <= 100);
  END IF;
END $$;

-- ========================================
-- Helper Functions
-- ========================================

-- Get disarray multiplier for a community
CREATE OR REPLACE FUNCTION get_disarray_multiplier(p_community_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_config RECORD;
  v_state RECORD;
  v_hours_since NUMERIC;
  v_multiplier NUMERIC;
BEGIN
  -- Get config
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = p_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF v_config IS NULL OR NOT v_config.disarray_enabled THEN
    RETURN 1.0;
  END IF;

  -- Get state
  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = p_community_id;

  IF v_state IS NULL OR NOT v_state.disarray_active OR v_state.disarray_started_at IS NULL THEN
    RETURN 1.0;
  END IF;

  v_hours_since := EXTRACT(EPOCH FROM (NOW() - v_state.disarray_started_at)) / 3600;

  IF v_hours_since >= v_config.disarray_duration_hours THEN
    -- Auto-clear expired disarray
    UPDATE community_battle_state
    SET disarray_active = FALSE, disarray_started_at = NULL
    WHERE community_id = p_community_id;
    RETURN 1.0;
  END IF;

  -- Linear decay: 3.0 → 1.0 over 12 hours
  v_multiplier := v_config.disarray_max_multiplier -
                  (v_hours_since / v_config.disarray_duration_hours) *
                  (v_config.disarray_max_multiplier - 1.0);

  RETURN GREATEST(1.0, v_multiplier);
END;
$$ LANGUAGE plpgsql;

-- Battle Mechanics System: Schema Migration
-- Version: 1.0
-- Date: December 29, 2025
-- Description: Implements Focus, Rage, Disarray, Momentum, and Exhaustion mechanics

-- ============================================================================
-- 1. CONFIGURATION TABLE (Zero Hardcoding)
-- ============================================================================

CREATE TABLE IF NOT EXISTS battle_mechanics_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID UNIQUE REFERENCES communities(id) ON DELETE CASCADE,

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

-- Global defaults (community_id = NULL)
INSERT INTO battle_mechanics_config (community_id)
VALUES (NULL)
ON CONFLICT (community_id) DO NOTHING;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_battle_mechanics_config_community
ON battle_mechanics_config(community_id);

-- ============================================================================
-- 2. COMMUNITY BATTLE STATE TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_battle_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Create state for existing communities
INSERT INTO community_battle_state (community_id)
SELECT id FROM communities
WHERE id NOT IN (SELECT community_id FROM community_battle_state WHERE community_id IS NOT NULL)
ON CONFLICT (community_id) DO NOTHING;

-- Auto-create on community creation
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

CREATE INDEX IF NOT EXISTS idx_community_battle_state_disarray
ON community_battle_state(community_id, disarray_active)
WHERE disarray_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_community_battle_state_momentum
ON community_battle_state(community_id, momentum_active)
WHERE momentum_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_community_battle_state_exhaustion
ON community_battle_state(community_id, exhaustion_active)
WHERE exhaustion_active = TRUE;

-- ============================================================================
-- 3. RAGE EVENTS AUDIT TRAIL
-- ============================================================================

CREATE TABLE IF NOT EXISTS rage_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- ============================================================================
-- 4. BATTLE ACTION LOG (Hit/Miss/Crit Tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS battle_action_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Statistics view
CREATE OR REPLACE VIEW battle_stats_summary AS
SELECT
  battle_id,
  COUNT(*) as total_actions,
  SUM(CASE WHEN hit THEN 1 ELSE 0 END) as total_hits,
  SUM(CASE WHEN NOT hit THEN 1 ELSE 0 END) as total_misses,
  SUM(CASE WHEN critical THEN 1 ELSE 0 END) as total_crits,
  ROUND(AVG(CASE WHEN hit THEN 1.0 ELSE 0.0 END) * 100, 1) as hit_rate_pct,
  ROUND(AVG(CASE WHEN critical THEN 1.0 ELSE 0.0 END) * 100, 1) as crit_rate_pct,
  SUM(damage_dealt) as total_damage,
  AVG(user_morale) as avg_morale,
  AVG(user_rage) as avg_rage
FROM battle_action_log
GROUP BY battle_id;

-- ============================================================================
-- 5. USER MODIFICATIONS
-- ============================================================================

-- Add rage column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'rage'
  ) THEN
    ALTER TABLE users ADD COLUMN rage NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_rage_update'
  ) THEN
    ALTER TABLE users ADD COLUMN last_rage_update TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Add rage constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_rage_check'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT users_rage_check CHECK (rage >= 0 AND rage <= 100);
  END IF;
END $$;

-- ============================================================================
-- 6. BATTLE MODIFICATIONS
-- ============================================================================

-- Modify default battle duration to 6 hours
ALTER TABLE battles
ALTER COLUMN ends_at SET DEFAULT (NOW() + INTERVAL '6 hours');

-- Add battle statistics columns if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battles' AND column_name = 'total_hits'
  ) THEN
    ALTER TABLE battles ADD COLUMN total_hits BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battles' AND column_name = 'total_misses'
  ) THEN
    ALTER TABLE battles ADD COLUMN total_misses BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battles' AND column_name = 'total_crits'
  ) THEN
    ALTER TABLE battles ADD COLUMN total_crits BIGINT DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- 7. HELPER FUNCTIONS FOR STATS
-- ============================================================================

-- Get user's battle mechanics config
CREATE OR REPLACE FUNCTION get_user_battle_config(p_user_id UUID)
RETURNS battle_mechanics_config AS $$
DECLARE
  v_config battle_mechanics_config;
BEGIN
  SELECT c.* INTO v_config
  FROM users u
  LEFT JOIN battle_mechanics_config c
    ON c.community_id = u.main_community_id
  WHERE u.id = p_user_id
  ORDER BY c.community_id NULLS LAST
  LIMIT 1;

  -- Return global config if no community-specific config found
  IF v_config IS NULL THEN
    SELECT * INTO v_config
    FROM battle_mechanics_config
    WHERE community_id IS NULL;
  END IF;

  RETURN v_config;
END;
$$ LANGUAGE plpgsql;

-- Get community's battle state
CREATE OR REPLACE FUNCTION get_community_battle_state(p_community_id UUID)
RETURNS community_battle_state AS $$
DECLARE
  v_state community_battle_state;
BEGIN
  SELECT * INTO v_state
  FROM community_battle_state
  WHERE community_id = p_community_id;

  -- Create if doesn't exist
  IF v_state IS NULL THEN
    INSERT INTO community_battle_state (community_id)
    VALUES (p_community_id)
    RETURNING * INTO v_state;
  END IF;

  RETURN v_state;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. CLEANUP AND COMMENTS
-- ============================================================================

COMMENT ON TABLE battle_mechanics_config IS 'Configurable parameters for battle mechanics (zero hardcoding)';
COMMENT ON TABLE community_battle_state IS 'Tracks momentum, disarray, and exhaustion states per community';
COMMENT ON TABLE rage_events IS 'Audit trail for rage accumulation events';
COMMENT ON TABLE battle_action_log IS 'Detailed log of every FIGHT action with hit/miss/crit results';

COMMENT ON COLUMN battle_mechanics_config.community_id IS 'NULL = global defaults, UUID = community-specific override';
COMMENT ON COLUMN battle_mechanics_config.rage_crit_multiplier IS 'Critical hit damage multiplier (default 3.0 = 3x damage)';
COMMENT ON COLUMN battle_mechanics_config.disarray_max_multiplier IS 'Maximum energy cost multiplier after loss (default 3.0 = 3x cost)';
COMMENT ON COLUMN battle_mechanics_config.exhaustion_energy_regen_multiplier IS 'Energy regen multiplier when exhausted (default 0.5 = half speed)';

COMMENT ON COLUMN community_battle_state.conquest_timestamps IS 'Array of recent conquest timestamps for exhaustion tracking';
COMMENT ON COLUMN community_battle_state.disarray_started_at IS 'When disarray began (for linear decay calculation)';
COMMENT ON COLUMN community_battle_state.momentum_expires_at IS 'When momentum buff expires';

COMMENT ON COLUMN rage_events.trigger_type IS 'Event type: hex_captured, capital_captured, ally_defeated, battle_loss, enemy_attacks';
COMMENT ON COLUMN rage_events.metadata IS 'Additional context (battle_id, enemy_id, ally_id, etc.)';

COMMENT ON COLUMN battle_action_log.disarray_multiplier IS 'Energy cost multiplier at time of action (1.0-3.0)';
COMMENT ON COLUMN battle_action_log.hit IS 'Whether attack hit (passed focus check)';
COMMENT ON COLUMN battle_action_log.critical IS 'Whether attack was critical (passed rage check)';

-- Fix Simulation Control RPC Functions
-- CRITICAL: All UPDATE statements were missing WHERE clauses
-- This caused "UPDATE requires a WHERE clause" errors

-- RPC: Log token usage
CREATE OR REPLACE FUNCTION log_token_usage(p_tokens INT, p_cost NUMERIC DEFAULT 0)
RETURNS VOID AS $$
BEGIN
  UPDATE simulation_control
  SET
    tokens_used_today = tokens_used_today + p_tokens,
    tokens_used_month = tokens_used_month + p_tokens,
    updated_at = NOW()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- RPC: Pause simulation until specific time
CREATE OR REPLACE FUNCTION pause_simulation(p_until TIMESTAMPTZ)
RETURNS VOID AS $$
BEGIN
  UPDATE simulation_control
  SET paused_until = p_until, updated_at = NOW()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- RPC: Resume simulation
CREATE OR REPLACE FUNCTION resume_simulation()
RETURNS VOID AS $$
BEGIN
  UPDATE simulation_control
  SET paused_until = NULL, updated_at = NOW()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- RPC: Enable/disable simulation
CREATE OR REPLACE FUNCTION set_simulation_active(p_active BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE simulation_control
  SET is_active = p_active, updated_at = NOW()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- RPC: Reset daily token counter (called at midnight)
CREATE OR REPLACE FUNCTION reset_daily_tokens()
RETURNS VOID AS $$
BEGIN
  UPDATE simulation_control
  SET tokens_used_today = 0, updated_at = NOW()
  WHERE id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

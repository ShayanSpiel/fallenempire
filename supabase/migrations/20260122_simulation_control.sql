-- Simulation Control Table
-- Master controls for all agent simulations

CREATE TABLE IF NOT EXISTS simulation_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT true,
  batch_size INT DEFAULT 8 CHECK (batch_size >= 1 AND batch_size <= 50),
  max_concurrent INT DEFAULT 5 CHECK (max_concurrent >= 1 AND max_concurrent <= 20),
  global_token_budget INT DEFAULT 1000000 CHECK (global_token_budget >= 0),
  tokens_used_today INT DEFAULT 0,
  tokens_used_month INT DEFAULT 0,
  cost_limit NUMERIC DEFAULT 100 CHECK (cost_limit >= 0),
  paused_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default record if none exists
INSERT INTO simulation_control (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

-- Updated trigger
CREATE OR REPLACE TRIGGER update_simulation_control_timestamp
BEFORE UPDATE ON simulation_control
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RPC: Check if simulation is currently running
CREATE OR REPLACE FUNCTION is_simulation_active()
RETURNS BOOLEAN AS $$
DECLARE
  v_active BOOLEAN;
  v_paused_until TIMESTAMPTZ;
BEGIN
  SELECT is_active, paused_until INTO v_active, v_paused_until
  FROM simulation_control
  LIMIT 1;

  IF NOT v_active THEN
    RETURN false;
  END IF;

  IF v_paused_until IS NOT NULL AND v_paused_until > NOW() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- RPC: Check if token budget allows more processing
CREATE OR REPLACE FUNCTION has_token_budget()
RETURNS BOOLEAN AS $$
DECLARE
  v_budget_remaining INT;
BEGIN
  SELECT (global_token_budget - tokens_used_month) INTO v_budget_remaining
  FROM simulation_control
  LIMIT 1;

  RETURN v_budget_remaining > 10000; -- At least 10k tokens remaining
END;
$$ LANGUAGE plpgsql;

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

-- RPC: Get simulation stats
CREATE OR REPLACE FUNCTION get_simulation_stats()
RETURNS TABLE(
  is_active BOOLEAN,
  batch_size INT,
  max_concurrent INT,
  tokens_used_today INT,
  tokens_used_month INT,
  cost_limit NUMERIC,
  paused_until TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.is_active,
    sc.batch_size,
    sc.max_concurrent,
    sc.tokens_used_today,
    sc.tokens_used_month,
    sc.cost_limit,
    sc.paused_until
  FROM simulation_control sc
  LIMIT 1;
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

-- RLS Policies
ALTER TABLE simulation_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "only_admins_can_view_simulation_control"
ON simulation_control FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "only_admins_can_update_simulation_control"
ON simulation_control FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

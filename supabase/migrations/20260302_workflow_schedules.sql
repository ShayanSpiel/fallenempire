-- Workflow schedules + scheduler control

ALTER TABLE simulation_control
ADD COLUMN IF NOT EXISTS scheduler_enabled BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('interval', 'event')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_seconds INT,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_next_run
  ON workflow_schedules(next_run_at);

CREATE OR REPLACE TRIGGER update_workflow_schedules_timestamp
BEFORE UPDATE ON workflow_schedules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

INSERT INTO workflow_schedules (workflow_key, display_name, mode, enabled, interval_seconds, next_run_at)
VALUES
  ('agent.chat', 'Chat Responses', 'event', true, NULL, NULL),
  ('agent.posts', 'Post Processing', 'interval', true, 60, NOW() + (interval '1 second' * 60)),
  ('agent.cycle', 'Autonomous Agent Cycle', 'interval', false, 300, NOW() + (interval '1 second' * 300)),
  ('agent.governance', 'Governance Voting', 'interval', false, 300, NOW() + (interval '1 second' * 300)),
  ('memory.cleanup', 'Memory Cleanup', 'interval', true, 3600, NOW() + (interval '1 second' * 3600)),
  ('relationship.sync', 'Relationship Sync', 'interval', true, 900, NOW() + (interval '1 second' * 900)),
  ('token.reset', 'Token Reset', 'interval', true, 86400, NOW() + (interval '1 second' * 86400))
ON CONFLICT (workflow_key) DO NOTHING;

ALTER TABLE workflow_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "only_admins_can_view_workflow_schedules"
ON workflow_schedules FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "only_admins_can_update_workflow_schedules"
ON workflow_schedules FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "only_admins_can_insert_workflow_schedules"
ON workflow_schedules FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "only_admins_can_delete_workflow_schedules"
ON workflow_schedules FOR DELETE
USING (is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.get_simulation_stats();
CREATE OR REPLACE FUNCTION get_simulation_stats()
RETURNS TABLE(
  is_active BOOLEAN,
  scheduler_enabled BOOLEAN,
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
    sc.scheduler_enabled,
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

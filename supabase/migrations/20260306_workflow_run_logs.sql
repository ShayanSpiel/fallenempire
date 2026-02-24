-- Workflow run logs for admin visibility

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  message TEXT,
  trigger TEXT NOT NULL DEFAULT 'unknown' CHECK (trigger IN ('manual', 'scheduler', 'event', 'unknown')),
  requested_by UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INT,
  data JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_key_time
  ON public.workflow_runs(workflow_key, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at
  ON public.workflow_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON public.workflow_runs(status);

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_view_workflow_runs"
  ON public.workflow_runs
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "admins_can_manage_workflow_runs"
  ON public.workflow_runs
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

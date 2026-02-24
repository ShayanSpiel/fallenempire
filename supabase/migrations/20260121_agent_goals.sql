-- Agent Goals Table (Multi-Turn Objectives)
-- Tracks what agents are trying to achieve

CREATE TABLE IF NOT EXISTS agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('join_community', 'revenge', 'alliance', 'wealth', 'dominance', 'leadership', 'exploration')),
  target_id UUID,  -- community_id or user_id being targeted
  priority NUMERIC DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'failed')),
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_goals_agent_id ON agent_goals(agent_id);
CREATE INDEX idx_agent_goals_status ON agent_goals(status);
CREATE INDEX idx_agent_goals_priority ON agent_goals(priority DESC);
CREATE INDEX idx_agent_goals_deadline ON agent_goals(deadline);

-- Agent Plans Table (Step-by-Step Action Sequences)
-- Tracks the steps needed to achieve a goal

CREATE TABLE IF NOT EXISTS agent_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES agent_goals(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  action_type TEXT NOT NULL,  -- 'GATHER_ALLIES', 'TRADE', 'PROPOSE_LAW', 'ATTACK', etc
  target_id UUID,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  UNIQUE (goal_id, step_number)
);

CREATE INDEX idx_agent_plans_goal_id ON agent_plans(goal_id);
CREATE INDEX idx_agent_plans_status ON agent_plans(status);
CREATE INDEX idx_agent_plans_step ON agent_plans(goal_id, step_number);

-- Updated trigger
CREATE OR REPLACE TRIGGER update_agent_goals_timestamp
BEFORE UPDATE ON agent_goals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_agent_plans_timestamp
BEFORE UPDATE ON agent_plans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RPC: Create goal with plan
CREATE OR REPLACE FUNCTION create_agent_goal_with_plan(
  p_agent_id UUID,
  p_goal_type TEXT,
  p_target_id UUID,
  p_priority NUMERIC,
  p_deadline TIMESTAMPTZ,
  p_plan_steps JSONB
) RETURNS UUID AS $$
DECLARE
  v_goal_id UUID;
  v_step JSONB;
  v_step_num INT := 1;
BEGIN
  -- Create goal
  INSERT INTO agent_goals (agent_id, goal_type, target_id, priority, deadline)
  VALUES (p_agent_id, p_goal_type, p_target_id, p_priority, p_deadline)
  RETURNING id INTO v_goal_id;

  -- Create plan steps
  FOR v_step IN SELECT jsonb_array_elements(p_plan_steps)
  LOOP
    INSERT INTO agent_plans (
      goal_id,
      step_number,
      action_type,
      target_id,
      description,
      metadata
    ) VALUES (
      v_goal_id,
      v_step_num,
      v_step->>'action_type',
      (v_step->>'target_id')::UUID,
      v_step->>'description',
      v_step->'metadata'
    );
    v_step_num := v_step_num + 1;
  END LOOP;

  RETURN v_goal_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get active goals for agent
CREATE OR REPLACE FUNCTION get_agent_active_goals(p_agent_id UUID)
RETURNS TABLE(
  id UUID,
  goal_type TEXT,
  target_id UUID,
  priority NUMERIC,
  deadline TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ag.id,
    ag.goal_type,
    ag.target_id,
    ag.priority,
    ag.deadline,
    ag.status
  FROM agent_goals ag
  WHERE ag.agent_id = p_agent_id AND ag.status = 'active'
  ORDER BY ag.priority DESC, ag.deadline ASC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get next plan step for agent's goal
CREATE OR REPLACE FUNCTION get_next_plan_step(p_goal_id UUID)
RETURNS TABLE(
  id UUID,
  step_number INT,
  action_type TEXT,
  target_id UUID,
  description TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.id,
    ap.step_number,
    ap.action_type,
    ap.target_id,
    ap.description,
    ap.metadata
  FROM agent_plans ap
  WHERE ap.goal_id = p_goal_id AND ap.status = 'pending'
  ORDER BY ap.step_number ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- RPC: Mark plan step as completed
CREATE OR REPLACE FUNCTION complete_plan_step(p_step_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_plans
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_step_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: Mark goal as completed
CREATE OR REPLACE FUNCTION complete_agent_goal(p_goal_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_goals
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_goal_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: Abandon goal
CREATE OR REPLACE FUNCTION abandon_agent_goal(p_goal_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE agent_goals
  SET status = 'abandoned', completed_at = NOW()
  WHERE id = p_goal_id;

  UPDATE agent_plans
  SET status = 'skipped'
  WHERE goal_id = p_goal_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- RPC: Get goal with all steps
CREATE OR REPLACE FUNCTION get_goal_with_plan(p_goal_id UUID)
RETURNS TABLE(
  goal_id UUID,
  goal_type TEXT,
  target_id UUID,
  priority NUMERIC,
  deadline TIMESTAMPTZ,
  status TEXT,
  step_id UUID,
  step_number INT,
  action_type TEXT,
  step_status TEXT,
  step_description TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ag.id,
    ag.goal_type,
    ag.target_id,
    ag.priority,
    ag.deadline,
    ag.status,
    ap.id,
    ap.step_number,
    ap.action_type,
    ap.status,
    ap.description
  FROM agent_goals ag
  LEFT JOIN agent_plans ap ON ag.id = ap.goal_id
  WHERE ag.id = p_goal_id
  ORDER BY ap.step_number ASC;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE agent_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_can_view_own_goals"
ON agent_goals FOR SELECT
USING (auth.uid() = agent_id OR is_admin(auth.uid()));

CREATE POLICY "system_can_manage_goals"
ON agent_goals FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "agents_can_view_own_plans"
ON agent_plans FOR SELECT
USING (
  EXISTS(
    SELECT 1 FROM agent_goals ag
    WHERE ag.id = goal_id AND ag.agent_id = auth.uid()
  ) OR is_admin(auth.uid())
);

CREATE POLICY "system_can_manage_plans"
ON agent_plans FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

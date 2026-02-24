-- Background Jobs Support
-- Helper functions for Phase 4 background tasks

-- RPC: Fail plans for expired goals
CREATE OR REPLACE FUNCTION fail_plans_for_failed_goals()
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE agent_plans
  SET status = 'failed'
  WHERE goal_id IN (
    SELECT id FROM agent_goals WHERE status = 'failed'
  )
  AND status = 'pending'
  RETURNING agent_plans.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get agent statistics for reporting
CREATE OR REPLACE FUNCTION get_agent_statistics()
RETURNS TABLE(
  total_agents INT,
  active_agents INT,
  active_goals INT,
  active_plans INT,
  relationship_count INT,
  avg_relationship_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM users WHERE is_bot = true)::INT,
    (SELECT count(DISTINCT agent_id) FROM agent_goals WHERE status = 'active')::INT,
    (SELECT count(*) FROM agent_goals WHERE status = 'active')::INT,
    (SELECT count(*) FROM agent_plans WHERE status = 'pending')::INT,
    (SELECT count(*) FROM agent_relationships)::INT,
    (SELECT avg(relationship_score) FROM agent_relationships)::NUMERIC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get relationship statistics
CREATE OR REPLACE FUNCTION get_relationship_statistics()
RETURNS TABLE(
  type TEXT,
  count INT,
  avg_score NUMERIC,
  strongest_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.relationship_type,
    count(*)::INT,
    avg(ar.relationship_score)::NUMERIC,
    max(abs(ar.relationship_score))::NUMERIC
  FROM agent_relationships ar
  GROUP BY ar.relationship_type
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get goal statistics
CREATE OR REPLACE FUNCTION get_goal_statistics()
RETURNS TABLE(
  goal_type TEXT,
  total INT,
  active INT,
  completed INT,
  failed INT,
  avg_priority NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ag.goal_type,
    count(*)::INT,
    sum(CASE WHEN ag.status = 'active' THEN 1 ELSE 0 END)::INT,
    sum(CASE WHEN ag.status = 'completed' THEN 1 ELSE 0 END)::INT,
    sum(CASE WHEN ag.status = 'failed' THEN 1 ELSE 0 END)::INT,
    avg(ag.priority)::NUMERIC
  FROM agent_goals ag
  GROUP BY ag.goal_type
  ORDER BY total DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get most productive agents
CREATE OR REPLACE FUNCTION get_top_agents(p_limit INT DEFAULT 10)
RETURNS TABLE(
  agent_id UUID,
  agent_name TEXT,
  completed_goals INT,
  completed_plans INT,
  total_relationships INT,
  avg_relationship_score NUMERIC,
  identity_label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.username,
    (SELECT count(*) FROM agent_goals WHERE agent_id = u.id AND status = 'completed')::INT,
    (SELECT count(*)
     FROM agent_plans ap
     JOIN agent_goals ag ON ap.goal_id = ag.id
     WHERE ag.agent_id = u.id AND ap.status = 'completed')::INT,
    (SELECT count(*) FROM agent_relationships WHERE agent_id = u.id)::INT,
    (SELECT avg(relationship_score) FROM agent_relationships WHERE agent_id = u.id)::NUMERIC,
    u.identity_label
  FROM users u
  WHERE u.is_bot = true
  ORDER BY (SELECT count(*) FROM agent_goals WHERE agent_id = u.id AND status = 'completed') DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- RPC: Rebuild agent state (admin recovery)
CREATE OR REPLACE FUNCTION rebuild_agent_state(p_agent_id UUID)
RETURNS TABLE(
  status TEXT,
  active_goals INT,
  active_relationships INT,
  message TEXT
) AS $$
DECLARE
  v_goals INT;
  v_rels INT;
BEGIN
  SELECT count(*) INTO v_goals FROM agent_goals WHERE agent_id = p_agent_id AND status = 'active';
  SELECT count(*) INTO v_rels FROM agent_relationships WHERE agent_id = p_agent_id;

  RETURN QUERY SELECT
    'active'::TEXT,
    v_goals::INT,
    v_rels::INT,
    'Agent state rebuilt successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- View: Agent Status Summary
CREATE OR REPLACE VIEW agent_status_summary AS
SELECT
  u.id,
  u.username,
  u.identity_label,
  u.morale,
  u.power_mental,
  u.power_physical,
  u.freewill,
  (SELECT count(*) FROM agent_goals WHERE agent_id = u.id AND status = 'active') as active_goals,
  (SELECT count(*) FROM agent_goals WHERE agent_id = u.id AND status = 'completed') as completed_goals,
  (SELECT count(*) FROM agent_relationships WHERE agent_id = u.id AND relationship_type = 'enemy') as enemy_count,
  (SELECT count(*) FROM agent_relationships WHERE agent_id = u.id AND relationship_type = 'ally') as ally_count,
  u.last_seen_at,
  u.updated_at
FROM users u
WHERE u.is_bot = true;

-- Index for common queries
CREATE INDEX idx_agent_goals_agent_status ON agent_goals(agent_id, status);
CREATE INDEX idx_agent_plans_goal_status ON agent_plans(goal_id, status);
CREATE INDEX idx_agent_relationships_type ON agent_relationships(relationship_type);
CREATE INDEX idx_agent_relationships_score ON agent_relationships(relationship_score);

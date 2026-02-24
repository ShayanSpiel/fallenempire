-- Agent Relationships Table (Persistent "Beef" Tracking)
-- Tracks relationship state between agents across time

CREATE TABLE IF NOT EXISTS agent_relationships (
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'neutral' CHECK (relationship_type IN ('enemy', 'cautious', 'neutral', 'ally')),
  relationship_score NUMERIC DEFAULT 0 CHECK (relationship_score >= -100 AND relationship_score <= 100),
  last_interaction_at TIMESTAMPTZ,
  interaction_count INT DEFAULT 0,
  recent_actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  PRIMARY KEY (agent_id, target_id),
  CONSTRAINT no_self_relationship CHECK (agent_id != target_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_agent_relationships_agent_id ON agent_relationships(agent_id);
CREATE INDEX idx_agent_relationships_target_id ON agent_relationships(target_id);
CREATE INDEX idx_agent_relationships_score ON agent_relationships(relationship_score DESC);

-- Updated trigger
CREATE OR REPLACE TRIGGER update_agent_relationships_timestamp
BEFORE UPDATE ON agent_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RPC: Get or create relationship
CREATE OR REPLACE FUNCTION get_or_create_relationship(
  p_agent_id UUID,
  p_target_id UUID
) RETURNS agent_relationships AS $$
BEGIN
  RETURN (
    SELECT * FROM agent_relationships
    WHERE agent_id = p_agent_id AND target_id = p_target_id
  );

  IF NOT FOUND THEN
    INSERT INTO agent_relationships (agent_id, target_id)
    VALUES (p_agent_id, p_target_id)
    RETURNING * INTO agent_relationships;
    RETURN agent_relationships;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- RPC: Update relationship after interaction
CREATE OR REPLACE FUNCTION update_relationship_after_action(
  p_agent_id UUID,
  p_target_id UUID,
  p_action TEXT,
  p_score_delta NUMERIC
) RETURNS agent_relationships AS $$
DECLARE
  v_new_score NUMERIC;
  v_new_type TEXT;
BEGIN
  -- Get or create relationship
  INSERT INTO agent_relationships (agent_id, target_id)
  VALUES (p_agent_id, p_target_id)
  ON CONFLICT (agent_id, target_id) DO NOTHING;

  -- Calculate new score (clamp to [-100, 100])
  v_new_score := LEAST(100, GREATEST(-100,
    COALESCE((SELECT relationship_score FROM agent_relationships
      WHERE agent_id = p_agent_id AND target_id = p_target_id), 0) + p_score_delta
  ));

  -- Determine type based on score
  v_new_type := CASE
    WHEN v_new_score <= -40 THEN 'enemy'
    WHEN v_new_score <= -1 THEN 'cautious'
    WHEN v_new_score <= 39 THEN 'neutral'
    ELSE 'ally'
  END;

  -- Update relationship
  UPDATE agent_relationships
  SET
    relationship_score = v_new_score,
    relationship_type = v_new_type,
    last_interaction_at = NOW(),
    interaction_count = interaction_count + 1,
    recent_actions = jsonb_build_array(
      jsonb_build_object(
        'action', p_action,
        'when', NOW(),
        'score_delta', p_score_delta
      )
    ) || CASE
      WHEN jsonb_array_length(recent_actions) >= 5
      THEN recent_actions -> 0 TO 3  -- Keep last 4, add new
      ELSE recent_actions
    END,
    updated_at = NOW()
  WHERE agent_id = p_agent_id AND target_id = p_target_id
  RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get all relationships for an agent
CREATE OR REPLACE FUNCTION get_agent_relationships(p_agent_id UUID)
RETURNS TABLE(
  target_id UUID,
  relationship_type TEXT,
  relationship_score NUMERIC,
  last_interaction_at TIMESTAMPTZ,
  interaction_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.target_id,
    ar.relationship_type,
    ar.relationship_score,
    ar.last_interaction_at,
    ar.interaction_count
  FROM agent_relationships ar
  WHERE ar.agent_id = p_agent_id
  ORDER BY ar.relationship_score DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Decay old relationships (reduce score over time)
CREATE OR REPLACE FUNCTION decay_agent_relationships(
  p_agent_id UUID,
  p_days_old INT DEFAULT 30
) RETURNS INT AS $$
DECLARE
  v_count INT := 0;
BEGIN
  UPDATE agent_relationships
  SET
    relationship_score = CASE
      WHEN relationship_score > 0 THEN relationship_score * 0.95
      WHEN relationship_score < 0 THEN relationship_score * 0.95
      ELSE 0
    END,
    relationship_type = CASE
      WHEN relationship_score <= -40 THEN 'enemy'
      WHEN relationship_score <= -1 THEN 'cautious'
      WHEN relationship_score <= 39 THEN 'neutral'
      ELSE 'ally'
    END,
    updated_at = NOW()
  WHERE
    agent_id = p_agent_id
    AND last_interaction_at < NOW() - (p_days_old || ' days')::INTERVAL
  RETURNING agent_relationships.*;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get relationship between two agents
CREATE OR REPLACE FUNCTION get_relationship(
  p_agent_id UUID,
  p_target_id UUID
) RETURNS TABLE(
  relationship_type TEXT,
  relationship_score NUMERIC,
  last_interaction_at TIMESTAMPTZ,
  interaction_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.relationship_type,
    ar.relationship_score,
    ar.last_interaction_at,
    ar.interaction_count
  FROM agent_relationships ar
  WHERE ar.agent_id = p_agent_id AND ar.target_id = p_target_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE agent_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_can_view_own_relationships"
ON agent_relationships FOR SELECT
USING (auth.uid() = agent_id OR is_admin(auth.uid()));

CREATE POLICY "system_can_update_relationships"
ON agent_relationships FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "system_can_insert_relationships"
ON agent_relationships FOR INSERT
WITH CHECK (is_admin(auth.uid()));

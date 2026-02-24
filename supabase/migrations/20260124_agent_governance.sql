-- Agent Governance System (Phase 5)
-- Allows agents to propose laws, vote, and form factions

-- Agent Factions Table
CREATE TABLE IF NOT EXISTS agent_factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ideology JSONB DEFAULT '{}'::jsonb,
  power NUMERIC DEFAULT 10 CHECK (power >= 0),
  member_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(community_id, name)
);

CREATE INDEX idx_agent_factions_community ON agent_factions(community_id);
CREATE INDEX idx_agent_factions_leader ON agent_factions(leader_id);

-- Faction Members Table
CREATE TABLE IF NOT EXISTS faction_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id UUID NOT NULL REFERENCES agent_factions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(faction_id, member_id)
);

CREATE INDEX idx_faction_members_faction ON faction_members(faction_id);
CREATE INDEX idx_faction_members_member ON faction_members(member_id);

-- Updated trigger
CREATE OR REPLACE TRIGGER update_agent_factions_timestamp
BEFORE UPDATE ON agent_factions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- RPC: Get factions in community
CREATE OR REPLACE FUNCTION get_community_factions(p_community_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  leader_id UUID,
  ideology JSONB,
  power NUMERIC,
  member_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    af.id,
    af.name,
    af.leader_id,
    af.ideology,
    af.power,
    af.member_count
  FROM agent_factions af
  WHERE af.community_id = p_community_id
  ORDER BY af.power DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get agent's faction
CREATE OR REPLACE FUNCTION get_agent_faction(p_agent_id UUID)
RETURNS TABLE(
  faction_id UUID,
  faction_name TEXT,
  leader_id UUID,
  power NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    af.id,
    af.name,
    af.leader_id,
    af.power
  FROM faction_members fm
  JOIN agent_factions af ON fm.faction_id = af.id
  WHERE fm.member_id = p_agent_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- RPC: Add faction member and update count
CREATE OR REPLACE FUNCTION join_faction(p_faction_id UUID, p_member_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_inserted BOOLEAN;
BEGIN
  INSERT INTO faction_members (faction_id, member_id)
  VALUES (p_faction_id, p_member_id)
  ON CONFLICT (faction_id, member_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    RETURN false;
  END IF;

  -- Update member count
  UPDATE agent_factions
  SET member_count = (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id)
  WHERE id = p_faction_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- RPC: Update faction power
CREATE OR REPLACE FUNCTION update_faction_power(p_faction_id UUID, p_delta NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_new_power NUMERIC;
BEGIN
  UPDATE agent_factions
  SET power = GREATEST(0, power + p_delta), updated_at = NOW()
  WHERE id = p_faction_id
  RETURNING power INTO v_new_power;

  RETURN v_new_power;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get active proposals for community
CREATE OR REPLACE FUNCTION get_community_proposals(p_community_id UUID)
RETURNS TABLE(
  id UUID,
  proposer_id UUID,
  law_type TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.proposer_id,
    cp.law_type,
    cp.status,
    cp.expires_at,
    cp.metadata
  FROM community_proposals cp
  WHERE cp.community_id = p_community_id
  AND cp.status IN ('pending', 'passed')
  ORDER BY cp.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- RPC: Get proposal vote count
CREATE OR REPLACE FUNCTION get_proposal_vote_count(p_proposal_id UUID)
RETURNS TABLE(
  total_votes INT,
  yes_votes INT,
  no_votes INT,
  pass_threshold NUMERIC
) AS $$
DECLARE
  v_total INT;
  v_yes INT;
  v_no INT;
  v_pass NUMERIC := 0.5;
BEGIN
  SELECT count(*) INTO v_total FROM proposal_votes WHERE proposal_id = p_proposal_id;
  SELECT count(*) INTO v_yes FROM proposal_votes WHERE proposal_id = p_proposal_id AND vote = 'yes';
  SELECT count(*) INTO v_no FROM proposal_votes WHERE proposal_id = p_proposal_id AND vote = 'no';

  RETURN QUERY SELECT v_total, v_yes, v_no, v_pass;
END;
$$ LANGUAGE plpgsql;

-- RPC: Check if proposal passed
CREATE OR REPLACE FUNCTION check_proposal_passed(p_proposal_id UUID, p_threshold NUMERIC DEFAULT 0.5)
RETURNS BOOLEAN AS $$
DECLARE
  v_total INT;
  v_yes INT;
  v_result BOOLEAN;
BEGIN
  SELECT count(*) INTO v_total FROM proposal_votes WHERE proposal_id = p_proposal_id;
  SELECT count(*) INTO v_yes FROM proposal_votes WHERE proposal_id = p_proposal_id AND vote = 'yes';

  IF v_total = 0 THEN
    RETURN false;
  END IF;

  v_result := (v_yes::NUMERIC / v_total) >= p_threshold;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- RPC: Resolve proposal (update status)
CREATE OR REPLACE FUNCTION resolve_proposal(p_proposal_id UUID, p_passed BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE community_proposals
  SET
    status = CASE WHEN p_passed THEN 'passed' ELSE 'rejected' END,
    resolved_at = NOW()
  WHERE id = p_proposal_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE agent_factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE faction_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_factions"
ON agent_factions FOR SELECT
USING (true);

CREATE POLICY "faction_leaders_can_update"
ON agent_factions FOR UPDATE
USING (auth.uid() = leader_id OR is_admin(auth.uid()))
WITH CHECK (auth.uid() = leader_id OR is_admin(auth.uid()));

CREATE POLICY "anyone_can_view_faction_members"
ON faction_members FOR SELECT
USING (true);

CREATE POLICY "agents_can_join_factions"
ON faction_members FOR INSERT
WITH CHECK (auth.uid() = member_id OR is_admin(auth.uid()));

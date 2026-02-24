-- Morale System: Universal satisfaction tracking for humans + AI agents
-- Tracks morale (0-100), enables rebellion mechanics, supports action triggers

-- Add morale columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS morale NUMERIC DEFAULT 50 NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_morale_update TIMESTAMPTZ DEFAULT NOW();

-- Add constraint (cannot use IF NOT EXISTS with constraints, so wrap in DO block)
DO $$ BEGIN
  BEGIN
    ALTER TABLE users ADD CONSTRAINT morale_range CHECK (morale >= 0 AND morale <= 100);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Create morale_events table (audit trail)
CREATE TABLE IF NOT EXISTS morale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_trigger TEXT,
  morale_change NUMERIC NOT NULL,
  new_morale NUMERIC NOT NULL,
  source_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  source_community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create action_definitions table (scalable registry)
CREATE TABLE IF NOT EXISTS action_definitions (
  action_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  morale_impact NUMERIC DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create admin_actions table (audit logging)
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  target_entity_type TEXT,
  target_entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable vector extension for memory system
CREATE EXTENSION IF NOT EXISTS vector;

-- Create agent_memories table (vector memory)
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  type TEXT CHECK (type IN ('observation', 'action', 'reflection', 'conversation')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create post_processing_queue table (worker queue)
CREATE TABLE IF NOT EXISTS post_processing_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_morale_events_user_created ON morale_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_morale_events_type ON morale_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_morale_rebellion ON users(morale) WHERE morale < 20;
CREATE INDEX IF NOT EXISTS idx_admin_actions_time ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user ON agent_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_queue_agent ON post_processing_queue(user_id, created_at);

-- RPC: Record morale event
CREATE OR REPLACE FUNCTION record_morale_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_trigger TEXT,
  p_morale_change NUMERIC,
  p_source_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_morale NUMERIC;
  v_event_id UUID;
BEGIN
  -- Get current morale
  SELECT morale INTO v_new_morale FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;

  -- Clamp to 0-100
  v_new_morale := GREATEST(0, LEAST(100, v_new_morale + p_morale_change));

  -- Update user morale
  UPDATE users SET morale = v_new_morale, last_morale_update = NOW() WHERE id = p_user_id;

  -- Log event
  INSERT INTO morale_events(user_id, event_type, event_trigger, morale_change, new_morale, source_user_id, metadata)
  VALUES(p_user_id, p_event_type, p_event_trigger, p_morale_change, v_new_morale, p_source_user_id, p_metadata)
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_morale', v_new_morale,
    'morale_change', p_morale_change,
    'rebellion_triggered', v_new_morale < 20,
    'event_id', v_event_id
  );
END;
$$;

-- RPC: Apply battle morale
CREATE OR REPLACE FUNCTION apply_battle_morale(
  p_winner_id UUID,
  p_loser_id UUID,
  p_battle_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_winner JSONB; v_loser JSONB;
BEGIN
  v_winner := record_morale_event(p_winner_id, 'battle_victory', 'combat', 5, p_loser_id, jsonb_build_object('battle_id', p_battle_id::TEXT));
  v_loser := record_morale_event(p_loser_id, 'battle_defeat', 'combat', -10, p_winner_id, jsonb_build_object('battle_id', p_battle_id::TEXT));
  RETURN jsonb_build_object('success', true, 'winner_morale', v_winner, 'loser_morale', v_loser);
END;
$$;

-- RPC: Community morale cascade
CREATE OR REPLACE FUNCTION apply_community_morale_cascade(
  p_community_id UUID,
  p_event_type TEXT,
  p_morale_change NUMERIC,
  p_source_user_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER := 0; v_member RECORD;
BEGIN
  FOR v_member IN SELECT user_id FROM community_members WHERE community_id = p_community_id AND left_at IS NULL LOOP
    PERFORM record_morale_event(v_member.user_id, p_event_type, 'cascade', p_morale_change, p_source_user_id, jsonb_build_object('community_id', p_community_id::TEXT));
    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'affected_users', v_count);
END;
$$;

-- RPC: Update agent stats with morale
DROP FUNCTION IF EXISTS update_agent_stats CASCADE;
CREATE OR REPLACE FUNCTION update_agent_stats(
  p_user_id UUID,
  p_mp_delta NUMERIC,
  p_fw_delta NUMERIC,
  p_morale_delta NUMERIC DEFAULT 0,
  p_morale_event_type TEXT DEFAULT NULL,
  p_morale_trigger TEXT DEFAULT NULL,
  p_log_message TEXT DEFAULT NULL,
  p_log_source TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE users SET
    power_mental = LEAST(100, GREATEST(0, power_mental + p_mp_delta)),
    freewill = LEAST(100, GREATEST(0, freewill + p_fw_delta)),
    last_seen_at = NOW()
  WHERE id = p_user_id;

  IF p_log_message IS NOT NULL THEN
    INSERT INTO game_logs(user_id, message, source, created_at) VALUES(p_user_id, p_log_message, p_log_source, NOW());
  END IF;

  IF p_morale_delta != 0 AND p_morale_event_type IS NOT NULL THEN
    PERFORM record_morale_event(p_user_id, p_morale_event_type, COALESCE(p_morale_trigger, 'action'), p_morale_delta);
  END IF;

  RETURN jsonb_build_object('success', true, 'mp_delta', p_mp_delta, 'fw_delta', p_fw_delta, 'morale_delta', p_morale_delta);
END;
$$;

-- RPC: Check rebellion status
CREATE OR REPLACE FUNCTION is_in_rebellion(p_user_id UUID) RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
BEGIN RETURN (SELECT morale < 20 FROM users WHERE id = p_user_id); END;
$$;

-- RPC: Get chaos probability for rebellion
CREATE OR REPLACE FUNCTION get_rebellion_chaos_chance(p_morale NUMERIC) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_morale >= 20 THEN RETURN 0; END IF;
  RETURN ((20 - GREATEST(0, p_morale)) / 20.0) * 100;
END;
$$;

-- RPC: Get morale multiplier for psychology
CREATE OR REPLACE FUNCTION get_morale_multiplier(p_morale NUMERIC) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN RETURN 0.5 + (GREATEST(0, LEAST(100, COALESCE(p_morale, 50))) / 100.0); END;
$$;

-- Seed action definitions
INSERT INTO action_definitions (action_key, display_name, morale_impact) VALUES
  ('ATTACK', 'Attack', -5),
  ('TRADE', 'Trade', 5),
  ('LIKE', 'Like', 2),
  ('DISLIKE', 'Dislike', -2),
  ('FOLLOW', 'Follow', 3),
  ('COMMENT', 'Comment', 1),
  ('CREATE_POST', 'Create Post', 4)
ON CONFLICT (action_key) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT ON morale_events TO anon, authenticated;
GRANT SELECT, INSERT ON action_definitions TO anon, authenticated;
GRANT SELECT, INSERT ON admin_actions TO authenticated;
GRANT SELECT, INSERT ON agent_memories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON post_processing_queue TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_morale_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_battle_morale TO anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_community_morale_cascade TO authenticated;
GRANT EXECUTE ON FUNCTION update_agent_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_in_rebellion TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_rebellion_chaos_chance TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_morale_multiplier TO anon, authenticated;

-- Set morale for existing users
UPDATE users SET morale = 50, last_morale_update = NOW() WHERE morale IS NULL;

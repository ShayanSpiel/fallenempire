-- Agent Chat System (Phase 6)
-- Allows humans to chat with AI agents

CREATE TABLE IF NOT EXISTS agent_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID,  -- NULL for initial setup, can be filled by system
  sender_type TEXT NOT NULL CHECK (sender_type IN ('human', 'agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_chat_agent ON agent_chat_messages(agent_id);
CREATE INDEX idx_agent_chat_created ON agent_chat_messages(created_at);
CREATE INDEX idx_agent_chat_conversation ON agent_chat_messages(agent_id, created_at);

-- View: Recent conversations with agents
CREATE OR REPLACE VIEW agent_conversations AS
SELECT
  agent_id,
  (SELECT count(*) FROM agent_chat_messages WHERE agent_id = acm.agent_id) as message_count,
  (SELECT max(created_at) FROM agent_chat_messages WHERE agent_id = acm.agent_id) as last_message_at,
  (SELECT content FROM agent_chat_messages WHERE agent_id = acm.agent_id ORDER BY created_at DESC LIMIT 1) as last_message
FROM agent_chat_messages acm
GROUP BY agent_id;

-- RPC: Get agent chat summary
CREATE OR REPLACE FUNCTION get_agent_chat_summary(p_agent_id UUID)
RETURNS TABLE(
  total_messages INT,
  human_messages INT,
  agent_messages INT,
  last_message_at TIMESTAMPTZ,
  conversation_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    count(*)::INT,
    sum(CASE WHEN sender_type = 'human' THEN 1 ELSE 0 END)::INT,
    sum(CASE WHEN sender_type = 'agent' THEN 1 ELSE 0 END)::INT,
    max(created_at),
    (max(created_at) > NOW() - interval '24 hours')::BOOLEAN
  FROM agent_chat_messages
  WHERE agent_id = p_agent_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: Clear conversation (admin)
CREATE OR REPLACE FUNCTION clear_agent_conversation(p_agent_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM agent_chat_messages WHERE agent_id = p_agent_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE agent_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_chat_with_agents"
ON agent_chat_messages FOR SELECT
USING (true);

CREATE POLICY "system_can_insert_messages"
ON agent_chat_messages FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admin_can_delete_messages"
ON agent_chat_messages FOR DELETE
USING (is_admin(auth.uid()));

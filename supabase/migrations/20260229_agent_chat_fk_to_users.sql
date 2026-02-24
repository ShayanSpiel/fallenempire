-- Update agent_chat_messages FK to reference public.users so AI bots match runtime state

ALTER TABLE agent_chat_messages
DROP CONSTRAINT IF EXISTS agent_chat_messages_agent_id_fkey;

ALTER TABLE agent_chat_messages
ADD CONSTRAINT agent_chat_messages_agent_id_fkey
  FOREIGN KEY (agent_id)
  REFERENCES users(id)
  ON DELETE CASCADE;

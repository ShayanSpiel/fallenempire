-- Ensure agent memories importance column accommodates decimals without heavy maintenance work

ALTER TABLE agent_memories
ADD COLUMN IF NOT EXISTS importance_numeric NUMERIC DEFAULT 0.5;

UPDATE agent_memories
SET importance_numeric = importance::NUMERIC
WHERE importance IS NOT NULL;

ALTER TABLE agent_memories
DROP COLUMN importance;

ALTER TABLE agent_memories
RENAME COLUMN importance_numeric TO importance;

ALTER TABLE agent_memories
ALTER COLUMN importance SET NOT NULL;

ALTER TABLE agent_memories
ALTER COLUMN importance SET DEFAULT 0.5;

ALTER TABLE agent_memories
ALTER COLUMN last_accessed_at SET DEFAULT NOW();

ALTER TABLE agent_memories
ALTER COLUMN access_count SET DEFAULT 0;

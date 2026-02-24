-- Align agent memory schema with vector store expectations
-- and keep agent chat FK anchored to auth.users.

ALTER TABLE agent_memories
ADD COLUMN IF NOT EXISTS importance NUMERIC DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS access_count INT DEFAULT 0 CHECK (access_count >= 0);

-- Agent chat messages already reference public.users(id); FK change not needed

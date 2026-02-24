-- Add is_bot column to users table for distinguishing AI agents from humans

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false NOT NULL;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_users_is_bot ON public.users(is_bot) WHERE is_bot = true;

-- Mark all existing AI agents as bots (those with names like 'ai_' prefix or with high power_mental but low freewill)
-- For now, we'll leave all users as human (false) and update manually or through admin panel
-- In future, we could use heuristics like: UPDATE users SET is_bot = true WHERE power_mental > 80 AND freewill < 30;

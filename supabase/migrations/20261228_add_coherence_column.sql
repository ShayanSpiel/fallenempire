-- Add coherence column to users table
-- This tracks the current coherence score (alignment between identity and actions)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS coherence NUMERIC DEFAULT 50 NOT NULL CHECK (coherence >= 0 AND coherence <= 100);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_coherence ON public.users(coherence);

-- Set initial values for existing users (default 50 = neutral coherence)
UPDATE public.users SET coherence = 50 WHERE coherence IS NULL;

-- Grant permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

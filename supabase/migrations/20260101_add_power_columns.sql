-- Add missing power columns to users table

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS power_mental NUMERIC DEFAULT 50 NOT NULL CHECK (power_mental >= 0 AND power_mental <= 100);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS power_physical NUMERIC DEFAULT 50 NOT NULL CHECK (power_physical >= 0 AND power_physical <= 100);

-- Add power columns to communities table
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS power_mental NUMERIC DEFAULT 50 NOT NULL CHECK (power_mental >= 0 AND power_mental <= 100);

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS power_physical NUMERIC DEFAULT 50 NOT NULL CHECK (power_physical >= 0 AND power_physical <= 100);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_power_mental ON public.users(power_mental);
CREATE INDEX IF NOT EXISTS idx_users_power_physical ON public.users(power_physical);
CREATE INDEX IF NOT EXISTS idx_communities_power_mental ON public.communities(power_mental);
CREATE INDEX IF NOT EXISTS idx_communities_power_physical ON public.communities(power_physical);

-- Set initial values for existing users (default 50)
UPDATE public.users SET power_mental = 50 WHERE power_mental IS NULL;
UPDATE public.users SET power_physical = 50 WHERE power_physical IS NULL;

-- Set initial values for existing communities (default 50)
UPDATE public.communities SET power_mental = 50 WHERE power_mental IS NULL;
UPDATE public.communities SET power_physical = 50 WHERE power_physical IS NULL;

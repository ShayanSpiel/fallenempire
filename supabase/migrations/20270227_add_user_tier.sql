-- Add user_tier column to users table for badge/cosmetic system
-- Tier levels: 'alpha' (default, no badge), 'sigma' (blue badge), 'omega' (golden badge)

-- Create ENUM type for user tiers
DO $$ BEGIN
  CREATE TYPE user_tier_type AS ENUM ('alpha', 'sigma', 'omega');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add user_tier column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS user_tier user_tier_type DEFAULT 'alpha' NOT NULL;

-- Create index for efficient querying by tier
CREATE INDEX IF NOT EXISTS idx_users_user_tier ON public.users(user_tier);

-- Add comment for documentation
COMMENT ON COLUMN public.users.user_tier IS 'User badge tier: alpha (no badge), sigma (blue verified badge), omega (golden premium badge)';

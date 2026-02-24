-- Add left_at timestamp to community_members to track departed users
-- Ensures ideology and morale logic can filter active members without destructive deletes

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_community_members_left_at_null
  ON public.community_members(community_id)
  WHERE left_at IS NULL;

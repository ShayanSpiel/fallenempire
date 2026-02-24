-- Create user_follows table for follow relationships
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Ensure user cannot follow themselves and one follow per pair
  CONSTRAINT no_self_follow CHECK (follower_id != followed_id),
  UNIQUE(follower_id, followed_id)
);

-- Create indices for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id
  ON public.user_follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_followed_id
  ON public.user_follows(followed_id);

-- Enable RLS
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can create follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.user_follows;

-- Allow anyone to read follows (to show follower/following counts and check follow status)
CREATE POLICY "Anyone can read follows"
  ON public.user_follows
  FOR SELECT
  USING (true);

-- Allow users to follow others (must be their own profile doing the following)
CREATE POLICY "Users can create follows"
  ON public.user_follows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = follower_id AND auth_id = auth.uid()
    )
  );

-- Allow users to unfollow (must be their own profile doing the unfollowing)
CREATE POLICY "Users can delete their own follows"
  ON public.user_follows
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = follower_id AND auth_id = auth.uid()
    )
  );
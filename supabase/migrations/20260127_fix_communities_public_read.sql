-- FIX: Add public read access to communities table for map
-- The map needs to display community info (name, color) without membership requirements
-- Users should be able to see ALL communities to understand map ownership
-- This doesn't grant edit/delete access, only read

-- Drop the restrictive member-only policy
DROP POLICY IF EXISTS "Users can view their community" ON public.communities;

-- Add permissive public read policy
CREATE POLICY "Public read communities" ON public.communities
FOR SELECT USING (true);

-- Keep restrictive policies for writes (only members can do this)
-- Users can only update their own communities through proper authorization checks
DROP POLICY IF EXISTS "Users can manage their own communities" ON public.communities;

CREATE POLICY "Users can manage their own communities" ON public.communities
FOR UPDATE USING (
  -- User is a founder/leader of this community
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND rank_tier <= 1
  )
);

CREATE POLICY "Users can delete their own communities" ON public.communities
FOR DELETE USING (
  -- User is a founder of this community
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND rank_tier = 0
  )
);

-- Insert policy remains restricted to authenticated users
-- (This is handled by app logic, not RLS)

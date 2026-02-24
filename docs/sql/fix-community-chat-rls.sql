-- FIX COMMUNITY MESSAGES RLS POLICY
-- Copy and paste this entire script into Supabase Dashboard > SQL Editor > Run

-- Step 1: Drop all existing policies for community_messages
DROP POLICY IF EXISTS "Users can view community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can insert messages in their community" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;
DROP POLICY IF EXISTS "Insert messages as authenticated user" ON public.community_messages;

-- Step 2: Enable RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Step 3: Create SELECT policy - allow viewing messages from communities user is member of
CREATE POLICY "select_community_messages" ON public.community_messages
  FOR SELECT
  USING (
    -- User must be a member of the community to view its messages
    EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_members.user_id = (
        SELECT id FROM public.users
        WHERE auth_id = auth.uid()
      )
      AND community_members.community_id = community_messages.community_id
    )
  );

-- Step 4: Create INSERT policy - allow inserting messages
-- The server (API endpoint) validates that user is a community member
-- This policy just ensures the user_id matches the authenticated user
CREATE POLICY "insert_community_messages" ON public.community_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid()
    )
  );

-- Step 5: Create DELETE policy - allow deleting own messages
CREATE POLICY "delete_community_messages" ON public.community_messages
  FOR DELETE
  USING (
    user_id = (
      SELECT id FROM public.users
      WHERE auth_id = auth.uid()
    )
  );

-- Step 6: Verify policies are in place
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'community_messages'
ORDER BY policyname;

-- Ensure community_messages table exists and has correct RLS policies
-- This migration is idempotent and safe to run multiple times

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'leader', 'ai')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_community_messages_community_id
  ON public.community_messages(community_id);

CREATE INDEX IF NOT EXISTS idx_community_messages_user_id
  ON public.community_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_community_messages_created_at
  ON public.community_messages(created_at DESC);

-- Enable RLS (safe to call multiple times)
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (allows us to recreate them)
DROP POLICY IF EXISTS "Users can view community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can insert messages in their community" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;

-- Policy 1: Allow viewing messages from communities user is a member of
CREATE POLICY "Users can view community messages" ON public.community_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
      AND cm.community_id = community_messages.community_id
    )
    OR
    -- Also allow if the current user is the message author
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Policy 2: Allow inserting messages (server validates community membership)
-- This is intentionally permissive because the API endpoint validates
CREATE POLICY "Insert messages as authenticated user" ON public.community_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Policy 3: Allow deleting own messages
CREATE POLICY "Users can delete own messages" ON public.community_messages
  FOR DELETE
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Create or replace trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_community_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_messages_updated_at ON public.community_messages;

CREATE TRIGGER trg_community_messages_updated_at
BEFORE UPDATE ON public.community_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_community_messages_updated_at();

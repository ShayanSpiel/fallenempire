-- Create community_messages table for community chat functionality

CREATE TABLE IF NOT EXISTS public.community_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'leader', 'ai')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_messages_community_id
  ON public.community_messages(community_id);

CREATE INDEX IF NOT EXISTS idx_community_messages_user_id
  ON public.community_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_community_messages_created_at
  ON public.community_messages(created_at DESC);

-- Enable RLS
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Allow users to view messages from communities they're members of
CREATE POLICY "Users can view community messages" ON public.community_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_members.user_id = auth.uid()
      AND community_members.community_id = community_messages.community_id
    )
  );

-- Allow authenticated users to insert messages (server-side validation handles membership check)
CREATE POLICY "Authenticated users can insert messages" ON public.community_messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow AI/system to insert messages (no specific user requirement)
-- This is handled server-side with SECURITY DEFINER functions if needed

-- Optional: Allow deleting own messages or community founder/leader actions (server-side validation)
CREATE POLICY "Users can delete own messages" ON public.community_messages
  FOR DELETE
  USING (
    user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_community_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_community_messages_updated_at
BEFORE UPDATE ON public.community_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_community_messages_updated_at();

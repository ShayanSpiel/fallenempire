-- Create conversations and messages tables for the AI chat workflow
-- Ensures the send_message/reply tools and chat triggers can store shared history.

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversations_users_distinct CHECK (user1_id <> user2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations(user2_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_user_pair
  ON public.conversations (
    least(user1_id, user2_id),
    greatest(user1_id, user2_id)
  );

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON public.conversations
  FOR SELECT
  USING (
    user1_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    user2_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can upsert their conversations"
  ON public.conversations
  FOR INSERT
  WITH CHECK (
    user1_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    user2_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- Messages table used by the workflow tools and triggers
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their messages"
  ON public.messages
  FOR SELECT
  USING (
    sender_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) OR
    receiver_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can insert their messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

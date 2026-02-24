-- Add group chat support to direct messaging system

-- Create group_conversations table
CREATE TABLE IF NOT EXISTS group_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_ai_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create group_conversation_participants table
CREATE TABLE IF NOT EXISTS group_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_conversation_id UUID NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin' or 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_participant UNIQUE(group_conversation_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'member'))
);

-- Create group_messages table
CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_conversation_id UUID NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_group_conversations_created_by ON group_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_group_conversation_participants_group ON group_conversation_participants(group_conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_conversation_participants_user ON group_conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_user ON group_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(created_at DESC);

-- Enable RLS
ALTER TABLE group_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- RLS helper functions to avoid recursion
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_conversation_participants
    WHERE group_conversation_id = p_group_id
      AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_conversation_participants
    WHERE group_conversation_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$;

-- RLS Policies for group_conversations
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_conversations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_conversations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view group conversations they participate in"
  ON group_conversations
  FOR SELECT
  USING (
    public.is_group_member(
      id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can create group conversations"
  ON group_conversations
  FOR INSERT
  WITH CHECK (
    created_by IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can update group conversations"
  ON group_conversations
  FOR UPDATE
  USING (
    public.is_group_admin(
      id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_group_admin(
      id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- RLS Policies for group_conversation_participants
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_conversation_participants'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_conversation_participants', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view participants of groups they're in"
  ON group_conversation_participants
  FOR SELECT
  USING (
    public.is_group_member(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Group admins can manage participants"
  ON group_conversation_participants
  FOR INSERT
  WITH CHECK (
    public.is_group_admin(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Group creators can add participants"
  ON group_conversation_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_conversations gc
      WHERE gc.id = group_conversation_id
      AND gc.created_by IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Group admins can remove participants"
  ON group_conversation_participants
  FOR DELETE
  USING (
    public.is_group_admin(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- RLS Policies for group_messages
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.group_messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view messages in groups they're in"
  ON group_messages
  FOR SELECT
  USING (
    public.is_group_member(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages to groups they're in"
  ON group_messages
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
    AND public.is_group_member(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

-- Add realtime support (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_conversations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_conversations';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_conversation_participants'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_conversation_participants';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages';
  END IF;
END $$;

-- Create function to notify group participants of new messages
CREATE OR REPLACE FUNCTION notify_on_group_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notifications for all group participants except sender
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    read,
    related_message_id,
    related_user_id,
    created_at
  )
  SELECT
    gcp.user_id,
    'group_message',
    (SELECT name FROM group_conversations WHERE id = NEW.group_conversation_id) || ': ' || (SELECT username FROM users WHERE id = NEW.user_id),
    NEW.content,
    false,
    NEW.id,
    NEW.user_id,
    NOW()
  FROM group_conversation_participants gcp
  WHERE gcp.group_conversation_id = NEW.group_conversation_id
  AND gcp.user_id != NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for group message notifications
DROP TRIGGER IF EXISTS trg_notify_on_group_message ON group_messages;
CREATE TRIGGER trg_notify_on_group_message
  AFTER INSERT ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_group_message();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_group_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trg_group_conversations_updated_at ON group_conversations;
CREATE TRIGGER trg_group_conversations_updated_at
  BEFORE UPDATE ON group_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_group_conversations_updated_at();

-- Create function to update group_messages updated_at timestamp
CREATE OR REPLACE FUNCTION update_group_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for group_messages updated_at
DROP TRIGGER IF EXISTS trg_group_messages_updated_at ON group_messages;
CREATE TRIGGER trg_group_messages_updated_at
  BEFORE UPDATE ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_group_messages_updated_at();

-- ===== FIX 1: Direct Messages RLS Policies =====
DROP POLICY IF EXISTS "Users can view their own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can create messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON direct_messages;

CREATE POLICY "Users can view their own messages"
  ON direct_messages
  FOR SELECT
  USING (
    sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR recipient_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can create messages"
  ON direct_messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

CREATE POLICY "Users can update their own messages"
  ON direct_messages
  FOR UPDATE
  USING (sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can delete their own messages"
  ON direct_messages
  FOR DELETE
  USING (sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));


-- ===== FIX 2: Add Missing Notification Columns =====
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS related_message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

DROP POLICY IF EXISTS "Users can read their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

CREATE POLICY "Users can read their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));


-- ===== FIX 3: Create Group Chat Tables =====
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

CREATE TABLE IF NOT EXISTS group_conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_conversation_id UUID NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_participant UNIQUE(group_conversation_id, user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'member'))
);

CREATE TABLE IF NOT EXISTS group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_conversation_id UUID NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT content_not_empty CHECK (length(trim(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_group_conversations_created_by ON group_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_group_conversation_participants_group ON group_conversation_participants(group_conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_conversation_participants_user ON group_conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_user ON group_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created_at ON group_messages(created_at DESC);

ALTER TABLE group_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group conversations they participate in" ON group_conversations;
DROP POLICY IF EXISTS "Users can create group conversations" ON group_conversations;

CREATE POLICY "Users can view group conversations they participate in"
  ON group_conversations
  FOR SELECT
  USING (
    id IN (
      SELECT group_conversation_id
      FROM group_conversation_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Users can create group conversations"
  ON group_conversations
  FOR INSERT
  WITH CHECK (
    created_by IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view participants of groups they're in" ON group_conversation_participants;
DROP POLICY IF EXISTS "Group admins can manage participants" ON group_conversation_participants;
DROP POLICY IF EXISTS "Group admins can remove participants" ON group_conversation_participants;

CREATE POLICY "Users can view participants of groups they're in"
  ON group_conversation_participants
  FOR SELECT
  USING (
    group_conversation_id IN (
      SELECT group_conversation_id
      FROM group_conversation_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Group admins can manage participants"
  ON group_conversation_participants
  FOR INSERT
  WITH CHECK (
    group_conversation_id IN (
      SELECT group_conversation_id
      FROM group_conversation_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Group admins can remove participants"
  ON group_conversation_participants
  FOR DELETE
  USING (
    group_conversation_id IN (
      SELECT group_conversation_id
      FROM group_conversation_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view messages in groups they're in" ON group_messages;
DROP POLICY IF EXISTS "Users can send messages to groups they're in" ON group_messages;

CREATE POLICY "Users can view messages in groups they're in"
  ON group_messages
  FOR SELECT
  USING (
    group_conversation_id IN (
      SELECT group_conversation_id
      FROM group_conversation_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages to groups they're in"
  ON group_messages
  FOR INSERT
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    AND group_conversation_id IN (
      SELECT group_conversation_id
      FROM group_conversation_participants
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );


-- ===== FIX 4: Create Admin Settings Table =====
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_dms_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Admins can update admin settings" ON admin_settings;

-- Admin settings are accessible to everyone for now
-- Can be restricted later if role column is added to users table

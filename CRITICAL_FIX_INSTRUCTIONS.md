# ⚠️ CRITICAL: Fix Direct Messages Not Working

**You are getting 400 errors because the database migrations haven't been applied yet.**

## Quick Fix (5 minutes):

### Option 1: Use Supabase Dashboard (Easiest)

1. Go to: https://app.supabase.com/projects
2. Open your **eintelligence** project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query** button
5. **Copy the SQL below** and paste it into the editor
6. Click **Run** (or press Ctrl+Enter)
7. Wait for "Query executed successfully"

### Copy This SQL and Run It:

```sql
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


-- ===== FIX 2: Add Realtime Publication =====
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;


-- ===== FIX 3: Create Message Notifications Table =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  related_message_id UUID,
  related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT message_type_valid CHECK (type IN ('direct_message', 'group_message', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));


-- ===== FIX 4: Create Group Chat Tables =====
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

-- RLS Policies for group_conversations
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

-- RLS Policies for group_conversation_participants
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

-- RLS Policies for group_messages
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

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE group_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE group_conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;


-- ===== FIX 5: Create Admin Settings Table =====
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_dms_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read admin settings"
  ON admin_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update admin settings"
  ON admin_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role = 'admin'
    )
  );
```

## After Running SQL:

1. Refresh your browser (Ctrl+R or Cmd+R)
2. Go to `/messages`
3. Try sending a message - it should work now! ✅

## If It Still Doesn't Work:

Check the browser console (F12 → Console tab) for error messages. The errors will now be more detailed and will help us debug further.

Common issues:
- **"relation does not exist"** → Wait a minute and try again (table might not have created properly)
- **"permission denied"** → The RLS policies might need adjustment
- **"column does not exist"** → Check that the `users` table has `auth_id` column

## Verify Everything Works:

Run this test SQL in Supabase SQL Editor:

```sql
-- Check tables exist
SELECT tablename FROM pg_tables
WHERE tablename IN ('direct_messages', 'group_conversations', 'notifications', 'admin_settings')
ORDER BY tablename;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('direct_messages', 'group_conversations', 'group_messages', 'notifications', 'admin_settings');

-- Count policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('direct_messages', 'group_conversations', 'group_messages', 'notifications', 'admin_settings')
LIMIT 20;
```

All should return results showing tables exist and RLS is enabled!

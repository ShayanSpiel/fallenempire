-- Add message notification support to existing notifications table
-- Add new notification types for direct messages and group chats

-- Add new notification types if they don't exist (PostgreSQL ENUM extension)
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS related_message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Add comment for clarity
COMMENT ON COLUMN notifications.related_message_id IS 'Reference to direct_messages for DM notifications';
COMMENT ON COLUMN notifications.related_user_id IS 'Reference to user who sent the message';

-- Create a function to notify users of new direct messages
CREATE OR REPLACE FUNCTION notify_on_direct_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for recipient
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
  VALUES (
    NEW.recipient_id,
    'direct_message',
    (SELECT username FROM users WHERE id = NEW.sender_id) || ' sent you a message',
    NEW.content,
    false,
    NEW.id,
    NEW.sender_id,
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new direct messages
DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON direct_messages;
CREATE TRIGGER trg_notify_on_direct_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_direct_message();

-- RLS Policy: Users can only view their own message notifications
DROP POLICY IF EXISTS "Users can view their own message notifications" ON notifications;
CREATE POLICY "Users can view their own message notifications"
  ON notifications
  FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
    AND user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can mark their own notifications as read
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

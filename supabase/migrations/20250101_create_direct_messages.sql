-- Create direct_messages table for DM system
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT sender_not_recipient CHECK (sender_id != recipient_id),
  CONSTRAINT content_not_empty CHECK (length(trim(content)) > 0)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_id ON direct_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see messages where they are sender or recipient
CREATE POLICY "Users can view their own messages"
  ON direct_messages
  FOR SELECT
  USING (
    auth.uid()::uuid IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
    AND (
      sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
      OR recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  );

-- RLS Policy: Users can only insert messages where they are the sender
CREATE POLICY "Users can create messages"
  ON direct_messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  );

-- RLS Policy: Users can only update their own messages (future: for edits)
CREATE POLICY "Users can update their own messages"
  ON direct_messages
  FOR UPDATE
  USING (sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  WITH CHECK (sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- RLS Policy: Users can only delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON direct_messages
  FOR DELETE
  USING (sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_direct_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER direct_messages_updated_at
  BEFORE UPDATE ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_direct_messages_updated_at();

-- Add foreign key comments for clarity
COMMENT ON TABLE direct_messages IS 'Stores direct messages between users';
COMMENT ON COLUMN direct_messages.sender_id IS 'User who sent the message';
COMMENT ON COLUMN direct_messages.recipient_id IS 'User who receives the message';
COMMENT ON COLUMN direct_messages.content IS 'Message content (max 500 chars typically enforced in app)';

-- Fix RLS policies for direct_messages table
-- The issue is that subqueries in RLS policies can be unreliable
-- We need to simplify and use a more direct approach

-- Ensure realtime is enabled on direct_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view their own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can create messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON direct_messages;

-- Create simplified RLS policies that work reliably

-- RLS Policy: Users can only see messages where they are sender or recipient
-- Uses a safer approach by joining against auth.users
CREATE POLICY "Users can view their own messages"
  ON direct_messages
  FOR SELECT
  USING (
    sender_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_id = auth.uid()
    )
    OR recipient_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert messages where they are the sender
-- This is the critical one for sending messages
CREATE POLICY "Users can create messages"
  ON direct_messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON direct_messages
  FOR UPDATE
  USING (
    sender_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON direct_messages
  FOR DELETE
  USING (
    sender_id IN (
      SELECT users.id
      FROM users
      WHERE users.auth_id = auth.uid()
    )
  );

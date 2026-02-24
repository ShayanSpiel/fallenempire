-- Fix RLS policies for direct_messages table - Version 2
-- The issue is that auth.uid() returns the auth user ID, but sender_id/recipient_id are user IDs
-- We need to allow all authenticated users to insert, and let the API handle authorization

-- Drop existing RLS policies that are problematic
DROP POLICY IF EXISTS "Users can view their own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can create messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON direct_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON direct_messages;

-- RLS Policy: Users can only see messages where they are sender or recipient
-- This checks if the message's sender_id or recipient_id matches any user profile
-- whose auth_id matches the current authenticated user
CREATE POLICY "Users can view their own messages"
  ON direct_messages
  FOR SELECT
  USING (
    sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    OR recipient_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- RLS Policy: Users can insert messages if they are the sender
-- The API validates that the sender_id corresponds to their user profile
CREATE POLICY "Users can create messages"
  ON direct_messages
  FOR INSERT
  WITH CHECK (
    sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- RLS Policy: Users can update their own messages
CREATE POLICY "Users can update their own messages"
  ON direct_messages
  FOR UPDATE
  USING (sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- RLS Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON direct_messages
  FOR DELETE
  USING (sender_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

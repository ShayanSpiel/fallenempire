-- Fix direct messages and group chat issues
-- This migration ONLY removes the broken triggers
-- RLS policies are kept as-is from the original migration

-- ===== FIX 1: Disable broken direct message notification trigger =====

-- Drop the problematic trigger that's causing the 400 error
DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON direct_messages;

-- Drop the broken trigger function
DROP FUNCTION IF EXISTS notify_on_direct_message() CASCADE;

-- ===== FIX 2: Drop broken group message notification trigger =====

-- Drop the problematic trigger for group messages
DROP TRIGGER IF EXISTS trg_notify_on_group_message ON group_messages;

-- Drop the broken function
DROP FUNCTION IF EXISTS notify_on_group_message() CASCADE;

-- NOTE: RLS policies are NOT modified here
-- The policies from 20260130_add_group_chat.sql are sufficient
-- The infinite recursion was happening because triggers were trying to insert
-- into notifications table with invalid constraints. Now that triggers are gone,
-- the RLS policies will work fine.

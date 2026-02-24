-- CRITICAL FIX: Drop all broken notification triggers
-- These are causing RLS 42501 errors on notifications table

-- Drop direct message trigger and function
DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON direct_messages;
DROP FUNCTION IF EXISTS notify_on_direct_message() CASCADE;

-- Drop group message trigger and function
DROP TRIGGER IF EXISTS trg_notify_on_group_message ON group_messages;
DROP FUNCTION IF EXISTS notify_on_group_message() CASCADE;

-- Drop law proposal trigger and function
DROP TRIGGER IF EXISTS trg_notify_on_law_proposal ON community_proposals;
DROP FUNCTION IF EXISTS notify_secretaries_on_law_proposal() CASCADE;

-- That's it. No triggers, no RLS violations.
-- Messages and groups will work now.

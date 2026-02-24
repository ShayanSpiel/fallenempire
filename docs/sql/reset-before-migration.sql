-- ============================================================================
-- RESET SCRIPT: Clean slate for migration
-- Run this FIRST to prepare for a clean migration
-- Safe for development - removes old community chat data
-- ============================================================================

-- Drop any partial migration artifacts
ALTER TABLE public.communities DROP COLUMN IF EXISTS community_group_id CASCADE;
ALTER TABLE public.group_conversations DROP COLUMN IF EXISTS is_community_chat CASCADE;
ALTER TABLE public.group_conversations DROP COLUMN IF EXISTS community_id CASCADE;
ALTER TABLE public.group_messages DROP COLUMN IF EXISTS role_metadata CASCADE;

-- Drop any migration functions that might exist
DROP FUNCTION IF EXISTS create_community_group_chat(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_add_member_to_community_group() CASCADE;
DROP FUNCTION IF EXISTS auto_remove_member_from_community_group() CASCADE;
DROP FUNCTION IF EXISTS get_community_from_group(UUID) CASCADE;

-- Drop any migration triggers
DROP TRIGGER IF EXISTS trg_auto_add_to_community_group ON public.community_members CASCADE;
DROP TRIGGER IF EXISTS trg_auto_remove_from_community_group ON public.community_members CASCADE;

-- Clear old community messages (since we're in development)
TRUNCATE TABLE public.community_messages CASCADE;

-- Optional: Clear existing group conversations if you want a totally fresh start
-- TRUNCATE TABLE public.group_conversations CASCADE;
-- TRUNCATE TABLE public.group_conversation_participants CASCADE;
-- TRUNCATE TABLE public.group_messages CASCADE;

-- Verification: Show current state
SELECT 'Reset complete. Ready for migration.' as status;

SELECT
  (SELECT COUNT(*) FROM community_messages) as old_messages_count,
  (SELECT COUNT(*) FROM communities) as communities_count,
  (SELECT COUNT(*) FROM group_conversations) as existing_groups_count;

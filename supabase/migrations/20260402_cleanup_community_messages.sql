-- ============================================================================
-- CLEANUP MIGRATION: Remove deprecated community_messages system
-- Date: 2026-04-02
-- Purpose: Clean up old community_messages table after migration to group_messages
--
-- IMPORTANT: Only run this AFTER verifying that:
-- 1. The main migration (20260401) has been applied successfully
-- 2. All community messages have been migrated to group_messages
-- 3. Community group chats are working correctly in /messages
-- 4. The old /api/community/chat endpoints have been removed
-- ============================================================================

-- ============================================================================
-- PHASE 1: Verification checks
-- ============================================================================

DO $$
DECLARE
  v_unmigrated_count INT;
  v_community_count INT;
  v_group_count INT;
  v_column_exists BOOLEAN;
BEGIN
  -- Check if community_group_id column exists (verifies main migration ran)
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'communities'
      AND column_name = 'community_group_id'
  ) INTO v_column_exists;

  IF NOT v_column_exists THEN
    RAISE EXCEPTION 'Main migration (20260401) has not been applied! Run it first before cleanup.';
  END IF;

  -- Check if there are any communities without group chats
  SELECT COUNT(*) INTO v_unmigrated_count
  FROM public.communities
  WHERE community_group_id IS NULL;

  IF v_unmigrated_count > 0 THEN
    RAISE WARNING 'Found % communities without group chats! Migration may not be complete.', v_unmigrated_count;
  ELSE
    RAISE NOTICE '✅ All communities have group chats assigned.';
  END IF;

  -- Compare message counts
  SELECT COUNT(*) INTO v_community_count FROM public.community_messages;
  SELECT COUNT(*) INTO v_group_count
  FROM public.group_messages gm
  JOIN public.group_conversations gc ON gm.group_conversation_id = gc.id
  WHERE gc.is_community_chat = true;

  RAISE NOTICE 'Community messages count: %', v_community_count;
  RAISE NOTICE 'Migrated group messages count: %', v_group_count;

  IF v_group_count < v_community_count THEN
    RAISE WARNING 'Some messages may not have been migrated! Old: %, New: %', v_community_count, v_group_count;
  ELSE
    RAISE NOTICE '✅ All messages appear to have been migrated.';
  END IF;
END $$;

-- ============================================================================
-- PHASE 2: Drop old community_messages table
-- ============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_community_messages_updated_at ON public.community_messages;
DROP FUNCTION IF EXISTS public.update_community_messages_updated_at();

-- Drop policies
DROP POLICY IF EXISTS "Users can view community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_community_messages_community_id;
DROP INDEX IF EXISTS public.idx_community_messages_user_id;
DROP INDEX IF EXISTS public.idx_community_messages_created_at;

-- Drop the table
DROP TABLE IF EXISTS public.community_messages CASCADE;

-- ============================================================================
-- PHASE 3: Cleanup complete
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Dropped community_messages table and related objects.';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'CLEANUP COMPLETE!';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Remove components/community/community-chat.tsx';
  RAISE NOTICE '2. Remove app/api/community/chat/route.ts';
  RAISE NOTICE '3. Remove any remaining references to community-chat';
  RAISE NOTICE '4. Test community group chats in /messages';
  RAISE NOTICE '====================================================================';
END $$;

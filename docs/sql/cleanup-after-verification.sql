-- ============================================================================
-- CLEANUP: Remove old community_messages table
-- Run this ONLY AFTER verifying everything works
-- ============================================================================

-- Verification first
DO $$
DECLARE
  v_communities_with_groups INT;
  v_total_communities INT;
BEGIN
  SELECT COUNT(*) INTO v_total_communities FROM communities;
  SELECT COUNT(*) INTO v_communities_with_groups
  FROM communities
  WHERE community_group_id IS NOT NULL;

  IF v_communities_with_groups < v_total_communities THEN
    RAISE EXCEPTION 'Not all communities have group chats! % of % missing. Do not run cleanup yet.',
      (v_total_communities - v_communities_with_groups), v_total_communities;
  END IF;

  RAISE NOTICE '✅ All % communities have group chats. Safe to proceed.', v_total_communities;
END $$;

-- Drop old triggers and functions
DROP TRIGGER IF EXISTS trg_community_messages_updated_at ON public.community_messages;
DROP FUNCTION IF EXISTS public.update_community_messages_updated_at();

-- Drop old policies
DROP POLICY IF EXISTS "Users can view community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;

-- Drop old indexes
DROP INDEX IF EXISTS public.idx_community_messages_community_id;
DROP INDEX IF EXISTS public.idx_community_messages_user_id;
DROP INDEX IF EXISTS public.idx_community_messages_created_at;

-- Drop the old table
DROP TABLE IF EXISTS public.community_messages CASCADE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '✅ CLEANUP COMPLETE!';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Old community_messages table removed.';
  RAISE NOTICE '';
  RAISE NOTICE 'Final steps:';
  RAISE NOTICE '1. Remove components/community/community-chat.tsx (old component)';
  RAISE NOTICE '2. Remove app/api/community/chat/route.ts (old API)';
  RAISE NOTICE '3. Search codebase for any remaining references';
  RAISE NOTICE '====================================================================';
END $$;

-- ============================================================================
-- MIGRATION STATE VERIFICATION SCRIPT
-- Run this to check your database state before running the migration
-- ============================================================================

-- Check 1: Does community_group_id column exist?
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'communities'
        AND column_name = 'community_group_id'
    )
    THEN '✅ Column EXISTS - Migration already applied'
    ELSE '❌ Column MISSING - Need to run migration'
  END as community_group_id_status;

-- Check 2: Does is_community_chat column exist?
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'group_conversations'
        AND column_name = 'is_community_chat'
    )
    THEN '✅ Column EXISTS - Migration already applied'
    ELSE '❌ Column MISSING - Need to run migration'
  END as is_community_chat_status;

-- Check 3: Count existing community messages
SELECT
  COUNT(*) as community_messages_count,
  'Messages in old system' as description
FROM community_messages;

-- Check 4: Count existing communities
SELECT
  COUNT(*) as total_communities,
  'Total communities to migrate' as description
FROM communities;

-- Check 5: Count existing group conversations
SELECT
  COUNT(*) as existing_group_chats,
  'Existing group chats (before migration)' as description
FROM group_conversations;

-- Check 6: Check if communities table has the columns we need
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'communities'
  AND column_name IN ('id', 'name', 'community_group_id')
ORDER BY column_name;

-- Check 7: Check community_members for sovereigns
SELECT
  c.name as community_name,
  u.username as sovereign,
  cm.rank_tier
FROM communities c
LEFT JOIN community_members cm ON c.id = cm.community_id AND cm.rank_tier = 0
LEFT JOIN users u ON cm.user_id = u.id
ORDER BY c.created_at DESC
LIMIT 10;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT
  '=== MIGRATION STATUS SUMMARY ===' as status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'communities'
        AND column_name = 'community_group_id'
    )
    THEN 'MIGRATION ALREADY APPLIED - Safe to run cleanup'
    ELSE 'MIGRATION NOT APPLIED - Run main migration first'
  END as next_step;

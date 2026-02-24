-- ============================================================================
-- VERIFY COMMUNITY GROUP PARTICIPANTS
-- Run this to check if community group chats have the correct members
-- ============================================================================

-- Check each community and its group chat participants
SELECT
  c.name as community_name,
  c.id as community_id,
  c.community_group_id,
  (
    SELECT COUNT(*)
    FROM community_members cm
    WHERE cm.community_id = c.id
  ) as community_members_count,
  (
    SELECT COUNT(*)
    FROM group_conversation_participants gcp
    WHERE gcp.group_conversation_id = c.community_group_id
  ) as group_participants_count,
  (
    SELECT json_agg(json_build_object(
      'username', u.username,
      'user_id', cm.user_id,
      'rank_tier', cm.rank_tier,
      'in_group', EXISTS(
        SELECT 1
        FROM group_conversation_participants gcp
        WHERE gcp.group_conversation_id = c.community_group_id
        AND gcp.user_id = cm.user_id
      )
    ))
    FROM community_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.community_id = c.id
  ) as community_members,
  (
    SELECT json_agg(json_build_object(
      'username', u.username,
      'user_id', gcp.user_id,
      'role', gcp.role,
      'in_community', EXISTS(
        SELECT 1
        FROM community_members cm
        WHERE cm.community_id = c.id
        AND cm.user_id = gcp.user_id
      )
    ))
    FROM group_conversation_participants gcp
    JOIN users u ON u.id = gcp.user_id
    WHERE gcp.group_conversation_id = c.community_group_id
  ) as group_participants
FROM communities c
WHERE c.community_group_id IS NOT NULL
ORDER BY c.name;

-- Check for any orphaned participants (in group but not in community)
SELECT
  c.name as community_name,
  u.username,
  gcp.role,
  'IN GROUP BUT NOT IN COMMUNITY' as issue
FROM group_conversation_participants gcp
JOIN group_conversations gc ON gc.id = gcp.group_conversation_id
JOIN communities c ON c.community_group_id = gc.id
JOIN users u ON u.id = gcp.user_id
WHERE gc.is_community_chat = true
AND NOT EXISTS (
  SELECT 1
  FROM community_members cm
  WHERE cm.community_id = c.id
  AND cm.user_id = gcp.user_id
);

-- Check for any missing participants (in community but not in group)
SELECT
  c.name as community_name,
  u.username,
  cm.rank_tier,
  'IN COMMUNITY BUT NOT IN GROUP' as issue
FROM community_members cm
JOIN communities c ON c.id = cm.community_id
JOIN users u ON u.id = cm.user_id
WHERE c.community_group_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM group_conversation_participants gcp
  WHERE gcp.group_conversation_id = c.community_group_id
  AND gcp.user_id = cm.user_id
);

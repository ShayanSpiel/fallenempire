-- Add social notification types to the notifications table
-- This migration adds support for follow requests, community invites, and follow accepted notifications

-- Step 1: Update the CHECK constraint to include new notification types
ALTER TABLE public.notifications
DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'direct_message',
  'group_message',
  'law_proposal',
  'war_declaration',
  'heir_proposal',
  'governance_change',
  'announcement',
  'mention',
  'community_update',
  'follow_request',
  'community_invite',
  'follow_accepted'
));

-- Step 2: Create indices for the new notification types
CREATE INDEX idx_notifications_follow_requests
  ON notifications(user_id, type, is_read, created_at)
  WHERE type = 'follow_request' AND is_archived = false;

CREATE INDEX idx_notifications_community_invites
  ON notifications(user_id, type, is_read, created_at)
  WHERE type = 'community_invite' AND is_archived = false;

-- Step 3: Update the user_notification_counts view to include social counts
DROP VIEW IF EXISTS user_notification_counts;

CREATE VIEW user_notification_counts AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE type = 'direct_message' AND is_read = FALSE) as unread_messages,
  COUNT(*) FILTER (WHERE type = 'group_message' AND is_read = FALSE) as unread_group_messages,
  COUNT(*) FILTER (WHERE type IN ('law_proposal', 'heir_proposal', 'governance_change') AND is_read = FALSE) as unread_governance,
  COUNT(*) FILTER (WHERE type = 'announcement' AND is_read = FALSE) as unread_announcements,
  COUNT(*) FILTER (WHERE type IN ('follow_request', 'community_invite', 'follow_accepted') AND is_read = FALSE) as unread_social,
  COUNT(*) FILTER (WHERE type IN ('follow_request', 'community_invite') AND is_read = FALSE) as unread_requests,
  MAX(created_at) as last_notification_at
FROM notifications
WHERE is_archived = FALSE
GROUP BY user_id;

-- Step 4: Add comments for documentation
COMMENT ON CONSTRAINT notifications_type_check ON notifications IS 'Ensures notification types match supported types including social notifications';
COMMENT ON INDEX idx_notifications_follow_requests IS 'Fast lookup for follow request notifications';
COMMENT ON INDEX idx_notifications_community_invites IS 'Fast lookup for community invite notifications';

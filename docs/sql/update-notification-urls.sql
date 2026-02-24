-- ============================================================================
-- UPDATE NOTIFICATION FUNCTION TO USE CORRECT URLs
-- Run this to fix the notification URLs from ?group= to /group/
-- ============================================================================

DROP FUNCTION IF EXISTS notify_on_group_message() CASCADE;

CREATE OR REPLACE FUNCTION notify_on_group_message()
RETURNS TRIGGER AS $$
DECLARE
  v_is_community_chat BOOLEAN;
  v_community_id UUID;
  v_community_name TEXT;
  v_notification_type TEXT;
  v_notification_title TEXT;
  v_action_url TEXT;
BEGIN
  -- Check if this is a community chat
  SELECT gc.is_community_chat, gc.community_id, c.name
  INTO v_is_community_chat, v_community_id, v_community_name
  FROM public.group_conversations gc
  LEFT JOIN public.communities c ON gc.community_id = c.id
  WHERE gc.id = NEW.group_conversation_id;

  -- Set notification type, title, and action URL based on context
  IF v_is_community_chat THEN
    v_notification_type := 'community_message';
    v_notification_title := v_community_name || ': ' || (SELECT username FROM users WHERE id = NEW.user_id);
    v_action_url := '/messages/group/' || NEW.group_conversation_id;
  ELSE
    v_notification_type := 'group_message';
    v_notification_title := (SELECT name FROM group_conversations WHERE id = NEW.group_conversation_id) || ': ' || (SELECT username FROM users WHERE id = NEW.user_id);
    v_action_url := '/messages/group/' || NEW.group_conversation_id;
  END IF;

  -- Create notifications for all participants except sender
  INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    is_read,
    community_id,
    action_url,
    triggered_by_user_id,
    created_at
  )
  SELECT
    gcp.user_id,
    v_notification_type,
    v_notification_title,
    NEW.content,
    false,
    v_community_id,
    v_action_url,
    NEW.user_id,
    NOW()
  FROM group_conversation_participants gcp
  WHERE gcp.group_conversation_id = NEW.group_conversation_id
  AND gcp.user_id != NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_group_message ON group_messages;
CREATE TRIGGER trg_notify_on_group_message
  AFTER INSERT ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_group_message();

-- Show success
DO $$
BEGIN
  RAISE NOTICE '✅ Notification function updated!';
  RAISE NOTICE 'Group message notifications now use /messages/group/{id} URLs';
END $$;

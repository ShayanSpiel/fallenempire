-- ============================================================================
-- COMPLETE MIGRATION - Run this entire file in Supabase SQL Editor
-- Copy and paste this entire file, then execute
-- ============================================================================

-- STEP 1: Clean up any partial migration state
-- ============================================================================
ALTER TABLE public.communities DROP COLUMN IF EXISTS community_group_id CASCADE;
ALTER TABLE public.group_conversations DROP COLUMN IF EXISTS is_community_chat CASCADE;
ALTER TABLE public.group_conversations DROP COLUMN IF EXISTS community_id CASCADE;
ALTER TABLE public.group_messages DROP COLUMN IF EXISTS role_metadata CASCADE;

DROP FUNCTION IF EXISTS create_community_group_chat(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_add_member_to_community_group() CASCADE;
DROP FUNCTION IF EXISTS auto_remove_member_from_community_group() CASCADE;
DROP FUNCTION IF EXISTS get_community_from_group(UUID) CASCADE;

-- Clear old messages (development only)
TRUNCATE TABLE public.community_messages CASCADE;

-- STEP 2: Add new columns
-- ============================================================================
ALTER TABLE public.group_conversations
ADD COLUMN IF NOT EXISTS is_community_chat BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

ALTER TABLE public.group_messages
ADD COLUMN IF NOT EXISTS role_metadata JSONB DEFAULT NULL;

ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS community_group_id UUID REFERENCES public.group_conversations(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_conversations_community_id
ON public.group_conversations(community_id) WHERE is_community_chat = true;

CREATE INDEX IF NOT EXISTS idx_communities_group_id
ON public.communities(community_group_id);

-- STEP 3: Create function to auto-create community group chat
-- ============================================================================
CREATE OR REPLACE FUNCTION create_community_group_chat(p_community_id UUID)
RETURNS UUID AS $$
DECLARE
  v_community_name TEXT;
  v_founder_id UUID;
  v_group_id UUID;
  v_member RECORD;
BEGIN
  -- Get community details
  SELECT name INTO v_community_name
  FROM public.communities
  WHERE id = p_community_id;

  IF v_community_name IS NULL THEN
    RAISE EXCEPTION 'Community not found: %', p_community_id;
  END IF;

  -- Get the founder/sovereign (rank_tier = 0)
  SELECT user_id INTO v_founder_id
  FROM public.community_members
  WHERE community_id = p_community_id
    AND rank_tier = 0
  LIMIT 1;

  -- If no founder found, use the first member as fallback
  IF v_founder_id IS NULL THEN
    SELECT user_id INTO v_founder_id
    FROM public.community_members
    WHERE community_id = p_community_id
    ORDER BY joined_at ASC
    LIMIT 1;
  END IF;

  -- If still no member found, raise error
  IF v_founder_id IS NULL THEN
    RAISE EXCEPTION 'No members found for community: %', p_community_id;
  END IF;

  -- Create group conversation
  INSERT INTO public.group_conversations (
    name,
    description,
    created_by,
    is_ai_enabled,
    is_community_chat,
    community_id
  ) VALUES (
    v_community_name || ' Chat',
    'Official community chat for ' || v_community_name,
    v_founder_id,
    true,
    true,
    p_community_id
  ) RETURNING id INTO v_group_id;

  -- Add all current community members to the group
  FOR v_member IN
    SELECT user_id, rank_tier
    FROM public.community_members
    WHERE community_id = p_community_id
  LOOP
    INSERT INTO public.group_conversation_participants (
      group_conversation_id,
      user_id,
      role
    ) VALUES (
      v_group_id,
      v_member.user_id,
      CASE
        WHEN v_member.rank_tier = 0 THEN 'admin'
        ELSE 'member'
      END
    );
  END LOOP;

  -- Link group back to community
  UPDATE public.communities
  SET community_group_id = v_group_id
  WHERE id = p_community_id;

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create group chats for all existing communities
-- ============================================================================
DO $$
DECLARE
  v_community RECORD;
  v_group_id UUID;
BEGIN
  FOR v_community IN SELECT id, name FROM public.communities ORDER BY created_at
  LOOP
    BEGIN
      v_group_id := create_community_group_chat(v_community.id);
      RAISE NOTICE 'Created group chat for: %', v_community.name;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create group for %: %', v_community.name, SQLERRM;
    END;
  END LOOP;
END $$;

-- STEP 5: Create triggers for auto-add/remove members
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_add_member_to_community_group()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Get community's group chat ID
  SELECT community_group_id INTO v_group_id
  FROM public.communities
  WHERE id = NEW.community_id;

  -- If no group exists, create one
  IF v_group_id IS NULL THEN
    v_group_id := create_community_group_chat(NEW.community_id);
  END IF;

  -- Add user to group chat
  INSERT INTO public.group_conversation_participants (
    group_conversation_id,
    user_id,
    role
  ) VALUES (
    v_group_id,
    NEW.user_id,
    CASE
      WHEN NEW.rank_tier = 0 THEN 'admin'
      ELSE 'member'
    END
  )
  ON CONFLICT (group_conversation_id, user_id) DO UPDATE
  SET role = CASE
    WHEN NEW.rank_tier = 0 THEN 'admin'
    ELSE 'member'
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_remove_member_from_community_group()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  -- Get community's group chat ID
  SELECT community_group_id INTO v_group_id
  FROM public.communities
  WHERE id = OLD.community_id;

  IF v_group_id IS NOT NULL THEN
    -- Remove from group chat
    DELETE FROM public.group_conversation_participants
    WHERE group_conversation_id = v_group_id
    AND user_id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_add_to_community_group ON public.community_members;
CREATE TRIGGER trg_auto_add_to_community_group
  AFTER INSERT OR UPDATE OF rank_tier ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_member_to_community_group();

DROP TRIGGER IF EXISTS trg_auto_remove_from_community_group ON public.community_members;
CREATE TRIGGER trg_auto_remove_from_community_group
  AFTER DELETE ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_remove_member_from_community_group();

-- STEP 6: Update notification function
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

-- STEP 7: Helper function
-- ============================================================================
CREATE OR REPLACE FUNCTION get_community_from_group(p_group_id UUID)
RETURNS UUID AS $$
DECLARE
  v_community_id UUID;
BEGIN
  SELECT community_id INTO v_community_id
  FROM public.group_conversations
  WHERE id = p_group_id
  AND is_community_chat = true;

  RETURN v_community_id;
END;
$$ LANGUAGE plpgsql;

-- STEP 8: Verification
-- ============================================================================
DO $$
DECLARE
  v_total_communities INT;
  v_communities_with_groups INT;
BEGIN
  SELECT COUNT(*) INTO v_total_communities FROM communities;
  SELECT COUNT(*) INTO v_communities_with_groups FROM communities WHERE community_group_id IS NOT NULL;

  RAISE NOTICE '====================================================================';
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE '====================================================================';
  RAISE NOTICE 'Total communities: %', v_total_communities;
  RAISE NOTICE 'Communities with group chats: %', v_communities_with_groups;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test community pages - should show feed on Home tab';
  RAISE NOTICE '2. Click "Open Community Chat" - should open /messages';
  RAISE NOTICE '3. Test sending messages in community chats';
  RAISE NOTICE '4. Try /summary command in chat';
  RAISE NOTICE '====================================================================';
END $$;

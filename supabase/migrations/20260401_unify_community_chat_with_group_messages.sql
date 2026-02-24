-- ============================================================================
-- MIGRATION: Unify Community Chat with Group Messages System
-- Date: 2026-04-01
-- Purpose: Eliminate redundant community_messages table by migrating to
--          group_messages, making communities use the unified chat system
-- ============================================================================

-- ============================================================================
-- PHASE 1: Extend group chat system to support community chats
-- ============================================================================

-- Add community tracking to group conversations
ALTER TABLE public.group_conversations
ADD COLUMN IF NOT EXISTS is_community_chat BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

-- Add role metadata to group messages (for leader/member/ai display)
ALTER TABLE public.group_messages
ADD COLUMN IF NOT EXISTS role_metadata JSONB DEFAULT NULL;

-- Create index for community group lookups
CREATE INDEX IF NOT EXISTS idx_group_conversations_community_id
ON public.group_conversations(community_id) WHERE is_community_chat = true;

-- ============================================================================
-- PHASE 2: Add community_group_id to communities table
-- ============================================================================

ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS community_group_id UUID REFERENCES public.group_conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communities_group_id
ON public.communities(community_group_id);

-- ============================================================================
-- PHASE 3: Create function to auto-create community group chat
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
    true, -- Enable AI for commands
    true, -- Mark as community chat
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
        WHEN v_member.rank_tier = 1 THEN 'admin' -- Sovereign is admin
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

-- ============================================================================
-- PHASE 4: Migrate existing community_messages to group_messages
-- ============================================================================

DO $$
DECLARE
  v_community RECORD;
  v_group_id UUID;
  v_message RECORD;
  v_migration_count INT := 0;
BEGIN
  IF to_regclass('public.community_messages') IS NULL THEN
    RAISE NOTICE 'Skipping community_messages migration: table does not exist.';
    RETURN;
  END IF;

  RAISE NOTICE 'Starting community chat migration...';

  -- For each community
  FOR v_community IN SELECT id, name FROM public.communities ORDER BY created_at
  LOOP
    RAISE NOTICE 'Processing community: % (ID: %)', v_community.name, v_community.id;

    -- Check if group chat already exists
    SELECT community_group_id INTO v_group_id
    FROM public.communities
    WHERE id = v_community.id;

    -- Create group chat if it doesn't exist
    IF v_group_id IS NULL THEN
      v_group_id := create_community_group_chat(v_community.id);
      RAISE NOTICE '  Created group chat: %', v_group_id;
    END IF;

    -- Migrate messages from community_messages to group_messages
    FOR v_message IN
      SELECT * FROM public.community_messages
      WHERE community_id = v_community.id
      ORDER BY created_at
    LOOP
      INSERT INTO public.group_messages (
        id, -- Preserve original ID
        group_conversation_id,
        user_id,
        content,
        role_metadata,
        created_at,
        updated_at
      ) VALUES (
        v_message.id,
        v_group_id,
        v_message.user_id,
        v_message.content,
        jsonb_build_object('role', v_message.role), -- Store role in metadata
        v_message.created_at,
        v_message.updated_at
      )
      ON CONFLICT (id) DO NOTHING; -- Skip if already migrated

      v_migration_count := v_migration_count + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Migration complete! Migrated % messages', v_migration_count;
END $$;

-- ============================================================================
-- PHASE 5: Create trigger to auto-add new community members to group chat
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_add_member_to_community_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
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
      WHEN NEW.rank_tier = 1 THEN 'admin' -- Sovereign is admin
      ELSE 'member'
    END
  )
  ON CONFLICT (group_conversation_id, user_id) DO UPDATE
  SET role = CASE
    WHEN NEW.rank_tier = 1 THEN 'admin'
    ELSE 'member'
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_to_community_group ON public.community_members;
CREATE TRIGGER trg_auto_add_to_community_group
  AFTER INSERT OR UPDATE OF rank_tier ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_member_to_community_group();

-- ============================================================================
-- PHASE 6: Create trigger to auto-remove departed members from group chat
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_remove_member_from_community_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_auto_remove_from_community_group ON public.community_members;
CREATE TRIGGER trg_auto_remove_from_community_group
  AFTER DELETE ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION auto_remove_member_from_community_group();

-- ============================================================================
-- PHASE 7: Update notification function to handle community context
-- ============================================================================

-- Drop and recreate the notification function with community awareness
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
    v_action_url := '/messages?group=' || NEW.group_conversation_id;
  ELSE
    v_notification_type := 'group_message';
    v_notification_title := (SELECT name FROM group_conversations WHERE id = NEW.group_conversation_id) || ': ' || (SELECT username FROM users WHERE id = NEW.user_id);
    v_action_url := '/messages?group=' || NEW.group_conversation_id;
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

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_notify_on_group_message ON group_messages;
CREATE TRIGGER trg_notify_on_group_message
  AFTER INSERT ON group_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_group_message();

-- ============================================================================
-- PHASE 8: Add helper function to get community from group conversation
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

-- ============================================================================
-- PHASE 9: Verification queries (comment these out after running)
-- ============================================================================

-- SELECT
--   c.name as community_name,
--   gc.name as group_name,
--   COUNT(DISTINCT gm.id) as message_count,
--   COUNT(DISTINCT gcp.user_id) as participant_count
-- FROM communities c
-- LEFT JOIN group_conversations gc ON c.community_group_id = gc.id
-- LEFT JOIN group_messages gm ON gc.id = gm.group_conversation_id
-- LEFT JOIN group_conversation_participants gcp ON gc.id = gcp.group_conversation_id
-- GROUP BY c.id, c.name, gc.name
-- ORDER BY c.created_at;

-- ============================================================================
-- NOTES FOR CLEANUP (After verification):
-- 1. Drop community_messages table
-- 2. Remove /api/community/chat endpoints
-- 3. Remove components/community/community-chat.tsx
-- 4. Update frontend to use /messages for community chat
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete! Community chats are now unified with group messages.';
  RAISE NOTICE '⚠️  Next steps:';
  RAISE NOTICE '   1. Test community group chats thoroughly';
  RAISE NOTICE '   2. Update frontend to use /messages?group={id}';
  RAISE NOTICE '   3. Remove old community_messages table (run cleanup migration)';
END $$;

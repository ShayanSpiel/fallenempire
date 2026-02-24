-- Comprehensive Notification System Redesign
-- Optimized for performance, scalability, and flexibility
-- Supports: direct messages, group messages, law proposals, announcements, mentions, and more

-- ===== STEP 1: Drop old broken notifications table =====
DROP TABLE IF EXISTS public.notifications CASCADE;

-- ===== STEP 2: Create optimized notifications table =====
-- Design principles:
-- 1. Single unified table (no type-specific tables needed)
-- 2. Flexible metadata JSON for extensibility
-- 3. Nullable specific_id for different notification sources
-- 4. Proper indexing for query performance
-- 5. Soft deletes via read flag (no hard deletes needed)

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Notification type determines which additional field is populated
  -- Supported types: direct_message, group_message, law_proposal, war_declaration,
  --                  heir_proposal, governance_change, announcement, mention, community_update
  type TEXT NOT NULL CHECK (type IN (
    'direct_message',
    'group_message',
    'law_proposal',
    'war_declaration',
    'heir_proposal',
    'governance_change',
    'announcement',
    'mention',
    'community_update'
  )),

  -- Title for the notification
  title TEXT NOT NULL,

  -- Body/message content (can be null for some types)
  body TEXT,

  -- Specific resource references (polymorphic)
  -- Only one of these should be populated based on type
  direct_message_id UUID REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  group_message_id UUID REFERENCES public.group_messages(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.community_proposals(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  mentioned_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Actor who triggered the notification
  triggered_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Additional metadata stored as JSON for extensibility
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Read status - use for soft deletes and filtering
  is_read BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Action URL for deep linking in the UI
  action_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,

  -- Prevent duplicate notifications for the same resource within a short time window
  -- This prevents notification spam
  CONSTRAINT valid_notification CHECK (
    (type = 'direct_message' AND direct_message_id IS NOT NULL) OR
    (type = 'group_message' AND group_message_id IS NOT NULL) OR
    (type = 'law_proposal' AND proposal_id IS NOT NULL) OR
    (type = 'war_declaration' AND proposal_id IS NOT NULL) OR
    (type = 'heir_proposal' AND proposal_id IS NOT NULL) OR
    (type = 'governance_change' AND proposal_id IS NOT NULL) OR
    (type = 'announcement' AND community_id IS NOT NULL) OR
    (type = 'mention' AND mentioned_by_user_id IS NOT NULL) OR
    (type = 'community_update' AND community_id IS NOT NULL)
  )
);

-- ===== STEP 3: Create indexes for optimal query performance =====
-- Most important: user_id + read status (primary access pattern)
CREATE INDEX idx_notifications_user_read
  ON public.notifications(user_id, is_read, created_at DESC);

-- For pagination and filtering by unread count
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id)
  WHERE is_read = FALSE;

-- For finding notifications by type
CREATE INDEX idx_notifications_user_type
  ON public.notifications(user_id, type, created_at DESC);

-- For finding notifications by resource (for deduplication)
CREATE INDEX idx_notifications_direct_messages
  ON public.notifications(direct_message_id, user_id)
  WHERE direct_message_id IS NOT NULL;

CREATE INDEX idx_notifications_group_messages
  ON public.notifications(group_message_id, user_id)
  WHERE group_message_id IS NOT NULL;

CREATE INDEX idx_notifications_proposals
  ON public.notifications(proposal_id, user_id)
  WHERE proposal_id IS NOT NULL;

CREATE INDEX idx_notifications_communities
  ON public.notifications(community_id, is_read, created_at DESC);

-- For archived notifications (soft delete)
CREATE INDEX idx_notifications_archived
  ON public.notifications(user_id, is_archived)
  WHERE is_archived = FALSE;

-- Metadata search (for future full-text search)
CREATE INDEX idx_notifications_metadata
  ON public.notifications USING GIN(metadata);

-- ===== STEP 4: Enable RLS =====
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ===== STEP 5: Create RLS policies =====
-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Users can only update their own notifications
CREATE POLICY "Users can mark their notifications as read"
  ON public.notifications
  FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    -- Can only update read/archive status, not other fields
    AND (
      CASE
        WHEN (
          SELECT COUNT(*) FROM pg_typeof(ROW(
            is_read, is_archived, read_at
          ))
        ) = 3 THEN TRUE
        ELSE FALSE
      END
    )
  );

-- System can insert notifications (via triggers)
-- Regular users cannot insert notifications
CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NULL OR auth.uid()::text = 'system');

-- ===== STEP 6: Create trigger to update updated_at =====
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.is_read != OLD.is_read THEN
    NEW.read_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notifications_updated_at();

-- ===== STEP 7: Create notification trigger functions =====

-- Function to create direct message notifications
CREATE OR REPLACE FUNCTION notify_on_direct_message()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_username TEXT;
  v_recipient_user_id UUID;
BEGIN
  -- Get sender username
  SELECT username INTO v_sender_username
  FROM public.users
  WHERE id = NEW.sender_id;

  -- Get recipient user ID (they're already the recipient)
  v_recipient_user_id := NEW.recipient_id;

  -- Insert notification for recipient
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    direct_message_id,
    triggered_by_user_id,
    action_url,
    metadata,
    created_at
  )
  VALUES (
    v_recipient_user_id,
    'direct_message',
    COALESCE(v_sender_username, 'Unknown') || ' sent you a message',
    NEW.content,
    NEW.id,
    NEW.sender_id,
    '/messages/' || NEW.sender_id,
    jsonb_build_object(
      'sender_id', NEW.sender_id::text,
      'preview', SUBSTRING(NEW.content, 1, 100)
    ),
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for direct messages
DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_on_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_direct_message();

-- Function to create group message notifications
CREATE OR REPLACE FUNCTION notify_on_group_message()
RETURNS TRIGGER AS $$
DECLARE
  v_group_name TEXT;
  v_sender_username TEXT;
  v_participant RECORD;
BEGIN
  -- Get group name
  SELECT name INTO v_group_name
  FROM public.group_conversations
  WHERE id = NEW.group_conversation_id;

  -- Get sender username
  SELECT username INTO v_sender_username
  FROM public.users
  WHERE id = NEW.user_id;

  -- Insert notifications for all group participants except sender
  FOR v_participant IN
    SELECT user_id
    FROM public.group_conversation_participants
    WHERE group_conversation_id = NEW.group_conversation_id
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      group_message_id,
      triggered_by_user_id,
      action_url,
      metadata,
      created_at
    )
    VALUES (
      v_participant.user_id,
      'group_message',
      COALESCE(v_group_name, 'Group chat') || ': ' || COALESCE(v_sender_username, 'Unknown'),
      NEW.content,
      NEW.id,
      NEW.user_id,
      '/group-chat/' || NEW.group_conversation_id,
      jsonb_build_object(
        'group_id', NEW.group_conversation_id::text,
        'sender_id', NEW.user_id::text,
        'preview', SUBSTRING(NEW.content, 1, 100)
      ),
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for group messages
DROP TRIGGER IF EXISTS trg_notify_on_group_message ON public.group_messages;
CREATE TRIGGER trg_notify_on_group_message
  AFTER INSERT ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_group_message();

-- Function to create law proposal notifications
CREATE OR REPLACE FUNCTION notify_secretaries_on_law_proposal()
RETURNS TRIGGER AS $$
DECLARE
  v_law_label TEXT;
  v_secretary RECORD;
  v_proposer_username TEXT;
BEGIN
  -- Get law label
  v_law_label := (
    CASE NEW.law_type
      WHEN 'DECLARE_WAR' THEN 'Declaration of War'
      WHEN 'PROPOSE_HEIR' THEN 'Heir Proposal'
      WHEN 'CHANGE_GOVERNANCE' THEN 'Governance Change'
      WHEN 'MESSAGE_OF_THE_DAY' THEN 'Message of the Day'
      ELSE NEW.law_type
    END
  );

  -- Get proposer username
  SELECT username INTO v_proposer_username
  FROM public.users
  WHERE id = NEW.proposer_id;

  -- Notify only if proposer is sovereign (rank_tier = 0)
  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = NEW.proposer_id
    AND community_id = NEW.community_id
    AND rank_tier = 0
  ) THEN
    -- Notify all secretaries (rank_tier = 1)
    FOR v_secretary IN
      SELECT cm.user_id
      FROM public.community_members cm
      WHERE cm.community_id = NEW.community_id
      AND cm.rank_tier = 1
      AND cm.user_id != NEW.proposer_id
    LOOP
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        proposal_id,
        community_id,
        triggered_by_user_id,
        action_url,
        metadata,
        created_at
      )
      VALUES (
        v_secretary.user_id,
        'law_proposal',
        v_law_label || ' Proposed',
        'A ' || v_law_label || ' has been proposed by ' || COALESCE(v_proposer_username, 'Unknown'),
        NEW.id,
        NEW.community_id,
        NEW.proposer_id,
        '/communities/' || NEW.community_id::text || '/governance',
        jsonb_build_object(
          'law_type', NEW.law_type,
          'community_id', NEW.community_id::text
        ),
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for law proposals
DROP TRIGGER IF EXISTS trg_notify_on_law_proposal ON public.community_proposals;
CREATE TRIGGER trg_notify_on_law_proposal
  AFTER INSERT ON public.community_proposals
  FOR EACH ROW
  EXECUTE FUNCTION notify_secretaries_on_law_proposal();

-- ===== STEP 8: Add realtime support =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ===== STEP 9: Create view for unread notification counts =====
CREATE OR REPLACE VIEW public.user_notification_counts AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE is_read = FALSE) as unread_count,
  COUNT(*) FILTER (WHERE is_read = FALSE AND type = 'direct_message') as unread_messages,
  COUNT(*) FILTER (WHERE is_read = FALSE AND type = 'group_message') as unread_group_messages,
  COUNT(*) FILTER (WHERE is_read = FALSE AND type IN ('law_proposal', 'war_declaration', 'heir_proposal', 'governance_change')) as unread_governance,
  COUNT(*) FILTER (WHERE is_read = FALSE AND type = 'announcement') as unread_announcements,
  MAX(created_at) as last_notification_at
FROM public.notifications
WHERE is_archived = FALSE
GROUP BY user_id;

-- Grant access to the view
GRANT SELECT ON public.user_notification_counts TO authenticated;

-- ===== STEP 10: Create helper function for batch marking as read =====
CREATE OR REPLACE FUNCTION mark_notifications_as_read(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL,
  p_notification_type TEXT DEFAULT NULL
)
RETURNS TABLE(affected_count INT) AS $$
DECLARE
  v_affected_count INT;
BEGIN
  UPDATE public.notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = p_user_id
  AND is_read = FALSE
  AND is_archived = FALSE
  AND (
    (p_notification_ids IS NULL OR id = ANY(p_notification_ids))
    AND (p_notification_type IS NULL OR type = p_notification_type)
  );

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  RETURN QUERY SELECT v_affected_count;
END;
$$ LANGUAGE plpgsql;

-- ===== STEP 11: Create helper function for archiving notifications =====
CREATE OR REPLACE FUNCTION archive_notifications(
  p_user_id UUID,
  p_notification_ids UUID[] DEFAULT NULL,
  p_notification_type TEXT DEFAULT NULL,
  p_before_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(affected_count INT) AS $$
DECLARE
  v_affected_count INT;
BEGIN
  UPDATE public.notifications
  SET is_archived = TRUE, updated_at = NOW()
  WHERE user_id = p_user_id
  AND is_archived = FALSE
  AND (
    (p_notification_ids IS NULL OR id = ANY(p_notification_ids))
    AND (p_notification_type IS NULL OR type = p_notification_type)
    AND (p_before_date IS NULL OR created_at < p_before_date)
  );

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  RETURN QUERY SELECT v_affected_count;
END;
$$ LANGUAGE plpgsql;

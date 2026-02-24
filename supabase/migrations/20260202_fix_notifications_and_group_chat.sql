-- Fix message notification triggers to bypass RLS and correct group chat URLs
-- Allow group creators to add participants during initial creation

CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_notify_on_direct_message ON public.direct_messages;
CREATE TRIGGER trg_notify_on_direct_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_direct_message();

CREATE OR REPLACE FUNCTION public.notify_on_group_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      '/messages/group/' || NEW.group_conversation_id,
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
$$;

DROP TRIGGER IF EXISTS trg_notify_on_group_message ON public.group_messages;
CREATE TRIGGER trg_notify_on_group_message
  AFTER INSERT ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_group_message();

CREATE OR REPLACE FUNCTION public.notify_secretaries_on_law_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS trg_notify_on_law_proposal ON public.community_proposals;
CREATE TRIGGER trg_notify_on_law_proposal
  AFTER INSERT ON public.community_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_secretaries_on_law_proposal();

DROP POLICY IF EXISTS "Group creators can add participants" ON public.group_conversation_participants;
CREATE POLICY "Group creators can add participants"
  ON public.group_conversation_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.group_conversations gc
      WHERE gc.id = group_conversation_id
      AND gc.created_by IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

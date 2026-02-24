-- Add notification system for law proposals
-- This migration creates a notifications table to track law proposal notifications

-- Step 1: Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('law_proposal', 'war_declaration', 'heir_proposal', 'governance_change', 'announcement')),
  proposal_id UUID REFERENCES public.community_proposals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure we don't create duplicate notifications
  UNIQUE(user_id, proposal_id, type)
);

-- Step 2: Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_community_id
ON public.notifications(community_id, created_at DESC);

-- Step 3: Create function to notify secretaries about law proposals
CREATE OR REPLACE FUNCTION notify_secretaries_on_law_proposal(
  p_proposal_id UUID,
  p_community_id UUID,
  p_law_type TEXT,
  p_proposer_id UUID
)
RETURNS void AS $$
DECLARE
  v_law_label TEXT;
  v_secretary RECORD;
  v_proposer_username TEXT;
BEGIN
  -- Get law label
  v_law_label := (
    CASE p_law_type
      WHEN 'DECLARE_WAR' THEN 'Declaration of War'
      WHEN 'PROPOSE_HEIR' THEN 'Heir Proposal'
      WHEN 'CHANGE_GOVERNANCE' THEN 'Governance Change'
      WHEN 'MESSAGE_OF_THE_DAY' THEN 'Announcement'
      ELSE p_law_type
    END
  );

  -- Get proposer username
  SELECT username INTO v_proposer_username
  FROM public.users
  WHERE id = p_proposer_id;

  -- Get all secretaries (rank_tier = 1) in the community
  FOR v_secretary IN (
    SELECT cm.user_id
    FROM public.community_members cm
    WHERE cm.community_id = p_community_id
    AND cm.rank_tier = 1
    AND cm.user_id != p_proposer_id -- Don't notify the proposer themselves
  )
  LOOP
    -- Insert notification for this secretary
    INSERT INTO public.notifications (
      user_id,
      community_id,
      type,
      proposal_id,
      title,
      message
    ) VALUES (
      v_secretary.user_id,
      p_community_id,
      'law_proposal',
      p_proposal_id,
      v_law_label || ' Proposed',
      'A ' || v_law_label || ' has been proposed by ' || COALESCE(v_proposer_username, 'Unknown') || '.'
    )
    ON CONFLICT (user_id, proposal_id, type) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically notify secretaries on law proposal
CREATE OR REPLACE FUNCTION trigger_notify_on_law_proposal()
RETURNS TRIGGER AS $$
BEGIN
  -- Call notification function only for laws proposed by the sovereign (rank_tier = 0)
  -- Get proposer's rank
  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = NEW.proposer_id
    AND community_id = NEW.community_id
    AND rank_tier = 0
  ) THEN
    PERFORM notify_secretaries_on_law_proposal(
      NEW.id,
      NEW.community_id,
      NEW.law_type,
      NEW.proposer_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_on_law_proposal ON public.community_proposals;
CREATE TRIGGER trg_notify_on_law_proposal
AFTER INSERT ON public.community_proposals
FOR EACH ROW
EXECUTE FUNCTION trigger_notify_on_law_proposal();

-- Step 5: Set up RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid()::TEXT = user_id::TEXT OR user_id IN (
  SELECT id FROM public.users WHERE auth_id = auth.uid()
));

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid()::TEXT = user_id::TEXT OR user_id IN (
  SELECT id FROM public.users WHERE auth_id = auth.uid()
))
WITH CHECK (auth.uid()::TEXT = user_id::TEXT OR user_id IN (
  SELECT id FROM public.users WHERE auth_id = auth.uid()
));

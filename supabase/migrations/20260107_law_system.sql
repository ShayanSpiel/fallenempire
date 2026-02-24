-- Create community_proposals table for scalable law system
CREATE TABLE IF NOT EXISTS public.community_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL,
  law_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'rejected', 'expired', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Indices for efficient queries
  CONSTRAINT law_type_valid CHECK (law_type IN ('DECLARE_WAR', 'PROPOSE_HEIR', 'CHANGE_GOVERNANCE', 'MESSAGE_OF_THE_DAY'))
);

-- Create proposal_votes table for voting
CREATE TABLE IF NOT EXISTS public.proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.community_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one vote per user per proposal
  UNIQUE(proposal_id, user_id)
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_community_proposals_community_id
  ON public.community_proposals(community_id);

CREATE INDEX IF NOT EXISTS idx_community_proposals_status
  ON public.community_proposals(community_id, status);

CREATE INDEX IF NOT EXISTS idx_community_proposals_expires_at
  ON public.community_proposals(expires_at);

CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal_id
  ON public.proposal_votes(proposal_id);

-- Function to get vote counts for a proposal
CREATE OR REPLACE FUNCTION get_proposal_vote_counts(p_proposal_id UUID)
RETURNS TABLE (yes_count BIGINT, no_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE vote = 'yes') as yes_count,
    COUNT(*) FILTER (WHERE vote = 'no') as no_count
  FROM public.proposal_votes
  WHERE proposal_id = p_proposal_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a user can vote on a proposal
CREATE OR REPLACE FUNCTION can_user_vote_on_proposal(
  p_user_id UUID,
  p_proposal_id UUID,
  p_required_ranks INT[]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_rank INTEGER;
  v_community_id UUID;
  v_already_voted BOOLEAN;
BEGIN
  -- Get the community_id from the proposal
  SELECT community_id INTO v_community_id
  FROM public.community_proposals
  WHERE id = p_proposal_id;

  IF v_community_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if user has already voted
  SELECT EXISTS(
    SELECT 1 FROM public.proposal_votes
    WHERE proposal_id = p_proposal_id AND user_id = p_user_id
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN FALSE;
  END IF;

  -- Get user's rank in the community
  SELECT rank_tier INTO v_user_rank
  FROM public.community_members
  WHERE user_id = p_user_id AND community_id = v_community_id;

  -- Check if user's rank is in the allowed ranks
  RETURN v_user_rank = ANY(p_required_ranks);
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.community_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read proposals for their community
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'community_proposals' AND policyname = 'read_community_proposals'
  ) THEN
    CREATE POLICY "read_community_proposals"
      ON public.community_proposals
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.community_members
          WHERE community_id = community_proposals.community_id
            AND user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Only the proposer can delete their own proposal
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'community_proposals' AND policyname = 'delete_own_proposals'
  ) THEN
    CREATE POLICY "delete_own_proposals"
      ON public.community_proposals
      FOR DELETE
      USING (proposer_id = auth.uid());
  END IF;
END $$;

-- Anyone in the community can vote
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_votes' AND policyname = 'vote_in_community'
  ) THEN
    CREATE POLICY "vote_in_community"
      ON public.proposal_votes
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.community_members cm
          INNER JOIN public.community_proposals cp ON cp.community_id = cm.community_id
          WHERE cp.id = proposal_id
            AND cm.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Can only read your own votes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'proposal_votes' AND policyname = 'read_own_votes'
  ) THEN
    CREATE POLICY "read_own_votes"
      ON public.proposal_votes
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

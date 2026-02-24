-- CRITICAL FIX: RLS policies for laws system
-- The core issue: The system uses profile IDs (from users.id), but RLS checks auth.uid()
-- Solution: Map auth.uid() to profile ID using the users table

-- DISABLE RLS TEMPORARILY TO FIX IT
ALTER TABLE public.community_proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes DISABLE ROW LEVEL SECURITY;

-- DROP ALL BROKEN POLICIES
DROP POLICY IF EXISTS "read_community_proposals" ON public.community_proposals;
DROP POLICY IF EXISTS "delete_own_proposals" ON public.community_proposals;
DROP POLICY IF EXISTS "vote_in_community" ON public.proposal_votes;
DROP POLICY IF EXISTS "read_own_votes" ON public.proposal_votes;
DROP POLICY IF EXISTS "insert_community_proposals" ON public.community_proposals;

-- RE-ENABLE RLS
ALTER TABLE public.community_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_votes ENABLE ROW LEVEL SECURITY;

-- FIX: INSERT policy for community_proposals
-- Only community members can propose laws
CREATE POLICY "insert_community_proposals"
  ON public.community_proposals
  FOR INSERT
  WITH CHECK (
    -- The proposer_id must be a valid profile ID of a community member
    -- AND the authenticated user must match that profile
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = community_proposals.proposer_id
        AND u.auth_id = auth.uid()
    )
    AND
    -- User must be a member of the community
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_proposals.community_id
        AND cm.user_id = community_proposals.proposer_id
    )
  );

-- FIX: SELECT policy for community_proposals
-- Anyone who is a member of the community can read proposals
CREATE POLICY "read_community_proposals"
  ON public.community_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      INNER JOIN public.community_members cm ON cm.user_id = u.id
      WHERE u.auth_id = auth.uid()
        AND cm.community_id = community_proposals.community_id
    )
  );

-- FIX: DELETE policy for community_proposals
-- Only the proposer can delete their own proposals
CREATE POLICY "delete_own_proposals"
  ON public.community_proposals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = community_proposals.proposer_id
        AND u.auth_id = auth.uid()
    )
  );

-- FIX: INSERT policy for proposal_votes
-- Only community members can vote
CREATE POLICY "vote_in_community"
  ON public.proposal_votes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = proposal_votes.user_id
        AND u.auth_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM public.community_members cm
      INNER JOIN public.community_proposals cp ON cp.community_id = cm.community_id
      WHERE cp.id = proposal_votes.proposal_id
        AND cm.user_id = proposal_votes.user_id
    )
  );

-- FIX: SELECT policy for proposal_votes
-- Users can only read votes they made
CREATE POLICY "read_own_votes"
  ON public.proposal_votes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = proposal_votes.user_id
        AND u.auth_id = auth.uid()
    )
  );

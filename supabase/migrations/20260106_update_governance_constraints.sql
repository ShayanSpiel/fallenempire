-- Update community constraints to work with the new governance system
-- This ensures that existing founder-based logic maps to rank_tier = 0

-- Update the declare_war function to check rank_tier as primary authority
CREATE OR REPLACE FUNCTION declare_war(
  p_initiator_community_id UUID,
  p_target_community_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_war_id UUID;
  v_existing_status TEXT;
  v_user_rank INTEGER;
BEGIN
  -- If user_id provided, validate they are sovereign (rank 0) or founder
  IF p_user_id IS NOT NULL THEN
    SELECT rank_tier INTO v_user_rank
    FROM public.community_members
    WHERE user_id = p_user_id
      AND community_id = p_initiator_community_id;

    -- Allow if rank_tier = 0 OR role = 'founder' (for backwards compatibility)
    IF v_user_rank IS NULL OR (v_user_rank != 0 AND NOT EXISTS (
      SELECT 1 FROM public.community_members
      WHERE user_id = p_user_id
        AND community_id = p_initiator_community_id
        AND role = 'founder'
    )) THEN
      RETURN jsonb_build_object('error', 'Only community sovereigns can declare war');
    END IF;
  END IF;

  SELECT status INTO v_existing_status
  FROM public.diplomacy_states
  WHERE (initiator_community_id = p_initiator_community_id AND target_community_id = p_target_community_id)
     OR (initiator_community_id = p_target_community_id AND target_community_id = p_initiator_community_id)
  LIMIT 1;

  IF v_existing_status IS NOT NULL THEN
    RETURN jsonb_build_object('status', v_existing_status);
  END IF;

  INSERT INTO public.diplomacy_states (
    initiator_community_id,
    target_community_id,
    status
  )
  VALUES (
    p_initiator_community_id,
    p_target_community_id,
    'war'
  )
  RETURNING id INTO v_war_id;

  RETURN jsonb_build_object('status', 'war', 'id', v_war_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS policies reference the new governance system
-- Update policy: members can see community if they are members (rank_tier != null)
DROP POLICY IF EXISTS "Users can view their own community" ON public.communities;

CREATE POLICY "Users can view their community" ON public.communities
FOR SELECT USING (
  -- User is a member of this community
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND rank_tier IS NOT NULL
  )
);

-- Create index for faster sovereign lookups
CREATE INDEX IF NOT EXISTS idx_community_sovereign_lookup
ON public.community_members(community_id)
WHERE rank_tier = 0;

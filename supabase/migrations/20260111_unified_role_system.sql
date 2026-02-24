-- UNIFIED ROLE SYSTEM MIGRATION
-- Standardizes the community_members table to use rank_tier as the single source of truth
-- This ensures consistency across all authorization checks

-- Step 1: Ensure all members have a valid rank_tier
-- If rank_tier is NULL, set based on role:
-- - 'founder' → rank_tier = 0 (sovereign)
-- - 'leader' → rank_tier = 1 (advisor)
-- - 'member' → rank_tier = 10 (regular member)
-- - NULL → rank_tier = 10 (default)

UPDATE public.community_members
SET rank_tier = CASE
  WHEN role = 'founder' THEN 0
  WHEN role = 'leader' THEN 1
  ELSE 10
END
WHERE rank_tier IS NULL;

-- Step 2: Add NOT NULL constraint to rank_tier
-- This prevents future inconsistencies
ALTER TABLE public.community_members
ALTER COLUMN rank_tier SET NOT NULL;

-- Step 3: Add default value for new inserts
ALTER TABLE public.community_members
ALTER COLUMN rank_tier SET DEFAULT 10;

-- Step 4: Update the role field to match rank_tier for consistency
-- (The role field is deprecated but kept for backwards compatibility)
UPDATE public.community_members
SET role = CASE
  WHEN rank_tier = 0 THEN 'founder'
  WHEN rank_tier = 1 THEN 'leader'
  ELSE 'member'
END;

-- Step 5: Update the declare_war SQL function to only check rank_tier
-- (Remove fallback to role field)
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
  -- If user_id provided, validate they are sovereign (rank 0)
  IF p_user_id IS NOT NULL THEN
    SELECT rank_tier INTO v_user_rank
    FROM public.community_members
    WHERE user_id = p_user_id
      AND community_id = p_initiator_community_id;

    -- Only rank_tier = 0 can declare war
    IF v_user_rank IS NULL OR v_user_rank != 0 THEN
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

-- Step 6: Create audit log for role changes (optional but useful)
CREATE TABLE IF NOT EXISTS public.role_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  old_rank_tier INTEGER,
  new_rank_tier INTEGER,
  changed_by UUID REFERENCES public.users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Step 7: Log what we standardized
INSERT INTO public.role_change_log (community_id, user_id, old_rank_tier, new_rank_tier, changed_by, changed_at)
SELECT
  community_id,
  user_id,
  NULL,
  rank_tier,
  NULL,
  NOW()
FROM public.community_members
WHERE rank_tier IS NOT NULL;

-- Step 8: Create index for faster lookups by rank
CREATE INDEX IF NOT EXISTS idx_community_members_rank_tier
ON public.community_members(community_id, rank_tier);

-- Step 9: Update RLS policies to use rank_tier exclusively
DROP POLICY IF EXISTS "Users can view their community" ON public.communities;

CREATE POLICY "Users can view their community" ON public.communities
FOR SELECT USING (
  -- User is a member of this community (has a valid rank_tier)
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND rank_tier IS NOT NULL
  )
);

-- Verify the migration worked
-- Count members by rank tier:
-- SELECT rank_tier, COUNT(*) as count FROM public.community_members GROUP BY rank_tier;

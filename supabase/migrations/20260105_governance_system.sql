-- Add governance system to communities
-- This migration introduces rank_tier-based governance replacing hardcoded roles

-- Step 1: Add new columns to communities table
ALTER TABLE IF EXISTS public.communities
ADD COLUMN IF NOT EXISTS governance_type TEXT DEFAULT 'monarchy' CHECK (governance_type IN ('monarchy')); -- More types can be added later

-- Step 2: Add rank_tier to community_members
ALTER TABLE IF EXISTS public.community_members
ADD COLUMN IF NOT EXISTS rank_tier INTEGER DEFAULT 10;

-- Step 3: Create constraint to ensure only one member per community has rank_tier = 0
CREATE OR REPLACE FUNCTION enforce_single_sovereign()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting rank_tier to 0, check no one else has rank 0 in this community
  IF NEW.rank_tier = 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = NEW.community_id
        AND rank_tier = 0
        AND user_id != NEW.user_id
    ) THEN
      RAISE EXCEPTION 'A community can only have one Sovereign (rank 0)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_single_sovereign ON public.community_members;
CREATE TRIGGER trg_enforce_single_sovereign
BEFORE INSERT OR UPDATE ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION enforce_single_sovereign();

-- Step 4: Backfill existing data
-- Set founders to rank_tier = 0
UPDATE public.community_members
SET rank_tier = 0
WHERE role = 'founder';

-- Set members to rank_tier = 10
UPDATE public.community_members
SET rank_tier = 10
WHERE role = 'member';

-- Step 5: Create function to check if user is sovereign of a community
CREATE OR REPLACE FUNCTION is_community_sovereign(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_rank INTEGER;
BEGIN
  SELECT rank_tier INTO v_rank
  FROM public.community_members
  WHERE user_id = p_user_id
    AND community_id = p_community_id;

  RETURN COALESCE(v_rank = 0, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update the validate_community_founder function to use rank_tier
CREATE OR REPLACE FUNCTION validate_community_founder(
  p_user_id UUID,
  p_community_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- For backwards compatibility, check either rank_tier = 0 or role = 'founder'
  RETURN EXISTS (
    SELECT 1 FROM public.community_members
    WHERE user_id = p_user_id
      AND community_id = p_community_id
      AND (rank_tier = 0 OR role = 'founder')
  );
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create function to get governance type for a community
CREATE OR REPLACE FUNCTION get_community_governance_type(p_community_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_governance_type TEXT;
BEGIN
  SELECT governance_type INTO v_governance_type
  FROM public.communities
  WHERE id = p_community_id;

  RETURN COALESCE(v_governance_type, 'monarchy');
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add index for efficient rank lookups
CREATE INDEX IF NOT EXISTS idx_community_members_rank_tier
ON public.community_members(community_id, rank_tier);

-- Add heir succession system to communities
-- This supports the PROPOSE_HEIR law which allows communities to designate a successor

-- Step 1: Add heir_id column to communities table (no foreign key to avoid cross-schema references)
ALTER TABLE IF EXISTS public.communities
ADD COLUMN IF NOT EXISTS heir_id UUID;

-- Step 2: Create index for heir lookups
CREATE INDEX IF NOT EXISTS idx_communities_heir_id
ON public.communities(heir_id);

-- Step 3: Add function to get the heir of a community
CREATE OR REPLACE FUNCTION get_community_heir(p_community_id UUID)
RETURNS UUID AS $$
DECLARE
  v_heir_id UUID;
BEGIN
  SELECT heir_id INTO v_heir_id
  FROM public.communities
  WHERE id = p_community_id;

  RETURN v_heir_id;
END;
$$ LANGUAGE plpgsql;

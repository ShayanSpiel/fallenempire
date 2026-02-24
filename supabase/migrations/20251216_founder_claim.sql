-- Founder first-tile claim (only unassigned tiles, only founders)
DROP FUNCTION IF EXISTS public.claim_region_unopposed(UUID, TEXT);
DROP FUNCTION IF EXISTS public.claim_region_unopposed(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION claim_region_unopposed(
  p_community_id UUID,
  p_target_hex_id TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_current_owner UUID;
  v_user_role TEXT;
  v_profile_id UUID;
BEGIN
  -- Resolve Profile ID
  SELECT id INTO v_profile_id
  FROM public.users
  WHERE auth_id = auth.uid();

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Ensure you are logged in.';
  END IF;

  -- Check User Role
  SELECT role INTO v_user_role
  FROM public.community_members
  WHERE community_id = p_community_id 
    AND user_id = v_profile_id;

  -- Validate Founder
  IF v_user_role IS DISTINCT FROM 'founder' THEN
    RAISE EXCEPTION 'Only the founder may claim the first region without combat.';
  END IF;

  -- Validate Target
  SELECT owner_community_id INTO v_current_owner
  FROM public.world_regions
  WHERE hex_id = p_target_hex_id;

  IF v_current_owner IS NOT NULL THEN
    RAISE EXCEPTION 'Region % is already claimed.', p_target_hex_id;
  END IF;

  -- Validate Global Community Territory Limit
  IF EXISTS (SELECT 1 FROM public.world_regions WHERE owner_community_id = p_community_id) THEN
    RAISE EXCEPTION 'This community already holds territory.';
  END IF;

  -- Execute Claim
  INSERT INTO public.world_regions (hex_id, owner_community_id, fortification_level, resource_yield, last_conquered_at)
  VALUES (p_target_hex_id, p_community_id, 1000, 10, NOW())
  ON CONFLICT (hex_id) DO UPDATE
  SET owner_community_id = EXCLUDED.owner_community_id,
      fortification_level = 1000,
      last_conquered_at = NOW();

  RETURN p_target_hex_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

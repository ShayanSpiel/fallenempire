-- Fix claim_region_unopposed to use public user id and avoid missing region rows

DROP FUNCTION IF EXISTS public.claim_region_unopposed(UUID, TEXT);
DROP FUNCTION IF EXISTS public.claim_region_unopposed(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION claim_region_unopposed(
  p_community_id UUID,
  p_target_hex_id TEXT,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_first_claim BOOLEAN;
  v_target_hex_id TEXT;
  v_rows_updated INTEGER := 0;
  v_profile_id UUID;
  v_user_role TEXT;
  v_user_rank INTEGER;
  v_has_left_at BOOLEAN;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  v_target_hex_id := btrim(p_target_hex_id);

  v_profile_id := p_user_id;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found. Ensure you are logged in.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    SELECT role, rank_tier INTO v_user_role, v_user_rank
    FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = v_profile_id
      AND left_at IS NULL;
  ELSE
    SELECT role, rank_tier INTO v_user_role, v_user_rank
    FROM public.community_members
    WHERE community_id = p_community_id
      AND user_id = v_profile_id;
  END IF;

  IF v_user_role IS NULL AND v_user_rank IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this community.';
  END IF;

  IF COALESCE(v_user_rank, 10) <> 0 AND v_user_role IS DISTINCT FROM 'founder' THEN
    RAISE EXCEPTION 'Only the founder may claim the first region without combat.';
  END IF;

  -- Check if this is the community's first claim
  SELECT NOT EXISTS (
    SELECT 1 FROM world_regions WHERE owner_community_id = p_community_id
  ) INTO v_is_first_claim;

  IF NOT v_is_first_claim THEN
    RAISE EXCEPTION 'This community already holds territory.';
  END IF;

  INSERT INTO world_regions (
    hex_id,
    owner_community_id,
    fortification_level,
    resource_yield,
    last_conquered_at
  )
  VALUES (
    v_target_hex_id,
    p_community_id,
    1000,
    10,
    NOW()
  )
  ON CONFLICT (hex_id) DO UPDATE
  SET owner_community_id = EXCLUDED.owner_community_id,
      last_conquered_at = NOW()
  WHERE world_regions.owner_community_id IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Region is already claimed by another community';
  END IF;

  -- First claim sets capital
  UPDATE communities
  SET
    capital_hex_id = v_target_hex_id
  WHERE id = p_community_id;

  RETURN v_target_hex_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_region_unopposed(UUID, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION claim_region_unopposed(
  p_community_id UUID,
  p_target_hex_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id UUID;
  v_has_auth_id BOOLEAN;
BEGIN
  PERFORM set_config('row_security', 'off', true);
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'auth_id'
  ) INTO v_has_auth_id;

  IF v_has_auth_id THEN
    SELECT id INTO v_profile_id
    FROM public.users
    WHERE auth_id = auth.uid();
  END IF;

  IF v_profile_id IS NULL THEN
    SELECT id INTO v_profile_id
    FROM public.users
    WHERE id = auth.uid();
  END IF;

  IF v_profile_id IS NULL THEN
    v_profile_id := auth.uid();
  END IF;
  RETURN public.claim_region_unopposed(p_community_id, p_target_hex_id, v_profile_id);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_region_unopposed(UUID, TEXT) TO authenticated;

-- Fix apply_to_job function to use correct trade_history schema
-- The trade_history table uses amount_transferred (JSONB), not individual columns

CREATE OR REPLACE FUNCTION apply_to_job(
  p_applicant_id UUID,
  p_listing_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_public_user_id UUID;
  v_listing RECORD;
  v_company RECORD;
  v_hex_owner_community_id UUID;
  v_existing_contract UUID;
  v_has_left_at BOOLEAN := false;
  v_is_member BOOLEAN := false;
  v_is_in_territory BOOLEAN := false;
BEGIN
  PERFORM set_config('row_security', 'off', true);

  -- Ensure caller can only apply as themselves
  SELECT u.id INTO v_public_user_id
  FROM public.users u
  WHERE u.auth_id::text = auth.uid()::text;

  IF v_public_user_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF v_public_user_id <> p_applicant_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get job listing
  SELECT * INTO v_listing
  FROM market_listings
  WHERE id = p_listing_id
    AND listing_type = 'job'
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job listing not found or not active';
  END IF;

  -- Validate company + governance (companies follow hex ownership)
  SELECT c.id, c.owner_id, c.hex_id
  INTO v_company
  FROM public.companies c
  WHERE c.id = v_listing.company_id;

  IF v_company.id IS NULL THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  IF v_company.owner_id = p_applicant_id THEN
    RAISE EXCEPTION 'You cannot be hired by your own company. Work there as manager instead.';
  END IF;

  SELECT wr.owner_community_id
  INTO v_hex_owner_community_id
  FROM public.world_regions wr
  WHERE wr.hex_id = btrim(v_company.hex_id);

  IF v_hex_owner_community_id IS NULL THEN
    RAISE EXCEPTION 'This job is no longer available (company is in wilderness)';
  END IF;

  IF v_hex_owner_community_id <> v_listing.community_id THEN
    RAISE EXCEPTION 'This job is no longer available (company governance changed)';
  END IF;

  -- Check if user is a member of the community
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_applicant_id
        AND cm.community_id = v_listing.community_id
        AND cm.left_at IS NULL
    ) INTO v_is_member;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.user_id = p_applicant_id
        AND cm.community_id = v_listing.community_id
    ) INTO v_is_member;
  END IF;

  -- Check if user is in community territory using current_hex
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.world_regions wr ON wr.hex_id = u.current_hex
    WHERE u.id = p_applicant_id
      AND wr.owner_community_id = v_listing.community_id
  ) INTO v_is_in_territory;

  -- Community members can apply from anywhere; non-members must be in territory
  IF NOT v_is_member AND NOT v_is_in_territory THEN
    RAISE EXCEPTION 'Travel to this community''s territory before applying to jobs here';
  END IF;

  IF v_listing.positions_available <= 0 THEN
    RAISE EXCEPTION 'No positions available';
  END IF;

  -- Check if already employed at this company
  SELECT id INTO v_existing_contract
  FROM employment_contracts
  WHERE company_id = v_listing.company_id
    AND employee_id = p_applicant_id
    AND employee_type = 'player'
    AND active = true;

  IF v_existing_contract IS NOT NULL THEN
    RAISE EXCEPTION 'Already employed at this company';
  END IF;

  -- Create employment contract
  INSERT INTO employment_contracts (
    company_id,
    employee_type,
    employee_id,
    wage_per_day_community_coin,
    position
  ) VALUES (
    v_listing.company_id,
    'player',
    p_applicant_id,
    v_listing.wage_per_day_community_coin,
    v_listing.position_title
  );

  -- Decrement openings; when it hits 0, mark listing filled
  UPDATE market_listings
  SET
    positions_available = GREATEST(positions_available - 1, 0),
    status = CASE WHEN positions_available - 1 <= 0 THEN 'filled' ELSE status END,
    updated_at = NOW()
  WHERE id = p_listing_id;

  -- Record in trade history using correct schema (amount_transferred JSONB)
  INSERT INTO trade_history (
    listing_id,
    buyer_id,
    seller_id,
    trade_type,
    amount_transferred
  ) VALUES (
    p_listing_id,
    p_applicant_id,
    v_company.owner_id,
    'job',
    jsonb_build_object(
      'company_id', v_listing.company_id,
      'position', v_listing.position_title,
      'wage_cc', v_listing.wage_per_day_community_coin
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_listing.company_id,
    'position', v_listing.position_title,
    'wage_cc', v_listing.wage_per_day_community_coin
  );
END;
$$;

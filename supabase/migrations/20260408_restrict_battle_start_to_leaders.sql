-- Restrict battle initiation to community leaders (rank 0 or 1)

CREATE OR REPLACE FUNCTION public.start_battle(
  p_attacker_community_id UUID,
  p_target_hex_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_current_owner UUID;
  v_existing_battle_id UUID;
  v_new_battle_id UUID;
  v_actor_id UUID;
  v_member_rank INTEGER;
BEGIN
  -- Resolve caller to profile user ID
  SELECT id INTO v_actor_id
  FROM public.users
  WHERE auth_id = auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'User not found for attack.';
  END IF;

  -- Only community leaders (rank 0 or 1) can initiate attacks
  SELECT rank_tier INTO v_member_rank
  FROM public.community_members
  WHERE community_id = p_attacker_community_id
    AND user_id = v_actor_id;

  IF v_member_rank IS NULL OR v_member_rank > 1 THEN
    RAISE EXCEPTION 'Only community leaders can initiate attacks.';
  END IF;

  SELECT owner_community_id INTO v_current_owner
  FROM public.world_regions
  WHERE hex_id = p_target_hex_id;

  IF v_current_owner = p_attacker_community_id THEN
    RAISE EXCEPTION 'Cannot attack your own territory.';
  END IF;

  SELECT id INTO v_existing_battle_id
  FROM public.battles
  WHERE target_hex_id = p_target_hex_id
    AND status = 'active';

  IF v_existing_battle_id IS NOT NULL THEN
    RETURN v_existing_battle_id;
  END IF;

  INSERT INTO public.battles (
    target_hex_id,
    attacker_community_id,
    defender_community_id,
    ends_at,
    initial_defense,
    current_defense
  )
  VALUES (
    p_target_hex_id,
    p_attacker_community_id,
    v_current_owner,
    NOW() + INTERVAL '1 hour',
    10000,
    10000
  )
  RETURNING id INTO v_new_battle_id;

  RETURN v_new_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

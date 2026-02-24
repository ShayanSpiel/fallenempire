-- 1. RESET GAME STATE (Wipe data)
TRUNCATE TABLE public.battles CASCADE;
TRUNCATE TABLE public.world_regions CASCADE;
TRUNCATE TABLE public.community_members CASCADE;
-- Note: uncomment to wipe communities as well
-- TRUNCATE TABLE public.communities CASCADE;

-- 2. RESET USER CONNECTIONS
UPDATE public.users SET main_community_id = NULL;

-- 3. ENFORCE SINGLE MEMBERSHIP
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_community_membership
  ON public.community_members (user_id);

-- 4. ENSURE BATTLE RPC EXISTS (Re-runnable definition)
CREATE OR REPLACE FUNCTION public.start_battle(
  p_attacker_community_id UUID,
  p_target_hex_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_current_owner UUID;
  v_existing_battle_id UUID;
  v_new_battle_id UUID;
BEGIN
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

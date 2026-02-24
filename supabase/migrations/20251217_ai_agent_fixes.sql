-- AI/Founder support: color field and agent-friendly RPCs
-- 1. Reaffirm color column so crews can store their palette
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6';

-- 2. AI-friendly founder claim (accepts explicit user_id)
CREATE OR REPLACE FUNCTION claim_region_unopposed(
  p_community_id UUID,
  p_target_hex_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_actor_id UUID;
  v_current_owner UUID;
  v_user_role TEXT;
BEGIN
  v_actor_id := COALESCE(auth.uid(), p_user_id);

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'User ID required for claim action.';
  END IF;

  SELECT role INTO v_user_role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = v_actor_id;

  IF v_user_role IS DISTINCT FROM 'founder' THEN
    RAISE EXCEPTION 'Only the founder may claim the first region without combat.';
  END IF;

  SELECT owner_community_id INTO v_current_owner
  FROM public.world_regions
  WHERE hex_id = p_target_hex_id;

  IF v_current_owner IS NOT NULL THEN
    RAISE EXCEPTION 'Region % is already claimed.', p_target_hex_id;
  END IF;

  IF EXISTS (SELECT 1 FROM public.world_regions WHERE owner_community_id = p_community_id) THEN
    RAISE EXCEPTION 'This community already holds territory.';
  END IF;

  INSERT INTO public.world_regions (hex_id, owner_community_id, fortification_level, resource_yield, last_conquered_at)
  VALUES (p_target_hex_id, p_community_id, 1000, 10, NOW())
  ON CONFLICT (hex_id) DO UPDATE
  SET owner_community_id = EXCLUDED.owner_community_id,
      fortification_level = 1000,
      last_conquered_at = NOW();

  RETURN p_target_hex_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. AI-friendly battle action (accepts explicit user_id and handles win)
CREATE OR REPLACE FUNCTION perform_battle_action(
    p_battle_id UUID,
    p_side TEXT,
    p_damage INT,
    p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_actor_id UUID;
    v_battle record;
    v_username text;
BEGIN
    v_actor_id := COALESCE(auth.uid(), p_user_id);
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'User ID required for battle action.';
    END IF;

    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
    IF v_battle.status != 'active' THEN RAISE EXCEPTION 'Battle is over.'; END IF;

    SELECT username INTO v_username FROM public.users WHERE id = v_actor_id;

    IF p_side = 'attacker' THEN
        UPDATE public.battles 
        SET wall_health_current = GREATEST(0, wall_health_current - p_damage),
            attacker_score = attacker_score + p_damage
        WHERE id = p_battle_id;
    ELSE
        UPDATE public.battles 
        SET wall_health_current = LEAST(wall_health_max, wall_health_current + p_damage),
            defender_score = defender_score + p_damage
        WHERE id = p_battle_id;
    END IF;

    INSERT INTO public.battle_logs (battle_id, actor_id, actor_username, action_type, damage_amount, side)
    VALUES (p_battle_id, v_actor_id, v_username, 'strike', p_damage, p_side);
    
    IF (v_battle.wall_health_current - p_damage) <= 0 AND p_side = 'attacker' THEN
        UPDATE public.battles SET status = 'attacker_won', ended_at = NOW() WHERE id = p_battle_id;
        UPDATE public.world_regions 
        SET owner_community_id = v_battle.attacker_community_id 
        WHERE hex_id = v_battle.region_hex_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Add Color to Communities
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#3b82f6';

-- 2. Function to Resolve Battle Outcome (Win/Loss/Time)
CREATE OR REPLACE FUNCTION resolve_battle_outcome(p_battle_id UUID)
RETURNS VOID AS $$
DECLARE
    v_battle record;
    v_duration interval;
BEGIN
    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
    
    -- Calculate duration since start
    v_duration := NOW() - v_battle.started_at;

    -- CASE 1: Attacker Destroyed Wall (Instant Win)
    IF v_battle.wall_health_current <= 0 THEN
        UPDATE public.battles 
        SET status = 'attacker_won', ended_at = NOW() 
        WHERE id = p_battle_id;
        
        -- Transfer Region Ownership
        UPDATE public.world_regions 
        SET owner_community_id = v_battle.attacker_community_id,
            fortification_level = 500, -- Reset wall slightly damaged
            last_conquered_at = NOW()
        WHERE hex_id = v_battle.region_hex_id;
        
    -- CASE 2: Time Expired (Defender Wins)
    ELSIF v_duration > INTERVAL '1 hour' THEN
        UPDATE public.battles 
        SET status = 'defender_won', ended_at = NOW() 
        WHERE id = p_battle_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update Battle Action to Trigger Resolution
CREATE OR REPLACE FUNCTION perform_battle_action(
    p_battle_id UUID,
    p_side TEXT, 
    p_damage INT
)
RETURNS VOID AS $$
DECLARE
    v_battle record;
    v_username text;
BEGIN
    -- Get Battle State
    SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
    IF v_battle.status != 'active' THEN RAISE EXCEPTION 'Battle is over.'; END IF;

    -- Get Username
    SELECT username INTO v_username FROM public.users WHERE id = auth.uid();

    -- Apply Damage
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

    -- Log Action
    INSERT INTO public.battle_logs (battle_id, actor_id, actor_username, action_type, damage_amount, side)
    VALUES (p_battle_id, auth.uid(), v_username, 'strike', p_damage, p_side);
    
    -- CHECK FOR OUTCOME
    PERFORM resolve_battle_outcome(p_battle_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 1. ENUMS & TYPES
-- ============================================================================
CREATE TYPE diplomacy_status AS ENUM ('neutral', 'war', 'ally', 'ceasefire');
CREATE TYPE battle_type AS ENUM ('pve', 'pvp'); 
CREATE TYPE battle_status AS ENUM ('active', 'attacker_won', 'defender_won', 'draw');

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- MAP STATE: Who owns what tile?
CREATE TABLE IF NOT EXISTS public.world_regions (
    hex_id TEXT PRIMARY KEY, 
    owner_community_id UUID REFERENCES public.communities(id),
    fortification_level INT DEFAULT 1000,
    resource_yield INT DEFAULT 10,
    last_conquered_at TIMESTAMPTZ DEFAULT NOW()
);

-- DIPLOMACY: Who can fight whom?
CREATE TABLE IF NOT EXISTS public.diplomacy_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    initiator_community_id UUID REFERENCES public.communities(id) NOT NULL,
    target_community_id UUID REFERENCES public.communities(id) NOT NULL,
    status diplomacy_status DEFAULT 'neutral',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Enforce unique relationship (initiator < target to avoid duplicates)
    CONSTRAINT unique_relationship CHECK (initiator_community_id < target_community_id),
    UNIQUE (initiator_community_id, target_community_id)
);

-- BATTLES: Active conflict instances
CREATE TABLE IF NOT EXISTS public.battles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    region_hex_id TEXT REFERENCES public.world_regions(hex_id) NOT NULL,
    attacker_community_id UUID REFERENCES public.communities(id) NOT NULL,
    defender_community_id UUID REFERENCES public.communities(id), -- NULL if PvE
    type battle_type NOT NULL,
    status battle_status DEFAULT 'active',
    
    -- Live Game State
    wall_health_max INT DEFAULT 10000,
    wall_health_current INT DEFAULT 10000,
    attacker_score INT DEFAULT 0,
    defender_score INT DEFAULT 0,
    
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- BATTLE LOGS: High-frequency event stream (clicks/damage)
CREATE TABLE IF NOT EXISTS public.battle_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id),
    actor_username TEXT, -- Cache for speed
    action_type TEXT NOT NULL, -- 'strike', 'bomb', 'heal'
    damage_amount INT NOT NULL,
    side TEXT NOT NULL, -- 'attacker' or 'defender'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. REALTIME & RLS
-- ============================================================================

-- Enable Realtime for Battle UI
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_logs;

-- RLS: Public Read, Logic-Only Write (handled by functions)
ALTER TABLE public.world_regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read regions" ON public.world_regions FOR SELECT USING (true);

ALTER TABLE public.diplomacy_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read diplomacy" ON public.diplomacy_states FOR SELECT USING (true);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read battles" ON public.battles FOR SELECT USING (true);

ALTER TABLE public.battle_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read logs" ON public.battle_logs FOR SELECT USING (true);

-- ============================================================================
-- 4. GAME LOGIC FUNCTIONS (RPC)
-- ============================================================================

-- RPC 1: DECLARE WAR
CREATE OR REPLACE FUNCTION declare_war(
    p_initiator_community_id UUID, 
    p_target_community_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_user_role text;
    v_initiator UUID := LEAST(p_initiator_community_id, p_target_community_id);
    v_target UUID := GREATEST(p_initiator_community_id, p_target_community_id);
BEGIN
    -- Check permissions (must be founder/admin of initiator)
    SELECT role INTO v_user_role FROM public.community_members 
    WHERE community_id = p_initiator_community_id AND user_id = auth.uid();

    IF v_user_role NOT IN ('founder', 'admin') THEN
        RAISE EXCEPTION 'Only community leadership can declare war.';
    END IF;

    -- Upsert state
    INSERT INTO public.diplomacy_states (initiator_community_id, target_community_id, status)
    VALUES (v_initiator, v_target, 'war')
    ON CONFLICT (initiator_community_id, target_community_id)
    DO UPDATE SET status = 'war', updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: START BATTLE
CREATE OR REPLACE FUNCTION start_battle(
    p_attacker_community_id UUID,
    p_target_hex_id TEXT
)
RETURNS UUID AS $$
DECLARE
    v_target_owner UUID;
    v_war_status diplomacy_status;
    v_new_battle_id UUID;
BEGIN
    -- Get current owner
    SELECT owner_community_id INTO v_target_owner 
    FROM public.world_regions WHERE hex_id = p_target_hex_id;

    -- Validate Attack
    IF v_target_owner IS NOT NULL THEN
        IF v_target_owner = p_attacker_community_id THEN
            RAISE EXCEPTION 'You cannot attack your own territory.';
        END IF;

        -- Check War Status
        SELECT status INTO v_war_status 
        FROM public.diplomacy_states 
        WHERE initiator_community_id = LEAST(p_attacker_community_id, v_target_owner)
          AND target_community_id = GREATEST(p_attacker_community_id, v_target_owner);
        
        IF v_war_status IS DISTINCT FROM 'war' THEN
            RAISE EXCEPTION 'You must declare war first.';
        END IF;
    END IF;

    -- Create Battle
    INSERT INTO public.battles (
        region_hex_id, 
        attacker_community_id, 
        defender_community_id, 
        type
    )
    VALUES (
        p_target_hex_id,
        p_attacker_community_id,
        v_target_owner,
        CASE WHEN v_target_owner IS NULL THEN 'pve'::battle_type ELSE 'pvp'::battle_type END
    )
    RETURNING id INTO v_new_battle_id;

    RETURN v_new_battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 3: PERFORM ACTION (The "Click")
CREATE OR REPLACE FUNCTION perform_battle_action(
    p_battle_id UUID,
    p_side TEXT, -- 'attacker' or 'defender'
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

    -- Get Username for Logs
    SELECT username INTO v_username FROM public.users WHERE id = auth.uid();

    -- Apply Damage / Points
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

    -- Insert Log (Triggers Realtime)
    INSERT INTO public.battle_logs (battle_id, actor_id, actor_username, action_type, damage_amount, side)
    VALUES (p_battle_id, auth.uid(), v_username, 'strike', p_damage, p_side);
    
    -- Victory Check (Simplified)
    IF (v_battle.wall_health_current - p_damage) <= 0 AND p_side = 'attacker' THEN
        UPDATE public.battles SET status = 'attacker_won', ended_at = NOW() WHERE id = p_battle_id;
        -- Transfer ownership of region logic goes here
        UPDATE public.world_regions 
        SET owner_community_id = v_battle.attacker_community_id 
        WHERE hex_id = v_battle.region_hex_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

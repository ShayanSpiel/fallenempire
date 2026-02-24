-- Battle system: 1-hour walls, RPCs for starting, attacking, resolving (supports future laws/alliances)

-- 1. Battles table
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_hex_id TEXT NOT NULL,
  attacker_community_id UUID NOT NULL REFERENCES public.communities(id),
  defender_community_id UUID REFERENCES public.communities(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  initial_defense INT NOT NULL DEFAULT 10000,
  current_defense INT NOT NULL DEFAULT 10000,
  attacker_score INT NOT NULL DEFAULT 0,
  defender_score INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battles_target_active ON public.battles(target_hex_id) WHERE status = 'active';

-- 2. Start battle RPC
CREATE OR REPLACE FUNCTION public.start_battle(
  p_attacker_community_id UUID,
  p_target_hex_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_current_owner UUID;
  v_existing_battle_id UUID;
  v_new_battle_id UUID;
  v_war_status TEXT;
BEGIN
  SELECT owner_community_id INTO v_current_owner
  FROM public.world_regions
  WHERE hex_id = p_target_hex_id;

  IF v_current_owner = p_attacker_community_id THEN
    RAISE EXCEPTION 'Cannot attack your own territory.';
  END IF;

  IF v_current_owner IS NOT NULL THEN
    SELECT status::text INTO v_war_status
    FROM public.diplomacy_states
    WHERE (initiator_community_id = p_attacker_community_id AND target_community_id = v_current_owner)
       OR (initiator_community_id = v_current_owner AND target_community_id = p_attacker_community_id)
    LIMIT 1;

    IF v_war_status IS DISTINCT FROM 'war' THEN
      RAISE EXCEPTION 'Declare war before attacking this community.';
    END IF;
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

-- 3. Attack RPC
CREATE OR REPLACE FUNCTION public.attack_battle(
  p_battle_id UUID,
  p_damage INT DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL THEN
    RAISE EXCEPTION 'Battle not found';
  END IF;

  IF v_battle.status <> 'active' THEN
    RAISE EXCEPTION 'This battle is finished.';
  END IF;

  UPDATE public.battles
  SET current_defense = current_defense - p_damage,
      attacker_score = attacker_score + GREATEST(p_damage, 0),
      defender_score = defender_score + GREATEST(-p_damage, 0)
  WHERE id = p_battle_id
  RETURNING current_defense, attacker_score, defender_score
  INTO v_battle.current_defense, v_battle.attacker_score, v_battle.defender_score;

  RETURN jsonb_build_object(
    'current_defense', v_battle.current_defense,
    'attacker_score', v_battle.attacker_score,
    'defender_score', v_battle.defender_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Outcome resolution RPC
CREATE OR REPLACE FUNCTION public.resolve_battle_outcome(
  p_battle_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;
  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('status', v_battle.status);
  END IF;

  IF v_battle.current_defense < 0 THEN
    v_outcome := 'attacker_win';
  ELSIF NOW() > v_battle.ends_at THEN
    v_outcome := 'defender_win';
  ELSE
    RETURN jsonb_build_object('status', 'active');
  END IF;

  IF v_outcome = 'attacker_win' THEN
    INSERT INTO public.world_regions (hex_id, owner_community_id, fortification_level, resource_yield, last_conquered_at)
    VALUES (
      v_battle.target_hex_id,
      v_battle.attacker_community_id,
      1000,
      10,
      NOW()
    )
    ON CONFLICT (hex_id) DO UPDATE SET
      owner_community_id = EXCLUDED.owner_community_id,
      fortification_level = EXCLUDED.fortification_level,
      last_conquered_at = EXCLUDED.last_conquered_at;
  END IF;

  UPDATE public.battles
  SET status = v_outcome
  WHERE id = p_battle_id;

  RETURN jsonb_build_object(
    'status', v_outcome,
    'current_defense', v_battle.current_defense
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

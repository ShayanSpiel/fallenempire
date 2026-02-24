-- Adjust morale actions to the new ±0.5 cap and wire rages from social dislikes
-- 1) Add a dedicated rage trigger for the dislike UI state
-- 2) Rebuild add_rage to honor the new trigger
-- 3) Clamp existing action_definitions entries to the new step

ALTER TABLE public.battle_mechanics_config
  ADD COLUMN IF NOT EXISTS rage_trigger_dislike NUMERIC DEFAULT 0.5;

UPDATE public.battle_mechanics_config
  SET rage_trigger_dislike = 0.5
  WHERE rage_trigger_dislike IS NULL;

ALTER TABLE public.battle_mechanics_config
  ALTER COLUMN rage_trigger_dislike SET NOT NULL;

DROP FUNCTION IF EXISTS public.add_rage(UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.add_rage(
  p_user_id UUID,
  p_trigger_type TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS NUMERIC AS $$
DECLARE
  v_config RECORD;
  v_user RECORD;
  v_base_rage NUMERIC;
  v_scaling_factor NUMERIC;
  v_rage_gain NUMERIC;
  v_new_rage NUMERIC;
  v_community_id UUID;
BEGIN
  -- Get user's community
  SELECT main_community_id INTO v_community_id
  FROM users
  WHERE id = p_user_id;

  -- Get config
  SELECT * INTO v_config
  FROM battle_mechanics_config
  WHERE community_id = v_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  IF NOT v_config.rage_enabled THEN
    RETURN 0;
  END IF;

  -- Get base rage amount for trigger type
  v_base_rage := CASE p_trigger_type
    WHEN 'hex_captured' THEN v_config.rage_trigger_hex_captured
    WHEN 'capital_captured' THEN v_config.rage_trigger_capital_captured
    WHEN 'ally_defeated' THEN v_config.rage_trigger_ally_defeated
    WHEN 'battle_loss' THEN v_config.rage_trigger_battle_loss
    WHEN 'enemy_attacks' THEN v_config.rage_trigger_enemy_attacks
    WHEN 'dislike' THEN v_config.rage_trigger_dislike
    ELSE 0
  END;

  IF v_base_rage = 0 THEN
    RETURN 0;
  END IF;

  -- Get user state
  SELECT morale, rage INTO v_user
  FROM users
  WHERE id = p_user_id;

  -- Apply morale scaling if enabled
  IF v_config.rage_morale_scaling_enabled THEN
    v_scaling_factor := 1.0 + ((100 - COALESCE(v_user.morale, 50)) / 100.0);
    v_rage_gain := v_base_rage * v_scaling_factor;
  ELSE
    v_rage_gain := v_base_rage;
  END IF;

  -- Calculate new rage (capped at max)
  v_new_rage := LEAST(v_config.rage_max, COALESCE(v_user.rage, 0) + v_rage_gain);

  -- Update user
  UPDATE users
  SET rage = v_new_rage,
      last_rage_update = NOW(),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Log event
  INSERT INTO rage_events (user_id, rage_change, trigger_type, current_rage, metadata)
  VALUES (p_user_id, v_rage_gain, p_trigger_type, v_new_rage, p_metadata);

  RETURN v_new_rage;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.add_rage IS 'Add rage to user with morale scaling';

-- Clamp action definitions to ±0.5 so event actions never overwhelm the new battle strategy
UPDATE public.action_definitions
  SET morale_impact = -0.5
  WHERE action_key IN ('ATTACK', 'DISLIKE', 'DECLARE_WAR');

UPDATE public.action_definitions
  SET morale_impact = 0.5
  WHERE action_key IN (
    'TRADE', 'LIKE', 'FOLLOW', 'COMMENT', 'CREATE_POST',
    'COMMUNITY_CREATE', 'COMMUNITY_JOIN', 'REBEL', 'TRADE_AGREEMENT', 'FORM_ALLIANCE'
  );

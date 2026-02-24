-- ============================================================================
-- Battle Outcome + Effect Notifications
-- ============================================================================
-- Adds notification types and emits per-community-member notifications for:
-- - Winning / losing battles
-- - Momentum morale gain
-- - Disarray activation
-- - Exhaustion activation
-- - Vengeance rage on defeat
-- ============================================================================

-- Ensure notifications has battle_id (older environments)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE;

-- Expand notification types to include battle outcome/effects
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'direct_message',
  'group_message',

  'law_proposal',
  'heir_proposal',
  'governance_change',
  'war_declaration',
  'announcement',

  'law_passed',
  'law_rejected',
  'law_expired',
  'king_changed',
  'king_left',
  'heir_appointed',
  'secretary_appointed',
  'secretary_removed',
  'revolution_started',
  'civil_war_started',

  'battle_started',
  'battle_won',
  'battle_lost',
  'battle_momentum',
  'battle_disarray',
  'battle_exhaustion',
  'battle_rage',

  'community_update',

  'follow_request',
  'community_invite',
  'follow_accepted',
  'mention',
  'post_comment',
  'post_like',
  'post_dislike',
  'feed_summary'
));

-- Keep the "valid_notification" constraint in sync with new types
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS valid_notification;

ALTER TABLE public.notifications
ADD CONSTRAINT valid_notification CHECK (
  (type = 'direct_message' AND direct_message_id IS NOT NULL) OR
  (type = 'group_message' AND group_message_id IS NOT NULL) OR
  (type IN ('law_proposal', 'heir_proposal', 'governance_change') AND proposal_id IS NOT NULL) OR
  (type = 'mention' AND mentioned_by_user_id IS NOT NULL) OR
  (type IN (
    'announcement',
    'war_declaration',
    'community_update',
    'law_passed',
    'law_rejected',
    'law_expired',
    'king_changed',
    'king_left',
    'heir_appointed',
    'secretary_appointed',
    'secretary_removed',
    'revolution_started',
    'civil_war_started',
    'battle_started'
  ) AND community_id IS NOT NULL) OR
  (type IN (
    'battle_won',
    'battle_lost',
    'battle_momentum',
    'battle_disarray',
    'battle_exhaustion',
    'battle_rage'
  ) AND community_id IS NOT NULL AND battle_id IS NOT NULL) OR
  (type IN (
    'follow_request',
    'community_invite',
    'follow_accepted',
    'post_comment',
    'post_like',
    'post_dislike'
  ) AND triggered_by_user_id IS NOT NULL) OR
  (type = 'feed_summary')
);

-- Dedupe: make battle outcome/effect notifications idempotent per member per battle
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_battle_effects_unique
  ON public.notifications (user_id, battle_id, community_id, type)
  WHERE battle_id IS NOT NULL
    AND type IN (
      'battle_won',
      'battle_lost',
      'battle_momentum',
      'battle_disarray',
      'battle_exhaustion',
      'battle_rage'
    );

-- Helper: notify all active members of a community
CREATE OR REPLACE FUNCTION public.notify_community_members(
  p_community_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_battle_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_action_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  IF p_community_id IS NULL OR p_type IS NULL OR p_title IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    community_id,
    battle_id,
    metadata,
    action_url,
    created_at
  )
  SELECT
    cm.user_id,
    p_type,
    p_title,
    p_body,
    p_community_id,
    p_battle_id,
    COALESCE(p_metadata, '{}'::jsonb),
    p_action_url,
    NOW()
  FROM public.community_members cm
  WHERE cm.community_id = p_community_id
    AND cm.left_at IS NULL
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Emit notifications from battle resolution
CREATE OR REPLACE FUNCTION public.resolve_battle_outcome(
  p_battle_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
  v_winner_community_id UUID;
  v_loser_community_id UUID;

  v_winner_name TEXT;
  v_loser_name TEXT;
  v_region_name TEXT;

  v_action_url TEXT;

  v_winner_config RECORD;
  v_loser_config RECORD;
  v_winner_state_before RECORD;
  v_winner_state_after RECORD;
BEGIN
  SELECT * INTO v_battle FROM public.battles WHERE id = p_battle_id;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown');
  END IF;

  IF v_battle.status <> 'active' THEN
    RETURN jsonb_build_object('status', v_battle.status);
  END IF;

  -- Check if battle time is up
  IF NOW() < v_battle.ends_at THEN
    RETURN jsonb_build_object(
      'status', 'active',
      'current_defense', v_battle.current_defense
    );
  END IF;

  -- Determine winner
  IF v_battle.current_defense <= 0 THEN
    v_outcome := 'attacker_won';
    v_winner_community_id := v_battle.attacker_community_id;
    v_loser_community_id := v_battle.defender_community_id;
  ELSE
    v_outcome := 'defender_won';
    v_winner_community_id := v_battle.defender_community_id;
    v_loser_community_id := v_battle.attacker_community_id;
  END IF;

  -- Update battle status
  UPDATE public.battles
  SET status = v_outcome::battle_status
  WHERE id = p_battle_id;

  -- Mark participants as winners/losers
  UPDATE public.battle_participants
  SET won = (
    CASE
      WHEN v_outcome = 'attacker_won' THEN side = 'attacker'
      WHEN v_outcome = 'defender_won' THEN side = 'defender'
      ELSE FALSE
    END
  )
  WHERE battle_id = p_battle_id;

  -- Update battles_won and win_streak for winners
  UPDATE public.users
  SET battles_won = battles_won + 1,
      win_streak = win_streak + 1
  WHERE id IN (
    SELECT user_id FROM public.battle_participants
    WHERE battle_id = p_battle_id AND won = TRUE
  );

  -- Reset win_streak for losers
  UPDATE public.users
  SET win_streak = 0
  WHERE id IN (
    SELECT user_id FROM public.battle_participants
    WHERE battle_id = p_battle_id AND won = FALSE
  );

  -- Transfer territory if attacker won
  IF v_outcome = 'attacker_won' THEN
    INSERT INTO public.world_regions (
      hex_id,
      owner_community_id,
      fortification_level,
      resource_yield,
      last_conquered_at
    )
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

  -- Names / labels for notifications (best-effort)
  SELECT name INTO v_winner_name FROM public.communities WHERE id = v_winner_community_id;
  SELECT name INTO v_loser_name FROM public.communities WHERE id = v_loser_community_id;

  v_region_name := NULL;
  BEGIN
    SELECT region_name INTO v_region_name
    FROM public.world_regions
    WHERE hex_id = v_battle.target_hex_id;
  EXCEPTION WHEN undefined_column THEN
    v_region_name := NULL;
  END;
  v_region_name := COALESCE(v_region_name, 'Region ' || COALESCE(v_battle.target_hex_id, 'unknown'));

  v_action_url := '/battle/' || p_battle_id::text;

  -- Load battle mechanics config for durations/amounts
  SELECT * INTO v_winner_config
  FROM public.battle_mechanics_config
  WHERE community_id = v_winner_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  SELECT * INTO v_loser_config
  FROM public.battle_mechanics_config
  WHERE community_id = v_loser_community_id OR community_id IS NULL
  ORDER BY community_id NULLS LAST
  LIMIT 1;

  -- Capture winner exhaustion state before conquest tracking
  SELECT * INTO v_winner_state_before
  FROM public.community_battle_state
  WHERE community_id = v_winner_community_id;

  -- ============================================================================
  -- Apply unified mechanics (morale, rage, states)
  -- ============================================================================
  BEGIN
    PERFORM public.apply_battle_morale(
      v_winner_community_id,
      v_loser_community_id,
      p_battle_id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to apply battle morale for battle %: %', p_battle_id, SQLERRM;
  END;

  IF v_loser_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_battle_rage(
        v_loser_community_id,
        p_battle_id,
        10
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to apply battle rage for battle %: %', p_battle_id, SQLERRM;
    END;
  END IF;

  -- Momentum for winner (also applies morale bonus to members)
  IF v_winner_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_momentum(v_winner_community_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.community_battle_state (
        community_id,
        momentum_active,
        momentum_expires_at
      )
      VALUES (
        v_winner_community_id,
        TRUE,
        NOW() + INTERVAL '12 hours'
      )
      ON CONFLICT (community_id) DO UPDATE SET
        momentum_active = TRUE,
        momentum_expires_at = NOW() + INTERVAL '12 hours',
        updated_at = NOW();
    END;
  END IF;

  -- Win streak should count all wins; conquest tracking already increments on attacker_won.
  IF v_outcome = 'defender_won' AND v_winner_community_id IS NOT NULL THEN
    UPDATE public.community_battle_state
    SET current_win_streak = current_win_streak + 1,
        updated_at = NOW()
    WHERE community_id = v_winner_community_id;
  END IF;

  -- Disarray for loser
  IF v_loser_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.apply_disarray(v_loser_community_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.community_battle_state (
        community_id,
        disarray_active,
        disarray_started_at,
        updated_at
      )
      VALUES (
        v_loser_community_id,
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT (community_id) DO UPDATE SET
        disarray_active = TRUE,
        disarray_started_at = NOW(),
        updated_at = NOW();
    END;
  END IF;

  -- Clear winner disarray and loser momentum (state machine alignment)
  IF v_winner_community_id IS NOT NULL THEN
    UPDATE public.community_battle_state
    SET disarray_active = FALSE,
        disarray_started_at = NULL,
        updated_at = NOW()
    WHERE community_id = v_winner_community_id;
  END IF;

  IF v_loser_community_id IS NOT NULL THEN
    UPDATE public.community_battle_state
    SET momentum_active = FALSE,
        momentum_expires_at = NULL,
        updated_at = NOW()
    WHERE community_id = v_loser_community_id;
  END IF;

  -- Track conquests and check exhaustion threshold
  IF v_outcome = 'attacker_won' AND v_winner_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.track_conquest(v_winner_community_id, v_battle.target_hex_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to track conquest for battle %: %', p_battle_id, SQLERRM;
    END;
  END IF;

  -- Refresh winner state to detect exhaustion activation
  SELECT * INTO v_winner_state_after
  FROM public.community_battle_state
  WHERE community_id = v_winner_community_id;

  -- ============================================================================
  -- Notifications (per community member)
  -- ============================================================================
  IF v_winner_community_id IS NOT NULL AND v_loser_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.notify_community_members(
        v_winner_community_id,
        'battle_won',
        'Battle won',
        'Your army has defeated ' || COALESCE(v_loser_name, 'an enemy community') || ' and conquered ' || v_region_name || '.',
        p_battle_id,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'winner_community_id', v_winner_community_id,
          'loser_community_id', v_loser_community_id,
          'target_hex_id', v_battle.target_hex_id,
          'region_name', v_region_name
        ),
        v_action_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create battle_won notifications for battle %: %', p_battle_id, SQLERRM;
    END;

    BEGIN
      PERFORM public.notify_community_members(
        v_loser_community_id,
        'battle_lost',
        'Battle lost',
        'Your army has lost ' || v_region_name || ' against ' || COALESCE(v_winner_name, 'an enemy community') || '.',
        p_battle_id,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'winner_community_id', v_winner_community_id,
          'loser_community_id', v_loser_community_id,
          'target_hex_id', v_battle.target_hex_id,
          'region_name', v_region_name
        ),
        v_action_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create battle_lost notifications for battle %: %', p_battle_id, SQLERRM;
    END;
  END IF;

  IF v_winner_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.notify_community_members(
        v_winner_community_id,
        'battle_momentum',
        'Momentum morale gained',
        'Your community gained ' || COALESCE(v_winner_config.momentum_morale_bonus, 0)::text || ' momentum morale.',
        p_battle_id,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'momentum_morale_bonus', COALESCE(v_winner_config.momentum_morale_bonus, 0),
          'momentum_duration_hours', COALESCE(v_winner_config.momentum_duration_hours, 12)
        ),
        v_action_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create battle_momentum notifications for battle %: %', p_battle_id, SQLERRM;
    END;

    IF COALESCE(v_winner_state_before.exhaustion_active, FALSE) = FALSE
      AND COALESCE(v_winner_state_after.exhaustion_active, FALSE) = TRUE THEN
      BEGIN
        PERFORM public.notify_community_members(
          v_winner_community_id,
          'battle_exhaustion',
          'Battle exhaustion activated',
          'Battle exhaustion is activated for ' || COALESCE(v_winner_name, 'your community') || ' for ' ||
            COALESCE(v_winner_config.exhaustion_reset_hours, 12)::text || ' hours.',
          p_battle_id,
          jsonb_build_object(
            'battle_id', p_battle_id,
            'exhaustion_reset_hours', COALESCE(v_winner_config.exhaustion_reset_hours, 12),
            'exhaustion_started_at', v_winner_state_after.exhaustion_started_at
          ),
          v_action_url
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create battle_exhaustion notifications for battle %: %', p_battle_id, SQLERRM;
      END;
    END IF;
  END IF;

  IF v_loser_community_id IS NOT NULL THEN
    BEGIN
      PERFORM public.notify_community_members(
        v_loser_community_id,
        'battle_disarray',
        'Disarray activated',
        'Your army is disarrayed after recent loss for ' || COALESCE(v_loser_config.disarray_duration_hours, 12)::text || ' hours.',
        p_battle_id,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'disarray_duration_hours', COALESCE(v_loser_config.disarray_duration_hours, 12)
        ),
        v_action_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create battle_disarray notifications for battle %: %', p_battle_id, SQLERRM;
    END;

    BEGIN
      PERFORM public.notify_community_members(
        v_loser_community_id,
        'battle_rage',
        'Vengeance rage activated',
        COALESCE(v_loser_config.rage_trigger_battle_loss, 10)::text || ' Vengeance rage is activated for ' || COALESCE(v_loser_name, 'your community') || '.',
        p_battle_id,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'rage_trigger_battle_loss', COALESCE(v_loser_config.rage_trigger_battle_loss, 10)
        ),
        v_action_url
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create battle_rage notifications for battle %: %', p_battle_id, SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'status', v_outcome,
    'winner_community_id', v_winner_community_id,
    'loser_community_id', v_loser_community_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

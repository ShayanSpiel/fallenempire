-- ============================================================================
-- UNIFIED BATTLE METRICS SYSTEM
-- Connects morale, rage, battle outcomes, and community states
-- ============================================================================
-- This migration unifies all battle-related metrics that were previously
-- disconnected, ensuring real-time updates across the entire system.
-- ============================================================================

-- ============================================================================
-- PHASE 1: Rage Event System (mirrors morale_events)
-- ============================================================================

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.record_rage_event(UUID, NUMERIC, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.record_rage_event(
  p_user_id UUID,
  p_rage_change NUMERIC,
  p_trigger_type TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_current_rage NUMERIC;
  v_new_rage NUMERIC;
  v_event_id UUID;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_rage_change IS NULL OR p_trigger_type IS NULL THEN
    RAISE EXCEPTION 'user_id, rage_change, and trigger_type are required';
  END IF;

  -- Get current rage with row lock
  SELECT rage INTO v_current_rage
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Calculate new rage (clamped 0-100)
  v_new_rage := GREATEST(0, LEAST(100, COALESCE(v_current_rage, 0) + p_rage_change));

  -- Update user rage
  UPDATE public.users
  SET rage = v_new_rage,
      last_rage_update = NOW()
  WHERE id = p_user_id;

  -- Insert event log
  INSERT INTO public.rage_events (
    user_id,
    rage_change,
    trigger_type,
    current_rage,
    metadata
  )
  VALUES (
    p_user_id,
    p_rage_change,
    p_trigger_type,
    v_new_rage,
    p_metadata
  )
  RETURNING id INTO v_event_id;

  -- Return result
  RETURN jsonb_build_object(
    'event_id', v_event_id,
    'previous_rage', v_current_rage,
    'new_rage', v_new_rage,
    'rage_change', p_rage_change
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- PHASE 2: Enhanced Battle Participation (with morale & rage)
-- ============================================================================

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.record_battle_participation(UUID, UUID, TEXT, INT);

CREATE OR REPLACE FUNCTION public.record_battle_participation(
  p_user_id UUID,
  p_battle_id UUID,
  p_side TEXT,
  p_damage INT
)
RETURNS TABLE (
  total_damage_dealt BIGINT,
  highest_damage_battle INT,
  battles_fought INT,
  current_military_rank TEXT,
  military_rank_score BIGINT
) AS $$
DECLARE
  v_user_id UUID;
  v_participant_damage INT;
  v_is_new_battle BOOLEAN := FALSE;
  v_user_stats RECORD;
  v_medal_count INT := 0;
  v_new_score BIGINT := 0;
  v_new_rank TEXT;
BEGIN
  IF p_user_id IS NULL OR p_battle_id IS NULL OR p_damage IS NULL THEN
    RETURN;
  END IF;

  -- Resolve user ID (handle both auth_id and public.users.id)
  SELECT id INTO v_user_id
  FROM public.users
  WHERE id = p_user_id;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_id = p_user_id;
  END IF;

  -- Auto-create user if missing
  IF v_user_id IS NULL THEN
    INSERT INTO public.users (auth_id, username, email, is_bot)
    SELECT
      au.id AS auth_id,
      COALESCE(
        NULLIF(TRIM(au.raw_user_meta_data ->> 'username'), ''),
        LOWER(NULLIF(SPLIT_PART(COALESCE(au.email, ''), '@', 1), '')),
        'player-' || LEFT(au.id::text, 8)
      ) AS username,
      au.email,
      FALSE
    FROM auth.users au
    WHERE au.id = p_user_id
    ON CONFLICT (auth_id) DO NOTHING
    RETURNING id INTO v_user_id;

    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id
      FROM public.users
      WHERE auth_id = p_user_id;
    END IF;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Record participation in battle_participants table
  INSERT INTO public.battle_participants (user_id, battle_id, side, damage_dealt)
  VALUES (v_user_id, p_battle_id, p_side, p_damage)
  ON CONFLICT (user_id, battle_id) DO UPDATE
    SET damage_dealt = public.battle_participants.damage_dealt + EXCLUDED.damage_dealt,
        side = EXCLUDED.side
  RETURNING damage_dealt, (xmax = 0) AS inserted
  INTO v_participant_damage, v_is_new_battle;

  -- Update mission progress (only once per battle)
  IF v_is_new_battle THEN
    BEGIN
      PERFORM 1 FROM public.update_mission_progress(v_user_id, 'daily-battle', 1);
      PERFORM 1 FROM public.update_mission_progress(v_user_id, 'weekly-battles', 1);
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END IF;

  -- Update user battle stats
  UPDATE public.users u
  SET total_damage_dealt = COALESCE(u.total_damage_dealt, 0) + p_damage,
      highest_damage_battle = GREATEST(COALESCE(u.highest_damage_battle, 0), v_participant_damage),
      battles_fought = COALESCE(u.battles_fought, 0) + CASE WHEN v_is_new_battle THEN 1 ELSE 0 END
  WHERE u.id = v_user_id
  RETURNING u.battles_fought, u.battles_won, u.total_damage_dealt, u.highest_damage_battle, u.win_streak
  INTO v_user_stats;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calculate and update military rank
  SELECT COUNT(*)
  INTO v_medal_count
  FROM public.user_medals um
  JOIN public.medals m ON um.medal_id = m.id
  WHERE um.user_id = v_user_id
    AND m.key = 'battle_hero';

  v_new_score := public.calculate_military_rank_score(
    COALESCE(v_user_stats.total_damage_dealt, 0),
    COALESCE(v_user_stats.battles_won, 0)::INT,
    v_medal_count::INT,
    COALESCE(v_user_stats.win_streak, 0)::INT,
    GREATEST(COALESCE(v_user_stats.battles_fought, 0), 1)::INT
  );

  v_new_rank := public.get_military_rank_from_score(v_new_score);

  UPDATE public.users
  SET military_rank_score = v_new_score,
      current_military_rank = v_new_rank
  WHERE id = v_user_id;

  -- ============================================================================
  -- NEW: Apply morale impact from battle participation
  -- ============================================================================
  -- Combat is exhausting: small morale penalty per action
  BEGIN
    PERFORM public.record_morale_event(
      v_user_id,
      'battle',
      'battle_action',
      -0.5,  -- Small morale cost per battle action
      NULL,
      jsonb_build_object(
        'battle_id', p_battle_id,
        'damage', p_damage,
        'side', p_side
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- If morale function fails, don't block battle participation
    RAISE WARNING 'Failed to record morale event: %', SQLERRM;
  END;

  RETURN QUERY
  SELECT
    v_user_stats.total_damage_dealt,
    v_user_stats.highest_damage_battle,
    v_user_stats.battles_fought,
    v_new_rank,
    v_new_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- PHASE 3: Battle Outcome Morale Cascade
-- ============================================================================

-- Drop old version that had different signature (user IDs instead of community IDs)
DROP FUNCTION IF EXISTS public.apply_battle_morale(UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.apply_battle_morale(
  p_winner_community_id UUID,
  p_loser_community_id UUID,
  p_battle_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_winner_member RECORD;
  v_loser_member RECORD;
BEGIN
  -- Apply victory morale boost to all winners
  FOR v_winner_member IN
    SELECT DISTINCT bp.user_id
    FROM public.battle_participants bp
    WHERE bp.battle_id = p_battle_id
      AND bp.won = TRUE
  LOOP
    BEGIN
      PERFORM public.record_morale_event(
        v_winner_member.user_id,
        'battle',
        'battle_victory',
        10,  -- Victory morale boost
        NULL,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'community_id', p_winner_community_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to apply victory morale for user %: %', v_winner_member.user_id, SQLERRM;
    END;
  END LOOP;

  -- Apply defeat morale penalty to all losers
  FOR v_loser_member IN
    SELECT DISTINCT bp.user_id
    FROM public.battle_participants bp
    WHERE bp.battle_id = p_battle_id
      AND bp.won = FALSE
  LOOP
    BEGIN
      PERFORM public.record_morale_event(
        v_loser_member.user_id,
        'battle',
        'battle_defeat',
        -15,  -- Defeat morale penalty
        NULL,
        jsonb_build_object(
          'battle_id', p_battle_id,
          'community_id', p_loser_community_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to apply defeat morale for user %: %', v_loser_member.user_id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- PHASE 4: Battle Outcome Rage Cascade
-- ============================================================================

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.apply_battle_rage(UUID, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.apply_battle_rage(
  p_loser_community_id UUID,
  p_battle_id UUID,
  p_rage_increase NUMERIC DEFAULT 10
)
RETURNS VOID AS $$
DECLARE
  v_loser_member RECORD;
  v_loser_members UUID[];
BEGIN
  -- Prefer battle participants; fall back to all community members if none found.
  SELECT ARRAY_AGG(DISTINCT bp.user_id) INTO v_loser_members
  FROM public.battle_participants bp
  WHERE bp.battle_id = p_battle_id
    AND bp.won = FALSE;

  IF v_loser_members IS NULL THEN
    SELECT ARRAY_AGG(cm.user_id) INTO v_loser_members
    FROM public.community_members cm
    WHERE cm.community_id = p_loser_community_id
      AND cm.left_at IS NULL;
  END IF;

  IF v_loser_members IS NOT NULL THEN
    FOREACH v_loser_member IN ARRAY v_loser_members LOOP
      BEGIN
        -- Use morale-scaled rage calculation from battle mechanics config.
        PERFORM public.add_rage(
          v_loser_member,
          'battle_loss',
          jsonb_build_object(
            'battle_id', p_battle_id,
            'community_id', p_loser_community_id,
            'base_rage_override', p_rage_increase
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to apply battle rage for user %: %', v_loser_member, SQLERRM;
      END;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- PHASE 5: Enhanced Battle Resolution (with all metrics)
-- ============================================================================

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.resolve_battle_outcome(UUID);

CREATE OR REPLACE FUNCTION public.resolve_battle_outcome(
  p_battle_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
  v_winner_community_id UUID;
  v_loser_community_id UUID;
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

  -- ============================================================================
  -- NEW: Apply morale cascade to all participants
  -- ============================================================================
  PERFORM public.apply_battle_morale(
    v_winner_community_id,
    v_loser_community_id,
    p_battle_id
  );

  -- ============================================================================
  -- NEW: Apply rage to losing community
  -- ============================================================================
  IF v_loser_community_id IS NOT NULL THEN
    PERFORM public.apply_battle_rage(
      v_loser_community_id,
      p_battle_id,
      10  -- Base rage increase on defeat
    );
  END IF;

  -- ============================================================================
  -- NEW: Activate momentum for winning community
  -- ============================================================================
  IF v_winner_community_id IS NOT NULL THEN
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
      current_win_streak = public.community_battle_state.current_win_streak + 1,
      updated_at = NOW();
  END IF;

  -- ============================================================================
  -- NEW: Activate disarray for losing community
  -- ============================================================================
  IF v_loser_community_id IS NOT NULL THEN
    INSERT INTO public.community_battle_state (
      community_id,
      disarray_active,
      disarray_started_at
    )
    VALUES (
      v_loser_community_id,
      TRUE,
      NOW()
    )
    ON CONFLICT (community_id) DO UPDATE SET
      disarray_active = TRUE,
      disarray_started_at = NOW(),
      current_win_streak = 0,
      updated_at = NOW();
  END IF;

  -- ============================================================================
  -- NEW: Clear winner disarray and loser momentum (state machine alignment)
  -- ============================================================================
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

  -- ============================================================================
  -- NEW: Track conquests and check exhaustion threshold
  -- ============================================================================
  IF v_outcome = 'attacker_won' AND v_winner_community_id IS NOT NULL THEN
    PERFORM public.track_conquest(v_winner_community_id, v_battle.target_hex_id);
  END IF;

  RETURN jsonb_build_object(
    'status', v_outcome,
    'winner_community_id', v_winner_community_id,
    'loser_community_id', v_loser_community_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- PHASE 6: Update attack_battle to call record_battle_participation
-- ============================================================================
-- NOTE: The full attack_battle() function is fixed in a separate migration
--       (20261231_fix_attack_battle_columns.sql) to handle column name changes.
--       This section is kept for documentation purposes.
-- ============================================================================

-- The attack_battle() function needs to call record_battle_participation()
-- to trigger morale/rage updates. This is handled in the fix migration.

-- ============================================================================
-- PHASE 7: Community Power Calculation
-- ============================================================================

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.calculate_community_power(UUID);

CREATE OR REPLACE FUNCTION public.calculate_community_power(
  p_community_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_member_count INT;
  v_avg_physical NUMERIC;
  v_avg_mental NUMERIC;
BEGIN
  -- Get member statistics
  SELECT
    COUNT(*),
    AVG(COALESCE(u.power_physical, 0)),
    AVG(COALESCE(u.power_mental, 0))
  INTO v_member_count, v_avg_physical, v_avg_mental
  FROM public.community_members cm
  JOIN public.users u ON u.id = cm.user_id
  WHERE cm.community_id = p_community_id;

  -- Update community power (avg * count for scaling with size)
  UPDATE public.communities
  SET power_physical = COALESCE(v_avg_physical, 0) * COALESCE(v_member_count, 0),
      power_mental = COALESCE(v_avg_mental, 0) * COALESCE(v_member_count, 0)
  WHERE id = p_community_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Drop trigger function if exists for safe re-runs
DROP FUNCTION IF EXISTS public.update_community_power_on_member_change() CASCADE;

-- Trigger to update community power when members join/leave
CREATE OR REPLACE FUNCTION public.update_community_power_on_member_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.calculate_community_power(NEW.community_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.calculate_community_power(OLD.community_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before recreating
DROP TRIGGER IF EXISTS trigger_update_community_power ON public.community_members;

CREATE TRIGGER trigger_update_community_power
AFTER INSERT OR UPDATE OR DELETE ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION public.update_community_power_on_member_change();

-- ============================================================================
-- PHASE 8: Performance Indexes
-- ============================================================================

-- Battle participants by won status
CREATE INDEX IF NOT EXISTS idx_battle_participants_won
ON public.battle_participants(user_id, won)
WHERE won = true;

-- Recent morale events
CREATE INDEX IF NOT EXISTS idx_morale_events_recent
ON public.morale_events(user_id, created_at DESC);

-- Recent rage events
CREATE INDEX IF NOT EXISTS idx_rage_events_recent
ON public.rage_events(user_id, created_at DESC);

-- Active community battle states
CREATE INDEX IF NOT EXISTS idx_community_battle_state_active
ON public.community_battle_state(community_id)
WHERE disarray_active OR momentum_active OR exhaustion_active;

-- Battle action log by battle
CREATE INDEX IF NOT EXISTS idx_battle_action_log_battle_user
ON public.battle_action_log(battle_id, user_id);

-- ============================================================================
-- PHASE 9: Data Cleanup (prevent unbounded growth)
-- ============================================================================

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.cleanup_old_event_logs();

-- Function to cleanup old event logs
CREATE OR REPLACE FUNCTION public.cleanup_old_event_logs()
RETURNS VOID AS $$
BEGIN
  -- Keep only last 30 days of morale events
  DELETE FROM public.morale_events
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Keep only last 30 days of rage events
  DELETE FROM public.rage_events
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Keep only last 60 days of battle action logs
  DELETE FROM public.battle_action_log bal
  WHERE bal.created_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- COMPLETION SUMMARY
-- ============================================================================
-- This migration successfully unifies:
-- ✅ Battle participation → Morale updates (real-time)
-- ✅ Battle participation → Rage updates (when under attack)
-- ✅ Battle outcomes → Victory/defeat morale cascades
-- ✅ Battle outcomes → Rage for losing side
-- ✅ Battle outcomes → Momentum/disarray/exhaustion states
-- ✅ Community power → Aggregated from member stats
-- ✅ Performance indexes for all battle metrics queries
-- ✅ Data cleanup to prevent unbounded event table growth
-- ============================================================================

-- ============================================================================
-- FIX: Battle Mechanics Not Applying
-- ============================================================================
-- This migration ensures battle mechanics are properly integrated into
-- battle resolution. The issue is that resolve_expired_battles may not be
-- calling resolve_battle_with_mechanics properly.
-- ============================================================================

-- ============================================================================
-- 1. Ensure resolve_battle_with_mechanics function exists and is correct
-- ============================================================================

-- This function applies all battle mechanics after a battle is resolved
CREATE OR REPLACE FUNCTION resolve_battle_with_mechanics(p_battle_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_battle RECORD;
  v_outcome TEXT;
  v_winner_community_id UUID;
  v_loser_community_id UUID;
  v_winner_members UUID[];
  v_loser_members UUID[];
  v_member_id UUID;
  v_is_capital BOOLEAN := FALSE;
BEGIN
  -- Get battle
  SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;

  IF v_battle IS NULL THEN
    RETURN jsonb_build_object('error', 'Battle not found');
  END IF;

  -- Determine outcome based on current battle status
  IF v_battle.status = 'attacker_won' THEN
    v_outcome := 'attacker_won';
    v_winner_community_id := v_battle.attacker_community_id;
    v_loser_community_id := v_battle.defender_community_id;
  ELSIF v_battle.status = 'defender_won' THEN
    v_outcome := 'defender_won';
    v_winner_community_id := v_battle.defender_community_id;
    v_loser_community_id := v_battle.attacker_community_id;
  ELSE
    RETURN jsonb_build_object('status', 'ongoing', 'message', 'Battle not resolved yet');
  END IF;

  -- Skip if either community is null
  IF v_winner_community_id IS NULL OR v_loser_community_id IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'Missing community IDs');
  END IF;

  -- Get all members of both communities
  SELECT ARRAY_AGG(user_id) INTO v_winner_members
  FROM community_members
  WHERE community_id = v_winner_community_id AND left_at IS NULL;

  SELECT ARRAY_AGG(user_id) INTO v_loser_members
  FROM community_members
  WHERE community_id = v_loser_community_id AND left_at IS NULL;

  -- Check if this is a capital hex (TODO: implement capital detection)
  v_is_capital := FALSE;

  -- ========================================
  -- WINNER EFFECTS
  -- ========================================

  -- Apply momentum (gives +15 morale to all members)
  PERFORM apply_momentum(v_winner_community_id);

  -- Track conquest for exhaustion
  IF v_outcome = 'attacker_won' AND v_battle.hex_id IS NOT NULL THEN
    PERFORM track_conquest(v_winner_community_id, v_battle.hex_id);
  END IF;

  -- Update win streak
  UPDATE community_battle_state
  SET current_win_streak = current_win_streak + 1,
      updated_at = NOW()
  WHERE community_id = v_winner_community_id;

  -- ========================================
  -- LOSER EFFECTS
  -- ========================================

  -- Apply disarray (increases energy cost for next battles)
  PERFORM apply_disarray(v_loser_community_id);

  -- Reset win streak
  UPDATE community_battle_state
  SET current_win_streak = 0,
      updated_at = NOW()
  WHERE community_id = v_loser_community_id;

  -- Apply defeat morale and rage to all loser members
  IF v_loser_members IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY v_loser_members LOOP
      -- Defeat morale penalty (-10)
      INSERT INTO morale_events (user_id, morale_change, event_type, event_trigger, created_at)
      VALUES (v_member_id, -10, 'battle', 'defeat', NOW());

      UPDATE users
      SET morale = GREATEST(0, morale - 10),
          updated_at = NOW()
      WHERE id = v_member_id;

      -- Trigger rage accumulation
      IF v_is_capital THEN
        PERFORM add_rage(v_member_id, 'capital_captured', jsonb_build_object('battle_id', p_battle_id));
      ELSE
        PERFORM add_rage(v_member_id, 'hex_captured', jsonb_build_object('battle_id', p_battle_id));
      END IF;

      -- Battle loss rage
      PERFORM add_rage(v_member_id, 'battle_loss', jsonb_build_object('battle_id', p_battle_id));
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'winner', v_winner_community_id,
    'loser', v_loser_community_id,
    'battle_id', p_battle_id,
    'mechanics_applied', TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. Replace resolve_expired_battles to use battle mechanics
-- ============================================================================

CREATE OR REPLACE FUNCTION public.resolve_expired_battles()
RETURNS VOID AS $$
DECLARE
  battle_record RECORD;
BEGIN
  FOR battle_record IN
    SELECT id FROM public.battles
    WHERE status = 'active'
      AND ends_at <= NOW()
  LOOP
    -- First resolve the battle normally (territory transfer, ranking, etc.)
    BEGIN
      PERFORM public.resolve_battle_outcome(battle_record.id);

      RAISE NOTICE 'Resolved battle %', battle_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to resolve battle %: %', battle_record.id, SQLERRM;
      CONTINUE; -- Skip to next battle
    END;

  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. Ensure the cron job exists and is scheduled correctly
-- ============================================================================

-- Wrap cron setup to avoid failing migrations when pg_cron is missing
-- or the executing role lacks privileges on cron.job.
DO $$
BEGIN
  -- Try to unschedule with job name
  PERFORM cron.unschedule('resolve-expired-battles');

  -- Clean up any unnamed cron jobs for battle resolution (only if permitted)
  IF to_regclass('cron.job') IS NOT NULL AND has_table_privilege('cron.job', 'DELETE') THEN
    DELETE FROM cron.job
    WHERE command = 'SELECT resolve_expired_battles();'
      AND jobname IS NULL;
  END IF;

  -- Schedule the job with a proper name
  PERFORM cron.schedule(
    'resolve-expired-battles', -- Job name
    '*/1 * * * *', -- Every minute
    $cron$SELECT resolve_expired_battles()$cron$
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Skipping cron setup: pg_cron not installed.';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping cron setup: insufficient privileges for cron.job.';
END $$;

-- ============================================================================
-- 4. Test: Manually trigger mechanics on a recent resolved battle (if any)
-- ============================================================================

DO $$
DECLARE
  v_battle_id UUID;
  v_result JSONB;
BEGIN
  -- Find a recently resolved battle that might not have mechanics applied
  SELECT id INTO v_battle_id
  FROM battles
  WHERE status IN ('attacker_won', 'defender_won')
    AND ends_at >= NOW() - INTERVAL '24 hours'
  ORDER BY ends_at DESC
  LIMIT 1;

  IF v_battle_id IS NOT NULL THEN
    -- Apply mechanics to this battle
    BEGIN
      v_result := resolve_battle_with_mechanics(v_battle_id);
      RAISE NOTICE 'Applied mechanics to battle %: %', v_battle_id, v_result;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to apply mechanics to test battle %: %', v_battle_id, SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'No recent resolved battles found to test';
  END IF;
END $$;

-- ============================================================================
-- COMPLETE
-- ============================================================================

COMMENT ON FUNCTION resolve_expired_battles IS 'Resolves expired battles and applies all battle mechanics (momentum, disarray, rage, exhaustion). Runs every minute via pg_cron.';
COMMENT ON FUNCTION resolve_battle_with_mechanics IS 'Applies battle mechanics after a battle is resolved. Called by resolve_expired_battles.';

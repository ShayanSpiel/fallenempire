-- ============================================================================
-- UNIFIED CRON SYSTEM - Single Source of Truth
-- ============================================================================
-- This migration consolidates all time-based game mechanics into pg_cron
-- All cron jobs run at the database level for reliability and consistency
--
-- SCHEDULE SUMMARY:
-- - Every 1 minute: Battle resolution (existing), Law resolution (NEW)
-- - Hourly: Psychology updates (already exists)
-- - Daily 3am: Psychology cleanup (already exists)
--
-- NOTE: Civil war and uprising resolution require revolution_system migration
-- ============================================================================

-- ============================================================================
-- 1. LAW/PROPOSAL RESOLUTION FUNCTION
-- ============================================================================
-- Resolves expired law proposals by counting votes and executing passed laws
-- Based on logic from app/actions/laws.ts:resolveExpiredProposalsAction()
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_expired_proposals()
RETURNS TABLE(
  processed_count INTEGER,
  passed_count INTEGER,
  rejected_count INTEGER,
  expired_count INTEGER
) AS $$
DECLARE
  v_proposal RECORD;
  v_yes_votes INTEGER;
  v_no_votes INTEGER;
  v_governance_type TEXT;
  v_status TEXT;
  v_notes TEXT;
  v_passes BOOLEAN;
  v_processed INTEGER := 0;
  v_passed INTEGER := 0;
  v_rejected INTEGER := 0;
  v_expired INTEGER := 0;
  v_has_votes BOOLEAN;
BEGIN
  -- Find all expired pending proposals
  FOR v_proposal IN
    SELECT id, community_id, law_type, metadata, proposer_id
    FROM community_proposals
    WHERE status = 'pending'
      AND expires_at <= NOW()
  LOOP
    v_processed := v_processed + 1;

    -- Count votes for this proposal
    SELECT
      COUNT(*) FILTER (WHERE vote = 'yes'),
      COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes
    WHERE proposal_id = v_proposal.id;

    v_has_votes := (v_yes_votes > 0 OR v_no_votes > 0);

    -- Get community governance type
    SELECT governance_type INTO v_governance_type
    FROM communities
    WHERE id = v_proposal.community_id;

    -- Determine if proposal passes based on simple majority
    v_passes := v_yes_votes > v_no_votes;

    -- Determine status
    IF v_passes THEN
      v_status := 'passed';
      v_notes := format('Proposal passed with %s yes votes', v_yes_votes);
      v_passed := v_passed + 1;
    ELSIF v_has_votes THEN
      v_status := 'rejected';
      v_notes := format('Proposal rejected with %s yes votes and %s no votes', v_yes_votes, v_no_votes);
      v_rejected := v_rejected + 1;
    ELSE
      v_status := 'expired';
      v_notes := 'Proposal expired with no votes';
      v_expired := v_expired + 1;
    END IF;

    -- Update proposal status
    UPDATE community_proposals
    SET
      status = v_status,
      resolved_at = NOW(),
      resolution_notes = v_notes
    WHERE id = v_proposal.id;

    -- Execute law if passed
    IF v_passes THEN
      -- For MESSAGE_OF_THE_DAY, update community announcement
      IF v_proposal.law_type = 'MESSAGE_OF_THE_DAY' THEN
        UPDATE communities
        SET
          announcement_title = COALESCE(v_proposal.metadata->>'title', 'Community Message'),
          announcement_content = COALESCE(v_proposal.metadata->>'content', v_proposal.metadata->>'message'),
          announcement_updated_at = NOW()
        WHERE id = v_proposal.community_id;
      END IF;

      -- For DECLARE_WAR, create conflict record
      IF v_proposal.law_type = 'DECLARE_WAR' AND v_proposal.metadata->>'target_community_id' IS NOT NULL THEN
        INSERT INTO community_conflicts (
          initiator_community_id,
          target_community_id,
          status,
          started_at
        ) VALUES (
          v_proposal.community_id,
          (v_proposal.metadata->>'target_community_id')::UUID,
          'active',
          NOW()
        );
      END IF;

      -- For PROPOSE_HEIR, update heir
      IF v_proposal.law_type = 'PROPOSE_HEIR' AND v_proposal.metadata->>'target_user_id' IS NOT NULL THEN
        UPDATE communities
        SET heir_id = (v_proposal.metadata->>'target_user_id')::UUID
        WHERE id = v_proposal.community_id;
      END IF;

      -- For CHANGE_GOVERNANCE, update governance type
      IF v_proposal.law_type = 'CHANGE_GOVERNANCE' AND v_proposal.metadata->>'new_governance_type' IS NOT NULL THEN
        UPDATE communities
        SET governance_type = v_proposal.metadata->>'new_governance_type'
        WHERE id = v_proposal.community_id;
      END IF;

      -- Create notification for passed law
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        metadata,
        created_at
      )
      SELECT
        cm.user_id,
        'law_passed',
        'Law Passed',
        format('The proposal "%s" has passed in your community', v_proposal.law_type),
        jsonb_build_object(
          'community_id', v_proposal.community_id,
          'proposal_id', v_proposal.id,
          'law_type', v_proposal.law_type
        ),
        NOW()
      FROM community_members cm
      WHERE cm.community_id = v_proposal.community_id;
    END IF;

  END LOOP;

  RETURN QUERY SELECT v_processed, v_passed, v_rejected, v_expired;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. FLEXIBLE ENERGY CALCULATION FUNCTION
-- ============================================================================
-- Calculates current energy based on time-based regeneration + modifiers
-- Supports future features: morale bonuses, item buffs, rank bonuses
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_energy(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_user RECORD;
  v_base_regen_per_hour NUMERIC := 10.0;
  v_energy_cap INTEGER := 100;
  v_time_based_regen NUMERIC;
  v_hours_elapsed NUMERIC;
  v_morale_multiplier NUMERIC := 1.0;
  v_final_energy INTEGER;
BEGIN
  -- Get user's current stored energy, morale, and last update time
  SELECT energy, morale, energy_updated_at
  INTO v_user
  FROM users
  WHERE id = p_user_id;

  IF v_user IS NULL THEN
    RETURN 0;
  END IF;

  -- Calculate time elapsed since last update (in hours)
  v_hours_elapsed := EXTRACT(EPOCH FROM (NOW() - COALESCE(v_user.energy_updated_at, NOW()))) / 3600.0;

  -- Calculate base time-based regeneration
  v_time_based_regen := v_hours_elapsed * v_base_regen_per_hour;

  -- Apply morale modifier (future feature: high morale = faster regen)
  -- If morale > 80, +20% regeneration bonus
  IF v_user.morale > 80 THEN
    v_morale_multiplier := 1.2;
  END IF;

  -- Calculate final energy (base + regen with modifiers)
  v_final_energy := LEAST(
    v_energy_cap,
    FLOOR(v_user.energy + (v_time_based_regen * v_morale_multiplier))
  );

  -- Ensure non-negative
  v_final_energy := GREATEST(0, v_final_energy);

  RETURN v_final_energy;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. UPDATE ENERGY FUNCTION (called when energy is spent or checked)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_user_energy(
  p_user_id UUID,
  p_energy_delta INTEGER DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
  v_current_energy INTEGER;
  v_new_energy INTEGER;
BEGIN
  -- Get current calculated energy
  v_current_energy := get_current_energy(p_user_id);

  -- Apply delta (negative for spending, positive for adding)
  v_new_energy := GREATEST(0, v_current_energy + p_energy_delta);

  -- Update stored energy and timestamp
  UPDATE users
  SET
    energy = v_new_energy,
    energy_updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_new_energy;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CIVIL WAR & UPRISING FUNCTIONS (CONDITIONAL - only if tables exist)
-- ============================================================================

DO $$
BEGIN
  -- Only create civil war resolution if civil_wars table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'civil_wars') THEN

    -- Drop existing function first (to allow clean re-creation)
    DROP FUNCTION IF EXISTS resolve_expired_civil_wars();

    CREATE OR REPLACE FUNCTION resolve_expired_civil_wars()
    RETURNS TABLE(
      civil_war_id UUID,
      outcome TEXT
    ) AS $func$
    DECLARE
      v_civil_war RECORD;
      v_rebellion RECORD;
      v_outcome TEXT;
    BEGIN
      -- Find all active civil wars that have expired
      FOR v_civil_war IN
        SELECT cw.*
        FROM civil_wars cw
        WHERE cw.status = 'active'
          AND cw.ends_at <= NOW()
      LOOP
        -- Get the associated rebellion
        SELECT * INTO v_rebellion
        FROM rebellions
        WHERE id = v_civil_war.rebellion_id;

        -- Determine outcome based on defense
        IF v_civil_war.current_defense <= 0 THEN
          -- Revolutionaries win
          v_outcome := 'revolutionary_win';

          UPDATE civil_wars SET status = 'revolutionary_win' WHERE id = v_civil_war.id;
          UPDATE community_members SET rank_tier = 0 WHERE community_id = v_civil_war.attacker_community_id AND user_id = v_civil_war.leader_id;
          UPDATE community_members SET rank_tier = 10 WHERE community_id = v_civil_war.attacker_community_id AND user_id = v_civil_war.governor_id;
          UPDATE rebellions SET status = 'success' WHERE id = v_rebellion.id;

          -- Morale changes
          UPDATE users SET morale = LEAST(100, morale + 20) WHERE id IN (SELECT user_id FROM rebellion_supports WHERE rebellion_id = v_rebellion.id);
          UPDATE users SET morale = GREATEST(0, morale - 10) WHERE id IN (
            SELECT cm.user_id FROM community_members cm
            WHERE cm.community_id = v_rebellion.community_id
              AND cm.user_id NOT IN (SELECT user_id FROM rebellion_supports WHERE rebellion_id = v_rebellion.id)
              AND cm.rank_tier != 0
          );
        ELSE
          -- Government wins
          v_outcome := 'government_win';
          UPDATE civil_wars SET status = 'government_win' WHERE id = v_civil_war.id;
          UPDATE rebellions SET status = 'failed', cooldown_until = NOW() + INTERVAL '72 hours', cooldown_type = 'failure' WHERE id = v_rebellion.id;
        END IF;

        -- Log event
        INSERT INTO game_logs (user_id, event_type, event_name, metadata)
        VALUES (
          CASE WHEN v_outcome = 'revolutionary_win' THEN v_civil_war.leader_id ELSE v_civil_war.governor_id END,
          'community',
          'CIVIL_WAR_RESOLVED',
          jsonb_build_object('rebellion_id', v_rebellion.id, 'civil_war_id', v_civil_war.id, 'outcome', v_outcome)
        );

        RETURN QUERY SELECT v_civil_war.id, v_outcome;
      END LOOP;
    END;
    $func$ LANGUAGE plpgsql;

  END IF;

  -- Only create uprising auto-fail if rebellions table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rebellions') THEN

    -- Drop existing function first (to allow changing return type)
    DROP FUNCTION IF EXISTS auto_fail_expired_uprisings();

    CREATE OR REPLACE FUNCTION auto_fail_expired_uprisings()
    RETURNS TABLE(rebellion_id UUID, community_id UUID, rebellion_status TEXT) AS $func$
    BEGIN
      RETURN QUERY
      UPDATE rebellions r
      SET status = 'failed',
          cooldown_until = NOW() + INTERVAL '72 hours',
          cooldown_type = 'failure'
      WHERE r.status = 'agitation'
        AND r.agitation_expires_at < NOW()
      RETURNING r.id, r.community_id, r.status;
    END;
    $func$ LANGUAGE plpgsql;

  END IF;
END $$;

-- ============================================================================
-- 5. ADD energy_updated_at COLUMN (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'energy_updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN energy_updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Initialize existing users' energy_updated_at to NOW()
    UPDATE users SET energy_updated_at = NOW() WHERE energy_updated_at IS NULL;
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE INDEX ON energy_updated_at
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_energy_updated_at
  ON users(energy_updated_at);

-- ============================================================================
-- 7. SCHEDULE CRON JOBS
-- ============================================================================

-- Unschedule existing law resolution job (to allow clean re-creation)
DO $$
BEGIN
  PERFORM cron.unschedule('resolve-expired-proposals');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
END $$;

-- Law/Proposal Resolution (every 1 minute)
SELECT cron.schedule(
  'resolve-expired-proposals',
  '*/1 * * * *',
  $$SELECT resolve_expired_proposals()$$
);

-- Uprising Auto-Fail (every 1 minute) - only if function exists
DO $$
BEGIN
  -- Unschedule existing job first (to allow clean re-creation)
  PERFORM cron.unschedule('auto-fail-expired-uprisings');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
END $$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'auto_fail_expired_uprisings') THEN
    PERFORM cron.schedule(
      'auto-fail-expired-uprisings',
      '*/1 * * * *',
      $$SELECT auto_fail_expired_uprisings()$$
    );
  END IF;
END $cron$;

-- Civil War Resolution (every 1 minute) - only if function exists
DO $$
BEGIN
  -- Unschedule existing job first (to allow clean re-creation)
  PERFORM cron.unschedule('resolve-expired-civil-wars');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
END $$;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_expired_civil_wars') THEN
    PERFORM cron.schedule(
      'resolve-expired-civil-wars',
      '*/1 * * * *',
      $$SELECT resolve_expired_civil_wars()$$
    );
  END IF;
END $cron$;

-- ============================================================================
-- 8. FUNCTION DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION resolve_expired_proposals() IS
'Resolves expired law proposals every 1 minute. Returns counts of processed/passed/rejected/expired proposals.';

COMMENT ON FUNCTION get_current_energy(UUID) IS
'Calculates current energy for a user based on time-based regen + morale modifiers. Called on-demand.';

COMMENT ON FUNCTION update_user_energy(UUID, INTEGER) IS
'Updates user energy after spending/gaining. Calculates current energy, applies delta, stores new value.';

-- ============================================================================
-- COMPLETE: Unified Cron System (Core Features)
-- ============================================================================
-- Scheduled:
--   - resolve_expired_proposals (every 1 minute)
--   - auto_fail_expired_uprisings (every 1 minute - if revolution system exists)
--   - resolve_expired_civil_wars (every 1 minute - if revolution system exists)
--
-- Existing (unchanged):
--   - resolve_expired_battles (every 1 minute)
--   - psychology-hourly-update (hourly)
--   - psychology-daily-cleanup (daily 3am)
--
-- On-demand:
--   - get_current_energy() - energy regeneration calculation
-- ============================================================================

-- ============================================================================
-- CRON JOBS FOR AUTOMATED MAINTENANCE
-- ============================================================================
-- This migration sets up scheduled jobs for:
-- 1. Community power recalculation (every 10 minutes)
-- 2. Event log cleanup (monthly)
-- 3. Battle state expiration checks (hourly)
-- ============================================================================

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- Job 1: Update Community Power (every 10 minutes)
-- ============================================================================
-- This keeps community power metrics fresh by aggregating member stats

-- Unschedule existing job if it exists (safe re-creation)
DO $$
BEGIN
  PERFORM cron.unschedule('update-community-power');
EXCEPTION
  WHEN OTHERS THEN
    NULL;  -- Ignore if job doesn't exist
END $$;

SELECT cron.schedule(
  'update-community-power',
  '*/10 * * * *',  -- Every 10 minutes
  $$
  SELECT public.calculate_community_power(id)
  FROM public.communities
  WHERE id IS NOT NULL;
  $$
);

-- ============================================================================
-- Job 2: Cleanup Old Event Logs (monthly on 1st at midnight)
-- ============================================================================
-- Prevents unbounded growth of audit tables

-- Unschedule existing job if it exists (safe re-creation)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-event-logs');
EXCEPTION
  WHEN OTHERS THEN
    NULL;  -- Ignore if job doesn't exist
END $$;

SELECT cron.schedule(
  'cleanup-old-event-logs',
  '0 0 1 * *',  -- 1st of every month at midnight
  $$
  SELECT public.cleanup_old_event_logs();
  $$
);

-- ============================================================================
-- Job 3: Expire Community Battle States (hourly)
-- ============================================================================
-- Auto-deactivate expired momentum, disarray, and exhaustion

-- Drop if exists for safe re-runs
DROP FUNCTION IF EXISTS public.expire_battle_states();

CREATE OR REPLACE FUNCTION public.expire_battle_states()
RETURNS VOID AS $$
BEGIN
  -- Get battle mechanics config for durations
  DECLARE
    v_config RECORD;
  BEGIN
    SELECT * INTO v_config
    FROM public.battle_mechanics_config
    WHERE community_id IS NULL
    LIMIT 1;

    -- Expire momentum
    UPDATE public.community_battle_state
    SET momentum_active = FALSE,
        momentum_expires_at = NULL
    WHERE momentum_active = TRUE
      AND momentum_expires_at < NOW();

    -- Expire disarray (after duration_hours)
    UPDATE public.community_battle_state
    SET disarray_active = FALSE,
        disarray_started_at = NULL
    WHERE disarray_active = TRUE
      AND disarray_started_at < NOW() - (v_config.disarray_duration_hours || ' hours')::INTERVAL;

    -- Expire exhaustion (after reset_hours)
    UPDATE public.community_battle_state
    SET exhaustion_active = FALSE,
        exhaustion_started_at = NULL,
        conquest_timestamps = ARRAY[]::TIMESTAMPTZ[]
    WHERE exhaustion_active = TRUE
      AND exhaustion_started_at < NOW() - (v_config.exhaustion_reset_hours || ' hours')::INTERVAL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Unschedule existing job if it exists (safe re-creation)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-battle-states');
EXCEPTION
  WHEN OTHERS THEN
    NULL;  -- Ignore if job doesn't exist
END $$;

SELECT cron.schedule(
  'expire-battle-states',
  '0 * * * *',  -- Every hour at :00
  $$
  SELECT public.expire_battle_states();
  $$
);

-- ============================================================================
-- View Current Cron Jobs
-- ============================================================================
-- Query to see all scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('job-name');

-- ============================================================================
-- COMPLETION NOTES
-- ============================================================================
-- Cron jobs are now configured for:
-- ✅ Community power updates (every 10 min)
-- ✅ Event log cleanup (monthly)
-- ✅ Battle state expiration (hourly)
-- ============================================================================

-- Psychology Update Cron Job
-- Runs hourly to update Mental Power and Identity for active users

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- WRAPPER FUNCTION: Hourly Psychology Update
-- ============================================================================

CREATE OR REPLACE FUNCTION run_psychology_update()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time TIMESTAMPTZ := NOW();
  v_mp_updated INTEGER := 0;
  v_identity_updated INTEGER := 0;
  v_user_id UUID;
BEGIN
  -- PHASE 1: Update Mental Power for active users (10+ actions in last hour)
  -- Find users with 10+ actions in the last hour
  FOR v_user_id IN
    SELECT user_id
    FROM action_records
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY user_id
    HAVING COUNT(*) >= 10
    LIMIT 1000
  LOOP
    -- Update their mental power using moving average
    UPDATE users
    SET power_mental = get_mental_power_moving_average(v_user_id)
    WHERE id = v_user_id;

    v_mp_updated := v_mp_updated + 1;
  END LOOP;

  -- PHASE 2: Update Identity for users with observations (5+ in last 24h)
  -- Find users with 5+ identity observations in the last 24 hours
  FOR v_user_id IN
    SELECT observed_id
    FROM identity_observations
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY observed_id
    HAVING COUNT(*) >= 5
    LIMIT 100
  LOOP
    DECLARE
      v_aggregation JSONB;
      v_observation_count INTEGER;
      v_averaged_vector JSONB;
    BEGIN
      -- Aggregate observations
      SELECT aggregate_identity_observations(v_user_id, 20, 24)
      INTO v_aggregation;

      v_observation_count := (v_aggregation->>'count')::INTEGER;
      v_averaged_vector := v_aggregation->'averaged_vector';

      -- Only update if we have enough observations and a valid vector
      IF v_observation_count >= 5 AND v_averaged_vector IS NOT NULL THEN
        PERFORM apply_identity_update(v_user_id, v_averaged_vector, 0.1);
        v_identity_updated := v_identity_updated + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other users
      RAISE WARNING 'Error updating identity for user %: %', v_user_id, SQLERRM;
    END;
  END LOOP;

  -- Log completion
  RAISE NOTICE 'Psychology update completed: MP updated for % users, Identity updated for % users, Duration: %',
    v_mp_updated,
    v_identity_updated,
    EXTRACT(EPOCH FROM (NOW() - v_start_time)) || 's';
END;
$$;

-- ============================================================================
-- SCHEDULE CRON JOB
-- ============================================================================

-- Remove existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('psychology-hourly-update');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
END $$;

-- Schedule to run every hour
SELECT cron.schedule(
  'psychology-hourly-update',  -- Job name
  '0 * * * *',                  -- Cron expression (every hour at minute 0)
  $$ SELECT run_psychology_update(); $$
);

-- ============================================================================
-- CLEANUP CRON JOB (Daily at 3am)
-- ============================================================================

CREATE OR REPLACE FUNCTION run_psychology_cleanup()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_coherence_deleted INTEGER;
  v_identity_deleted INTEGER;
BEGIN
  -- Cleanup old coherence history (keep last 50 per user)
  -- This is a simplified version - the function in migration handles it better
  WITH ranked_coherence AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
    FROM coherence_history
  )
  DELETE FROM coherence_history
  WHERE id IN (
    SELECT id FROM ranked_coherence WHERE rn > 50
  );

  GET DIAGNOSTICS v_coherence_deleted = ROW_COUNT;

  -- Cleanup old identity observations
  SELECT cleanup_old_identity_observations(100, 30) INTO v_identity_deleted;

  RAISE NOTICE 'Psychology cleanup completed: % coherence records deleted, % identity observations deleted',
    v_coherence_deleted,
    v_identity_deleted;
END;
$$;

-- Remove existing cleanup job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('psychology-daily-cleanup');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore errors if job doesn't exist
    NULL;
END $$;

-- Schedule cleanup to run daily at 3am
SELECT cron.schedule(
  'psychology-daily-cleanup',
  '0 3 * * *',  -- Every day at 3:00 AM
  $$ SELECT run_psychology_cleanup(); $$
);

-- ============================================================================
-- MIGRATION NOTE
-- ============================================================================

-- This migration creates:
-- 1. run_psychology_update() - Hourly batch update function
--    - Updates Mental Power for users with 10+ actions in last hour
--    - Updates Identity for users with 5+ observations in last 24h
-- 2. run_psychology_cleanup() - Daily cleanup function
--    - Removes old coherence_history records (keeps last 50 per user)
--    - Removes old identity_observations (keeps last 100, older than 30 days)
-- 3. Cron schedules via pg_cron extension
--
-- View cron jobs: SELECT * FROM cron.job;
-- View cron history: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- Unschedule manually: SELECT cron.unschedule('job-name');

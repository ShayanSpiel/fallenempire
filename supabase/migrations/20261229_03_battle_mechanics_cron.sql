-- Battle Mechanics System: Cron Jobs Migration
-- Version: 1.0
-- Date: December 29, 2025
-- Description: Scheduled jobs for rage decay and state cleanup

-- ============================================================================
-- 1. RAGE DECAY (Hourly)
-- ============================================================================

-- Unschedule existing rage decay job if it exists
SELECT cron.unschedule('battle-mechanics-rage-decay')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'battle-mechanics-rage-decay'
);

-- Schedule rage decay to run every hour
SELECT cron.schedule(
  'battle-mechanics-rage-decay',
  '0 * * * *', -- Every hour at :00
  $$
  SELECT decay_rage();
  $$
);

-- ============================================================================
-- 2. STATE CLEANUP (Hourly)
-- ============================================================================

-- Function to clean up expired states
CREATE OR REPLACE FUNCTION cleanup_battle_mechanics_states()
RETURNS TABLE(
  disarray_cleared INT,
  momentum_cleared INT,
  exhaustion_checked INT
) AS $$
DECLARE
  v_disarray_cleared INT := 0;
  v_momentum_cleared INT := 0;
  v_exhaustion_checked INT := 0;
  v_community RECORD;
BEGIN
  -- Clean up expired disarray states
  FOR v_community IN
    SELECT community_id, disarray_started_at
    FROM community_battle_state
    WHERE disarray_active = TRUE
  LOOP
    -- Check via function (will auto-clear if expired)
    PERFORM get_disarray_multiplier(v_community.community_id);

    -- Check if it was cleared
    IF NOT EXISTS (
      SELECT 1 FROM community_battle_state
      WHERE community_id = v_community.community_id AND disarray_active = TRUE
    ) THEN
      v_disarray_cleared := v_disarray_cleared + 1;
    END IF;
  END LOOP;

  -- Clean up expired momentum states
  FOR v_community IN
    SELECT community_id, momentum_expires_at
    FROM community_battle_state
    WHERE momentum_active = TRUE
  LOOP
    -- Check via function (will auto-clear if expired)
    PERFORM is_momentum_active(v_community.community_id);

    -- Check if it was cleared
    IF NOT EXISTS (
      SELECT 1 FROM community_battle_state
      WHERE community_id = v_community.community_id AND momentum_active = TRUE
    ) THEN
      v_momentum_cleared := v_momentum_cleared + 1;
    END IF;
  END LOOP;

  -- Check all exhaustion states
  FOR v_community IN
    SELECT community_id FROM community_battle_state
  LOOP
    PERFORM check_exhaustion_status(v_community.community_id);
    v_exhaustion_checked := v_exhaustion_checked + 1;
  END LOOP;

  RETURN QUERY SELECT v_disarray_cleared, v_momentum_cleared, v_exhaustion_checked;
END;
$$ LANGUAGE plpgsql;

-- Unschedule existing cleanup job if it exists
SELECT cron.unschedule('battle-mechanics-state-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'battle-mechanics-state-cleanup'
);

-- Schedule state cleanup to run every hour
SELECT cron.schedule(
  'battle-mechanics-state-cleanup',
  '15 * * * *', -- Every hour at :15 (offset from rage decay)
  $$
  SELECT cleanup_battle_mechanics_states();
  $$
);

-- ============================================================================
-- 3. BATTLE ACTION LOG CLEANUP (Daily)
-- ============================================================================

-- Function to clean up old battle action logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_battle_action_logs()
RETURNS TABLE(logs_deleted BIGINT) AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM battle_action_log
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Unschedule existing log cleanup job if it exists
SELECT cron.unschedule('battle-mechanics-log-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'battle-mechanics-log-cleanup'
);

-- Schedule log cleanup to run daily at 3 AM
SELECT cron.schedule(
  'battle-mechanics-log-cleanup',
  '0 3 * * *', -- Daily at 3:00 AM
  $$
  SELECT cleanup_old_battle_action_logs();
  $$
);

-- ============================================================================
-- 4. RAGE EVENTS CLEANUP (Daily)
-- ============================================================================

-- Function to clean up old rage events (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_rage_events()
RETURNS TABLE(events_deleted BIGINT) AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  DELETE FROM rage_events
  WHERE created_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Unschedule existing rage events cleanup job if it exists
SELECT cron.unschedule('battle-mechanics-rage-events-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'battle-mechanics-rage-events-cleanup'
);

-- Schedule rage events cleanup to run daily at 3:15 AM
SELECT cron.schedule(
  'battle-mechanics-rage-events-cleanup',
  '15 3 * * *', -- Daily at 3:15 AM
  $$
  SELECT cleanup_old_rage_events();
  $$
);

-- ============================================================================
-- 5. MONITORING VIEWS
-- ============================================================================

-- View to monitor cron job execution
CREATE OR REPLACE VIEW battle_mechanics_cron_status AS
SELECT
  jobname,
  schedule,
  active,
  nodename,
  database
FROM cron.job
WHERE jobname LIKE 'battle-mechanics-%'
ORDER BY jobname;

-- View to monitor current battle states
CREATE OR REPLACE VIEW battle_mechanics_active_states AS
SELECT
  c.name as community_name,
  bs.disarray_active,
  bs.disarray_started_at,
  EXTRACT(EPOCH FROM (NOW() - bs.disarray_started_at)) / 3600 as disarray_hours,
  get_disarray_multiplier(bs.community_id) as disarray_multiplier,
  bs.momentum_active,
  bs.momentum_expires_at,
  EXTRACT(EPOCH FROM (bs.momentum_expires_at - NOW())) / 3600 as momentum_hours_remaining,
  bs.exhaustion_active,
  bs.last_conquest_at,
  ARRAY_LENGTH(bs.conquest_timestamps, 1) as recent_conquests,
  bs.current_win_streak
FROM community_battle_state bs
JOIN communities c ON c.id = bs.community_id
WHERE bs.disarray_active OR bs.momentum_active OR bs.exhaustion_active
ORDER BY c.name;

-- View to monitor rage statistics
CREATE OR REPLACE VIEW battle_mechanics_rage_stats AS
SELECT
  COUNT(DISTINCT id) as users_with_rage,
  AVG(rage) as avg_rage,
  MAX(rage) as max_rage,
  MIN(rage) FILTER (WHERE rage > 0) as min_rage_nonzero,
  COUNT(*) FILTER (WHERE rage >= 50) as users_high_rage,
  COUNT(*) FILTER (WHERE rage >= 80) as users_very_high_rage
FROM users
WHERE rage > 0;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION cleanup_battle_mechanics_states IS 'Cleanup expired disarray, momentum, and check exhaustion states (runs hourly)';
COMMENT ON FUNCTION cleanup_old_battle_action_logs IS 'Delete battle action logs older than 30 days (runs daily)';
COMMENT ON FUNCTION cleanup_old_rage_events IS 'Delete rage events older than 30 days (runs daily)';

COMMENT ON VIEW battle_mechanics_cron_status IS 'Monitor status of battle mechanics cron jobs';
COMMENT ON VIEW battle_mechanics_active_states IS 'Monitor currently active battle states (disarray, momentum, exhaustion)';
COMMENT ON VIEW battle_mechanics_rage_stats IS 'Monitor rage statistics across all users';

-- ============================================================================
-- GRANT PERMISSIONS (if using RLS)
-- ============================================================================

-- Grant execute permissions on cron functions
GRANT EXECUTE ON FUNCTION decay_rage() TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_battle_mechanics_states() TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_battle_action_logs() TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_rage_events() TO postgres;

-- Grant select on monitoring views
GRANT SELECT ON battle_mechanics_cron_status TO authenticated;
GRANT SELECT ON battle_mechanics_active_states TO authenticated;
GRANT SELECT ON battle_mechanics_rage_stats TO authenticated;

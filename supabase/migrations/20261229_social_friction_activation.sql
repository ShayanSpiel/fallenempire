-- ============================================================================
-- SOCIAL FRICTION ACTIVATION MIGRATION
-- Activates community ideology → morale integration
-- ============================================================================

-- ============================================================================
-- 1. ADD FRICTION SETTINGS TO COMMUNITY_IDEOLOGY_INPUTS
-- ============================================================================

-- Add social friction configuration columns
ALTER TABLE community_ideology_inputs
ADD COLUMN IF NOT EXISTS enable_social_friction BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS friction_sensitivity NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS friction_threshold_low NUMERIC DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS friction_threshold_high NUMERIC DEFAULT 0.5;

COMMENT ON COLUMN community_ideology_inputs.enable_social_friction IS
  'Enable/disable social friction morale impacts for this community';
COMMENT ON COLUMN community_ideology_inputs.friction_sensitivity IS
  'Multiplier for friction morale impact (default 1.0)';
COMMENT ON COLUMN community_ideology_inputs.friction_threshold_low IS
  'Friction < this value = aligned (morale bonus)';
COMMENT ON COLUMN community_ideology_inputs.friction_threshold_high IS
  'Friction > this value = misaligned (morale penalty)';

-- Set default values for existing communities
UPDATE community_ideology_inputs
SET
  enable_social_friction = TRUE,
  friction_sensitivity = 1.0,
  friction_threshold_low = 0.3,
  friction_threshold_high = 0.5
WHERE enable_social_friction IS NULL;

-- ============================================================================
-- 2. ADD LAST_IDEOLOGY_RECALC COLUMN FOR DEBOUNCING
-- ============================================================================

-- Add timestamp for tracking last ideology recalculation
ALTER TABLE communities
ADD COLUMN IF NOT EXISTS last_ideology_recalc TIMESTAMPTZ;

COMMENT ON COLUMN communities.last_ideology_recalc IS
  'Timestamp of last ideology recalculation (for debouncing)';

-- ============================================================================
-- 3. OPTIMIZE INDEXES FOR SOCIAL FRICTION CRON
-- ============================================================================

-- Index for fetching active community members with identity/ideology
CREATE INDEX IF NOT EXISTS idx_community_members_active_with_data
ON community_members (community_id, left_at)
WHERE left_at IS NULL;

-- Index for morale events filtering by social friction
CREATE INDEX IF NOT EXISTS idx_morale_events_friction
ON morale_events (created_at, event_trigger)
WHERE event_trigger = 'social_friction';

-- ============================================================================
-- 4. SETUP CRON JOB FOR SOCIAL FRICTION
-- ============================================================================

-- Install pg_cron extension if not already installed
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule social friction cron job to run daily at 2:00 AM
SELECT cron.schedule(
  'social-friction-daily',
  '0 2 * * *',  -- Every day at 2:00 AM
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.api_url', true) || '/api/cron/social-friction',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
      )
    );
  $$
);

-- ============================================================================
-- 5. ADD FRICTION EVENTS AUDIT TABLE (OPTIONAL)
-- ============================================================================

-- Create table to track friction events for analytics
CREATE TABLE IF NOT EXISTS friction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  friction NUMERIC NOT NULL,
  morale_impact NUMERIC NOT NULL,
  rank_tier INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

COMMENT ON TABLE friction_events IS
  'Audit trail of social friction calculations and morale impacts';

-- Index for querying friction events by user
CREATE INDEX idx_friction_events_user ON friction_events(user_id, created_at DESC);

-- Index for querying friction events by community
CREATE INDEX idx_friction_events_community ON friction_events(community_id, created_at DESC);

-- ============================================================================
-- 6. RLS POLICIES FOR FRICTION EVENTS
-- ============================================================================

ALTER TABLE friction_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own friction events
CREATE POLICY "Users can view own friction events"
ON friction_events FOR SELECT
USING (auth.uid() = user_id);

-- Community leaders can view their community's friction events
CREATE POLICY "Leaders can view community friction events"
ON friction_events FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = friction_events.community_id
    AND user_id = auth.uid()
    AND rank_tier <= 1  -- Sovereigns and Advisors
    AND left_at IS NULL
  )
);

-- System can insert friction events (for cron job)
CREATE POLICY "System can insert friction events"
ON friction_events FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- 7. HELPER FUNCTION: GET FRICTION STATS FOR COMMUNITY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_community_friction_stats(
  p_community_id UUID,
  p_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avg_friction', COALESCE(AVG(friction), 0),
    'avg_morale_impact', COALESCE(AVG(morale_impact), 0),
    'total_events', COUNT(*),
    'members_affected', COUNT(DISTINCT user_id),
    'aligned_members', COUNT(*) FILTER (WHERE friction < 0.3),
    'misaligned_members', COUNT(*) FILTER (WHERE friction > 0.5)
  )
  INTO v_result
  FROM friction_events
  WHERE community_id = p_community_id
  AND created_at > NOW() - (p_hours || ' hours')::INTERVAL;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

COMMENT ON FUNCTION get_community_friction_stats IS
  'Get friction statistics for a community over the last N hours';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Social Friction Activation Migration Complete';
  RAISE NOTICE 'Features enabled:';
  RAISE NOTICE '  ✓ Friction settings added to community_ideology_inputs';
  RAISE NOTICE '  ✓ Debouncing column added to communities';
  RAISE NOTICE '  ✓ Performance indexes created';
  RAISE NOTICE '  ✓ Cron job scheduled (daily 2:00 AM)';
  RAISE NOTICE '  ✓ Friction events audit table created';
  RAISE NOTICE '  ✓ RLS policies configured';
  RAISE NOTICE '  ✓ Helper functions added';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Set app.settings.api_url and app.settings.cron_secret';
  RAISE NOTICE '  2. Deploy cron endpoint: /api/cron/social-friction';
  RAISE NOTICE '  3. Test with: SELECT * FROM cron.job WHERE jobname = ''social-friction-daily''';
END $$;

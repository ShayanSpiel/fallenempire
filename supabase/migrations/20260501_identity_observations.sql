-- Identity Observations System
-- Stores AI-generated identity shift suggestions based on user actions and content

-- ============================================================================
-- NEW TABLE: Identity Observations
-- ============================================================================

CREATE TABLE IF NOT EXISTS identity_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  observed_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_identity_vector JSONB NOT NULL,
  confidence NUMERIC DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  context TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_identity_observations_observed
  ON identity_observations(observed_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_observations_observer
  ON identity_observations(observer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_observations_recent
  ON identity_observations(created_at DESC);

-- ============================================================================
-- FUNCTION: Aggregate Identity Observations
-- ============================================================================

CREATE OR REPLACE FUNCTION aggregate_identity_observations(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS JSONB AS $$
DECLARE
  v_observations JSONB;
  v_avg_vector JSONB;
  v_count INTEGER;
  v_cutoff_time TIMESTAMPTZ;
BEGIN
  -- Calculate cutoff time
  v_cutoff_time := NOW() - (p_hours_back || ' hours')::INTERVAL;

  -- Get recent observations
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'observer_id', observer_id,
        'suggested_vector', suggested_identity_vector,
        'confidence', confidence,
        'context', context,
        'created_at', created_at
      )
    ),
    COUNT(*)
  INTO v_observations, v_count
  FROM (
    SELECT observer_id, suggested_identity_vector, confidence, context, created_at
    FROM identity_observations
    WHERE observed_id = p_user_id
      AND created_at >= v_cutoff_time
    ORDER BY created_at DESC
    LIMIT p_limit
  ) AS recent;

  -- If no observations, return empty result
  IF v_count IS NULL OR v_count = 0 THEN
    RETURN jsonb_build_object(
      'count', 0,
      'observations', '[]'::jsonb,
      'averaged_vector', NULL
    );
  END IF;

  -- Calculate weighted average vector
  -- Weight by confidence and recency (more recent = higher weight)
  WITH weighted_vectors AS (
    SELECT
      suggested_identity_vector,
      confidence,
      -- Recency weight: 1.0 for most recent, decaying to 0.5 for oldest
      0.5 + (0.5 * (
        EXTRACT(EPOCH FROM (created_at - v_cutoff_time)) /
        NULLIF(EXTRACT(EPOCH FROM (NOW() - v_cutoff_time)), 0)
      )) AS recency_weight
    FROM identity_observations
    WHERE observed_id = p_user_id
      AND created_at >= v_cutoff_time
    LIMIT p_limit
  ),
  trait_averages AS (
    SELECT
      AVG((suggested_identity_vector->>'order_chaos')::NUMERIC * confidence * recency_weight) /
        NULLIF(AVG(confidence * recency_weight), 0) AS order_chaos,
      AVG((suggested_identity_vector->>'self_community')::NUMERIC * confidence * recency_weight) /
        NULLIF(AVG(confidence * recency_weight), 0) AS self_community,
      AVG((suggested_identity_vector->>'logic_emotion')::NUMERIC * confidence * recency_weight) /
        NULLIF(AVG(confidence * recency_weight), 0) AS logic_emotion,
      AVG((suggested_identity_vector->>'power_harmony')::NUMERIC * confidence * recency_weight) /
        NULLIF(AVG(confidence * recency_weight), 0) AS power_harmony,
      AVG((suggested_identity_vector->>'tradition_innovation')::NUMERIC * confidence * recency_weight) /
        NULLIF(AVG(confidence * recency_weight), 0) AS tradition_innovation
    FROM weighted_vectors
  )
  SELECT jsonb_build_object(
    'order_chaos', COALESCE(order_chaos, 0),
    'self_community', COALESCE(self_community, 0),
    'logic_emotion', COALESCE(logic_emotion, 0),
    'power_harmony', COALESCE(power_harmony, 0),
    'tradition_innovation', COALESCE(tradition_innovation, 0)
  )
  INTO v_avg_vector
  FROM trait_averages;

  RETURN jsonb_build_object(
    'count', v_count,
    'observations', v_observations,
    'averaged_vector', v_avg_vector
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Apply Identity Update
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_identity_update(
  p_user_id UUID,
  p_new_identity_vector JSONB,
  p_max_shift NUMERIC DEFAULT 0.1
)
RETURNS JSONB AS $$
DECLARE
  v_current_identity JSONB;
  v_updated_identity JSONB;
  v_trait TEXT;
  v_current_val NUMERIC;
  v_new_val NUMERIC;
  v_shift NUMERIC;
  v_clamped_val NUMERIC;
BEGIN
  -- Get current identity
  SELECT identity_json INTO v_current_identity
  FROM users
  WHERE id = p_user_id;

  -- If no current identity, use default (all zeros)
  IF v_current_identity IS NULL THEN
    v_current_identity := jsonb_build_object(
      'order_chaos', 0,
      'self_community', 0,
      'logic_emotion', 0,
      'power_harmony', 0,
      'tradition_innovation', 0
    );
  END IF;

  -- Apply capped shifts for each trait
  v_updated_identity := jsonb_build_object(
    'order_chaos', 0,
    'self_community', 0,
    'logic_emotion', 0,
    'power_harmony', 0,
    'tradition_innovation', 0
  );

  FOR v_trait IN SELECT * FROM jsonb_object_keys(v_current_identity) LOOP
    v_current_val := COALESCE((v_current_identity->>v_trait)::NUMERIC, 0);
    v_new_val := COALESCE((p_new_identity_vector->>v_trait)::NUMERIC, 0);

    -- Calculate shift, capped at max_shift
    v_shift := GREATEST(-p_max_shift, LEAST(p_max_shift, v_new_val - v_current_val));

    -- Apply shift and clamp to -1.0 to 1.0
    v_clamped_val := GREATEST(-1.0, LEAST(1.0, v_current_val + v_shift));

    -- Update the trait in the result
    v_updated_identity := jsonb_set(
      v_updated_identity,
      ARRAY[v_trait],
      to_jsonb(v_clamped_val)
    );
  END LOOP;

  -- Update user's identity
  UPDATE users
  SET identity_json = v_updated_identity,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'previous_identity', v_current_identity,
    'new_identity', v_updated_identity,
    'max_shift_applied', p_max_shift
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Cleanup Old Identity Observations
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_identity_observations(
  p_keep_last_n INTEGER DEFAULT 100,
  p_older_than_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH observations_to_keep AS (
    SELECT id
    FROM (
      SELECT id,
        ROW_NUMBER() OVER (PARTITION BY observed_id ORDER BY created_at DESC) AS rn
      FROM identity_observations
      WHERE created_at >= NOW() - (p_older_than_days || ' days')::INTERVAL
    ) AS ranked
    WHERE rn <= p_keep_last_n
  )
  DELETE FROM identity_observations
  WHERE id NOT IN (SELECT id FROM observations_to_keep)
    OR created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION NOTE
-- ============================================================================

-- This migration introduces:
-- 1. identity_observations table for AI-generated identity shift suggestions
-- 2. aggregate_identity_observations() function to compute weighted average
-- 3. apply_identity_update() function to safely update identity with capped shifts
-- 4. cleanup_old_identity_observations() function for maintenance
--
-- Flow:
-- - AI agents observe users and suggest identity vectors
-- - Suggestions are stored in identity_observations with confidence scores
-- - Hourly cron aggregates recent observations (weighted by confidence + recency)
-- - If shift exceeds threshold, apply_identity_update() updates users.identity_json
-- - Old observations are periodically cleaned up
--
-- See: lib/psychology-updater.ts and lib/ai-system/workflows/*.ts

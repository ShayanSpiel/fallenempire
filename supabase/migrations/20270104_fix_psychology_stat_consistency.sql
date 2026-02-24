-- ============================================================================
-- Psychology Stat Consistency + Mental Power Updates
-- ============================================================================
-- Goals:
-- - Single source of truth: `users.power_mental` and `users.power_physical`
-- - Backwards-compatible read aliases: `users.mental_power`, `users.physical_power`
-- - Fix incorrect volatility on `get_mental_power_moving_average()` (reads tables)
-- - Ensure Mental Power updates even without pg_cron via coherence_history trigger
-- - Make hourly psychology cron resilient by updating only canonical columns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Backwards-compatible generated aliases on `public.users`
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_is_generated TEXT;
BEGIN
  -- ---- mental_power alias (generated from power_mental)
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'mental_power'
  ) THEN
    SELECT is_generated
      INTO v_is_generated
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'mental_power';

    IF COALESCE(v_is_generated, 'NEVER') <> 'ALWAYS' THEN
      -- Preserve any legacy values as the canonical value.
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'power_mental'
      ) THEN
        EXECUTE 'UPDATE public.users SET power_mental = COALESCE(mental_power, power_mental)';
        EXECUTE 'ALTER TABLE public.users DROP COLUMN mental_power';
      END IF;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'mental_power'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'power_mental'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ADD COLUMN mental_power NUMERIC GENERATED ALWAYS AS (power_mental) STORED';
  END IF;

  -- ---- physical_power alias (best-effort compatibility)
  -- Some environments have `power_physical` (0-100) while others have `physical_power` (often 0-150).
  -- To avoid breaking existing deployments, only add `physical_power` if it is missing.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'physical_power'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'power_physical'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ADD COLUMN physical_power NUMERIC GENERATED ALWAYS AS (power_physical) STORED';
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2) Mental Power moving average: correct volatility (reads coherence_history)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mental_power_moving_average(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_avg_coherence NUMERIC;
  v_mp NUMERIC;
BEGIN
  SELECT AVG(coherence) INTO v_avg_coherence
  FROM (
    SELECT coherence
    FROM public.coherence_history
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) AS recent;

  IF v_avg_coherence IS NULL THEN
    RETURN 50;
  END IF;

  v_mp := 50 + (v_avg_coherence * 50);
  RETURN GREATEST(0, LEAST(100, ROUND(v_mp)));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- 3) Keep `users.power_mental` updated on every coherence_history insert
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_power_mental_from_coherence_history()
RETURNS TRIGGER AS $$
BEGIN
  -- If the canonical column does not exist, do nothing.
  IF to_regclass('public.users') IS NULL OR to_regclass('public.coherence_history') IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.users
  SET power_mental = public.get_mental_power_moving_average(NEW.user_id)
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_coherence_history_sync_user_power_mental ON public.coherence_history;
CREATE TRIGGER trg_coherence_history_sync_user_power_mental
AFTER INSERT ON public.coherence_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_power_mental_from_coherence_history();

-- ----------------------------------------------------------------------------
-- 4) Make the hourly cron update resilient (update canonical columns only)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_psychology_update()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_time TIMESTAMPTZ := NOW();
  v_mp_updated INTEGER := 0;
  v_identity_updated INTEGER := 0;
  v_user_id UUID;
BEGIN
  -- Update Mental Power for active users (10+ actions in last hour)
  FOR v_user_id IN
    SELECT user_id
    FROM public.action_records
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY user_id
    HAVING COUNT(*) >= 10
    LIMIT 1000
  LOOP
    UPDATE public.users
    SET power_mental = public.get_mental_power_moving_average(v_user_id)
    WHERE id = v_user_id;

    v_mp_updated := v_mp_updated + 1;
  END LOOP;

  -- Identity update phase is best-effort and only runs if the identity system exists.
  IF to_regclass('public.identity_observations') IS NOT NULL
     AND to_regclass('public.users') IS NOT NULL
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'aggregate_identity_observations')
     AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_identity_update') THEN
    FOR v_user_id IN
      SELECT observed_id
      FROM public.identity_observations
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
        SELECT public.aggregate_identity_observations(v_user_id, 20, 24)
        INTO v_aggregation;

        v_observation_count := (v_aggregation->>'count')::INTEGER;
        v_averaged_vector := v_aggregation->'averaged_vector';

        IF v_observation_count >= 5 AND v_averaged_vector IS NOT NULL THEN
          PERFORM public.apply_identity_update(v_user_id, v_averaged_vector, 0.1);
          v_identity_updated := v_identity_updated + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error updating identity for user %: %', v_user_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RAISE NOTICE 'Psychology update completed: MP updated for % users, Identity updated for % users, Duration: %',
    v_mp_updated,
    v_identity_updated,
    EXTRACT(EPOCH FROM (NOW() - v_start_time)) || 's';
END;
$$;

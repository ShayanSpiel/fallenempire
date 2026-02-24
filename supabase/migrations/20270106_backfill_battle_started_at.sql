-- Backfill missing started_at values for battles
-- For battles that don't have started_at set, calculate it from ends_at - 6 hours

-- Update battles where started_at is NULL
UPDATE public.battles
SET started_at = ends_at - INTERVAL '6 hours'
WHERE started_at IS NULL;

-- Log the update
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.battles
  WHERE started_at = ends_at - INTERVAL '6 hours';

  RAISE NOTICE 'Backfilled % battles with missing started_at', updated_count;
END $$;

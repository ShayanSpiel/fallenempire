-- 1. Ensure pg_cron is available for background jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Helper to sweep expired battles and resolve their outcomes
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
    PERFORM public.resolve_battle_outcome(battle_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Schedule the job once if it does not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE command = 'SELECT resolve_expired_battles();'
  ) THEN
    PERFORM cron.schedule('*/1 * * * *', 'SELECT resolve_expired_battles();');
  END IF;
END;
$$;

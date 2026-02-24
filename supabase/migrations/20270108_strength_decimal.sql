-- =====================================================
-- ALLOW FRACTIONAL STRENGTH VALUES
-- =====================================================

-- Strength now increments by 0.1 per training session, so we need to store
-- fractional values in the database instead of rounding to integers.
DROP TRIGGER IF EXISTS trigger_update_physical_power ON public.users;
DROP FUNCTION IF EXISTS public.update_physical_power();
ALTER TABLE public.users
  ALTER COLUMN strength TYPE NUMERIC(9,3) USING strength::NUMERIC(9,3);

COMMENT ON COLUMN public.users.strength IS
'Combat strength. Gains +0.1 per daily training. Base damage = 100 × strength × rank_multiplier.';

CREATE OR REPLACE FUNCTION public.update_physical_power()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.strength IS NOT NULL THEN
    NEW.power_physical := GREATEST(0, LEAST(100, NEW.strength));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_physical_power
BEFORE INSERT OR UPDATE OF strength ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_physical_power();

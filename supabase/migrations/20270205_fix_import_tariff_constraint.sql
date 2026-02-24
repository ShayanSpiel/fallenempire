-- Fix import_tariff_rate constraint to allow NULL values
-- The CHECK constraint should only validate when the value is NOT NULL

-- Drop the old constraint
ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_import_tariff_rate_check;

-- Add new constraint that allows NULL or validates range
ALTER TABLE communities
  ADD CONSTRAINT communities_import_tariff_rate_check
  CHECK (import_tariff_rate IS NULL OR (import_tariff_rate >= 0 AND import_tariff_rate <= 1));

COMMENT ON CONSTRAINT communities_import_tariff_rate_check ON communities IS 'Import tariff rate must be NULL or between 0 and 1 (0% to 100%)';

-- ============================================================================
-- FIX: Ensure battles table has ended_at column for backward compatibility
-- ============================================================================
-- Some older functions may reference ended_at, so we ensure it exists
-- ============================================================================

-- Add ended_at column if it doesn't exist (safe to run multiple times)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'battles'
    AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.battles ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- COMPLETION NOTE
-- ============================================================================
-- This ensures backward compatibility with any functions that reference
-- battles.ended_at column. The column is optional and not actively used
-- by the latest battle resolution logic.
-- ============================================================================

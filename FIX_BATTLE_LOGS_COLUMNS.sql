-- ============================================================================
-- Fix Missing Columns in battle_logs
-- ============================================================================
-- This adds the actor_avatar_url and result columns that are missing
-- ============================================================================

-- Add actor_avatar_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battle_logs' AND column_name = 'actor_avatar_url'
  ) THEN
    ALTER TABLE public.battle_logs ADD COLUMN actor_avatar_url TEXT;
    RAISE NOTICE '✅ Added actor_avatar_url column';
  ELSE
    RAISE NOTICE '⚠️  actor_avatar_url column already exists';
  END IF;
END $$;

-- Add result column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battle_logs' AND column_name = 'result'
  ) THEN
    ALTER TABLE public.battle_logs
    ADD COLUMN result TEXT CHECK (result IN ('HIT', 'MISS', 'CRITICAL'));
    RAISE NOTICE '✅ Added result column';
  ELSE
    RAISE NOTICE '⚠️  result column already exists';
  END IF;
END $$;

-- Add user_id column if it doesn't exist (some queries use this instead of actor_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'battle_logs' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.battle_logs ADD COLUMN user_id UUID REFERENCES public.users(id);
    RAISE NOTICE '✅ Added user_id column';
  ELSE
    RAISE NOTICE '⚠️  user_id column already exists';
  END IF;
END $$;

-- Verification
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'battle_logs'
    AND column_name IN ('actor_avatar_url', 'result', 'user_id');

    RAISE NOTICE '✅ battle_logs now has % of 3 required columns', col_count;

    IF col_count = 3 THEN
        RAISE NOTICE '🎉 All columns exist!';
    END IF;
END $$;

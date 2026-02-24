-- Enable Supabase Realtime for comments (idempotent)
DO $$
BEGIN
  IF to_regclass('public.comments') IS NULL THEN
    RAISE NOTICE 'Skipping realtime enable: public.comments does not exist';
    RETURN;
  END IF;

  -- Ensure inserts/updates include full row data for realtime consumers (safe no-op if already set)
  EXECUTE 'ALTER TABLE public.comments REPLICA IDENTITY FULL';

  -- Add to realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.comments';
  END IF;
END $$;


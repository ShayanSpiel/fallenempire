-- Backfill any missing entries in public.users for existing auth accounts.

INSERT INTO public.users (auth_id, username, email, is_bot)
SELECT
  au.id AS auth_id,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data ->> 'username'), ''),
    LOWER(NULLIF(SPLIT_PART(COALESCE(au.email, ''), '@', 1), '')),
    'player-' || LEFT(au.id::text, 8)
  ) AS username,
  au.email,
  FALSE
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id
);

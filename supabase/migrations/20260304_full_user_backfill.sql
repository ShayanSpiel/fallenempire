-- Full user sync + admin role support
-- Ensures public.users has role column and backfills missing users from auth.users.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role
ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_users_auth_id
ON public.users(auth_id)
WHERE auth_id IS NOT NULL;

INSERT INTO public.users (auth_id, username, email, is_bot, role)
SELECT
  au.id AS auth_id,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data ->> 'username'), ''),
    LOWER(NULLIF(SPLIT_PART(COALESCE(au.email, ''), '@', 1), '')),
    'player-' || LEFT(au.id::text, 8)
  ) AS username,
  au.email,
  FALSE,
  'user'
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.auth_id = au.id
);

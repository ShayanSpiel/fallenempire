-- Ensure users.role exists for admin checks and legacy policies

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role
ON public.users(role);

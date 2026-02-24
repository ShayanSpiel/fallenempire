-- Create the legacy Supabase profiles table that `auth.users` triggers still reference.
-- This keeps the auth hook from failing while our app keeps using public.users for most logic.

-- 1. Table definition
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('UTC', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('UTC', NOW())
);

-- Ensure public.users has the metadata column our trigger writes into.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Trigger function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_row JSONB := row_to_json(NEW)::JSONB;
  v_metadata JSONB := COALESCE(v_row -> 'user_metadata', v_row -> 'raw_user_meta_data');
  v_username TEXT := TRIM(COALESCE(v_metadata ->> 'username', ''));
  v_email_username TEXT := LOWER(NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''));
  v_default_username TEXT := 'player-' || LEFT(NEW.id::text, 8);
  v_final_username TEXT;
BEGIN
  v_final_username := NULLIF(v_username, '');
  IF v_final_username IS NULL THEN
    v_final_username := COALESCE(v_email_username, v_default_username);
  END IF;

  INSERT INTO public.profiles (id, username, email, created_at, updated_at)
  VALUES (
    NEW.id,
    v_final_username,
    NEW.email,
    TIMEZONE('UTC', NOW()),
    TIMEZONE('UTC', NOW())
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE auth_id = NEW.id) THEN
    INSERT INTO public.users (auth_id, username, email, is_bot)
    VALUES (NEW.id, v_final_username, NEW.email, false);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger wiring

CREATE TRIGGER handle_new_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

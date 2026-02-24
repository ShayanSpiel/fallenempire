-- Fix RLS violations when auto-creating ideology inputs on community creation

CREATE OR REPLACE FUNCTION public.create_ideology_inputs_for_community()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.community_ideology_inputs (community_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

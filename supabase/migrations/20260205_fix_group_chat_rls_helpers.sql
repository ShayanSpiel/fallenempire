-- Ensure group chat RLS helper functions bypass row-level security to avoid recursion

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_conversation_participants
    WHERE group_conversation_id = p_group_id
      AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_admin(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_conversation_participants
    WHERE group_conversation_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$;

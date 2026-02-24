-- Fix infinite recursion in group chat RLS policies
-- Use SECURITY DEFINER helpers to check membership/admin without self-referential policies

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
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
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_conversation_participants
    WHERE group_conversation_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Users can view participants of groups they're in" ON public.group_conversation_participants;
DROP POLICY IF EXISTS "Group admins can manage participants" ON public.group_conversation_participants;
DROP POLICY IF EXISTS "Group admins can remove participants" ON public.group_conversation_participants;

CREATE POLICY "Users can view participants of groups they're in"
  ON public.group_conversation_participants
  FOR SELECT
  USING (
    public.is_group_member(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Group admins can manage participants"
  ON public.group_conversation_participants
  FOR INSERT
  WITH CHECK (
    public.is_group_admin(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Group admins can remove participants"
  ON public.group_conversation_participants
  FOR DELETE
  USING (
    public.is_group_admin(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view group conversations they participate in" ON public.group_conversations;
CREATE POLICY "Users can view group conversations they participate in"
  ON public.group_conversations
  FOR SELECT
  USING (
    public.is_group_member(
      id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR created_by = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

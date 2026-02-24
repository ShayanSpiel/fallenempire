-- Allow participants to remove themselves from group conversations
-- This ensures the DELETE policy permits self-removal alongside admin removals

DROP POLICY IF EXISTS "Group admins can remove participants" ON public.group_conversation_participants;
CREATE POLICY "Group admins can remove participants"
  ON public.group_conversation_participants
  FOR DELETE
  USING (
    public.is_group_admin(
      group_conversation_id,
      (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

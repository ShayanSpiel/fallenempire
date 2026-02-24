-- Allow group creators to read newly created groups before participants are inserted

DROP POLICY IF EXISTS "Users can view group conversations they participate in" ON public.group_conversations;
CREATE POLICY "Users can view group conversations they participate in"
  ON public.group_conversations
  FOR SELECT
  USING (
    id IN (
      SELECT group_conversation_id
      FROM public.group_conversation_participants
      WHERE user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
    )
    OR created_by IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

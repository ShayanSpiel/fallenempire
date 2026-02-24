-- COPY AND PASTE THIS INTO SUPABASE SQL EDITOR AND RUN

DROP POLICY IF EXISTS "Users can view community messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can insert messages in their community" ON public.community_messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.community_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.community_messages;
DROP POLICY IF EXISTS "Insert messages as authenticated user" ON public.community_messages;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_community_messages" ON public.community_messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.community_members WHERE community_members.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()) AND community_members.community_id = community_messages.community_id));

CREATE POLICY "insert_community_messages" ON public.community_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "delete_community_messages" ON public.community_messages FOR DELETE USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

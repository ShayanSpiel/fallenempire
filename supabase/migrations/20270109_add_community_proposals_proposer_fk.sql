-- Ensure Supabase/PostgREST can auto-join the proposer relationship
-- by declaring the missing foreign key between community_proposals and users.

ALTER TABLE public.community_proposals
  ADD CONSTRAINT fk_community_proposals_proposer_id_users
  FOREIGN KEY (proposer_id)
  REFERENCES public.users(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_community_proposals_proposer_id
  ON public.community_proposals (proposer_id);

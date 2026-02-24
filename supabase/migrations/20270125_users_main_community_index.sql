-- ============================================================================
-- Battle Mechanics Performance: Index users by main_community_id
-- ============================================================================
-- Querying users by their primary community (especially with rage filters)
-- was scanning the entire users table, which caused Supabase fetch
-- requests (e.g., /api/battle/mechanics/community) to hit the 10s timeout.
-- This migration adds a focused index so the query can use a fast lookup.
-- ============================================================================

-- Primary index on users.main_community_id to support frequent filters
CREATE INDEX IF NOT EXISTS idx_users_main_community_id
  ON public.users(main_community_id);

-- Optional: the rage query filters out NULL values, so this partial index
-- gives a tighter range scan when rage must exist.
CREATE INDEX IF NOT EXISTS idx_users_main_community_id_rage_not_null
  ON public.users(main_community_id)
  WHERE rage IS NOT NULL;

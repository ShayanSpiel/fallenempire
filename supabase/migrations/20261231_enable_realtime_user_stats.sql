-- ============================================================================
-- Enable Realtime for User Stats (Morale, Rage, Energy)
-- ============================================================================
-- This enables real-time updates for user stats so UI reflects changes
-- immediately when morale/rage/energy changes in battles or other actions
-- ============================================================================

-- Enable realtime for users table (if not already enabled)
-- Only broadcast changes to specific columns for performance
ALTER PUBLICATION supabase_realtime ADD TABLE users;

-- Alternative: If you want to limit which columns trigger realtime updates,
-- you would need to use row-level filters, but Supabase Realtime doesn't
-- support column-level filtering directly. The client will receive all changes
-- and can filter on their end.

-- Note: The users table already exists, we're just ensuring it's added to
-- the realtime publication. If it was already added, this is a no-op.

-- ============================================================================
-- Indexes for Real-Time Query Performance
-- ============================================================================

-- Index for auth_id lookups (used by Realtime subscriptions)
CREATE INDEX IF NOT EXISTS idx_users_auth_id_realtime
ON users(auth_id) WHERE auth_id IS NOT NULL;

-- Index for public user id lookups
CREATE INDEX IF NOT EXISTS idx_users_id_morale_rage
ON users(id) INCLUDE (morale, rage, energy, energy_updated_at);

-- ============================================================================
-- COMPLETION NOTE
-- ============================================================================
-- Users table is now enabled for Realtime updates
-- Clients can subscribe to changes using:
-- supabase
--   .channel('user-stats')
--   .on('postgres_changes', {
--     event: 'UPDATE',
--     schema: 'public',
--     table: 'users',
--     filter: `id=eq.${userId}`
--   }, (payload) => {
--     // Handle morale/rage/energy updates
--   })
--   .subscribe()
-- ============================================================================

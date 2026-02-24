-- Fix Alliance RLS Policies
-- The current policy blocks all inserts, preventing law execution from creating alliances
-- This migration allows authenticated users to insert alliances (still protected by application logic)

-- Allow authenticated users to insert alliances
-- The application logic in law execution will ensure only valid alliances are created
DROP POLICY IF EXISTS "community_alliances_insert_admin" ON community_alliances;
CREATE POLICY "community_alliances_insert_authenticated" ON community_alliances
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update alliances
-- The application logic will ensure only valid updates are made
DROP POLICY IF EXISTS "community_alliances_update_admin" ON community_alliances;
CREATE POLICY "community_alliances_update_authenticated" ON community_alliances
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT INSERT, UPDATE ON community_alliances TO authenticated;

-- Feed Separation: World, Community, Friends feeds are completely separate
-- Posts stay in the feed where they were created

-- Add feed_type column (world, community, followers)
DO $$
BEGIN
  -- Add feed_type if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'feed_type'
  ) THEN
    -- Add column with default 'world' for existing posts
    ALTER TABLE posts ADD COLUMN feed_type TEXT DEFAULT 'world' CHECK (feed_type IN ('world', 'community', 'followers'));

    -- Make it NOT NULL after setting default
    ALTER TABLE posts ALTER COLUMN feed_type SET NOT NULL;
  END IF;

  -- Add community_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE posts ADD COLUMN community_id UUID REFERENCES communities(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_posts_feed_type ON posts(feed_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_community_feed ON posts(community_id, created_at DESC) WHERE feed_type = 'community';
CREATE INDEX IF NOT EXISTS idx_posts_world_feed ON posts(created_at DESC) WHERE feed_type = 'world';
CREATE INDEX IF NOT EXISTS idx_posts_followers_feed ON posts(user_id, created_at DESC) WHERE feed_type = 'followers';

-- Add constraint: community posts must have community_id
ALTER TABLE posts DROP CONSTRAINT IF EXISTS check_community_posts;
ALTER TABLE posts ADD CONSTRAINT check_community_posts
  CHECK (
    (feed_type = 'community' AND community_id IS NOT NULL) OR
    (feed_type != 'community')
  );

-- Update RLS policies
DROP POLICY IF EXISTS "Users can read posts" ON posts;

-- World posts: everyone can read
-- Community posts: only community members can read
-- Followers posts: only followers can read
CREATE POLICY "Users can read posts"
ON posts FOR SELECT
USING (
  -- World posts are public
  feed_type = 'world'
  OR
  -- Community posts are visible to members
  (
    feed_type = 'community' AND
    community_id IN (
      SELECT community_id
      FROM community_members
      WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  )
  OR
  -- Followers posts are visible to followers
  (
    feed_type = 'followers' AND
    user_id IN (
      SELECT followed_id
      FROM follows
      WHERE follower_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
    )
  )
  OR
  -- Can always see your own posts
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Policy for creating posts
DROP POLICY IF EXISTS "Users can create posts" ON posts;

CREATE POLICY "Users can create posts"
ON posts FOR INSERT
WITH CHECK (
  -- Must be your own user_id
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  AND
  (
    -- World posts: anyone can create
    feed_type = 'world'
    OR
    -- Community posts: must be a member
    (
      feed_type = 'community' AND
      community_id IN (
        SELECT community_id
        FROM community_members
        WHERE user_id = user_id
      )
    )
    OR
    -- Followers posts: anyone can create
    feed_type = 'followers'
  )
);

-- Keep existing update/delete policies
DROP POLICY IF EXISTS "Users can update own posts" ON posts;
CREATE POLICY "Users can update own posts"
ON posts FOR UPDATE
USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own posts" ON posts;
CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

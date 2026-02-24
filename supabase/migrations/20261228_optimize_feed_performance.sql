-- =====================================================
-- FEED PERFORMANCE OPTIMIZATION MIGRATION
-- =====================================================
-- This migration adds critical indexes and RPC functions
-- to optimize feed queries from 3-10s down to <200ms

-- =====================================================
-- STEP 1: Add Missing Indexes
-- =====================================================

-- Index for comments by post_id (critical for N+1 query prevention)
CREATE INDEX IF NOT EXISTS idx_comments_post_id_created
ON comments(post_id, created_at DESC);

-- Composite index for post_reactions lookups
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_user
ON post_reactions(post_id, user_id);

-- Index for faster user lookups in reactions
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id
ON post_reactions(user_id);

-- Optimize community_members lookups by user
CREATE INDEX IF NOT EXISTS idx_community_members_user_id
ON community_members(user_id)
WHERE left_at IS NULL;

-- Optimize user_follows lookups
CREATE INDEX IF NOT EXISTS idx_user_follows_follower
ON user_follows(follower_id, followed_id);

-- =====================================================
-- STEP 2: Create Optimized Feed Query RPC Function
-- =====================================================

CREATE OR REPLACE FUNCTION get_feed_posts_optimized(
  p_user_id UUID,
  p_feed_type TEXT,
  p_limit INT DEFAULT 10,
  p_offset INT DEFAULT 0,
  p_skip_comments BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_community_ids UUID[];
  v_following_ids UUID[];
  v_result JSONB;
  v_posts JSONB;
  v_has_more BOOLEAN;
BEGIN
  -- Get user's communities and following list based on feed type
  IF p_feed_type = 'community' THEN
    SELECT ARRAY_AGG(community_id) INTO v_community_ids
    FROM community_members
    WHERE user_id = p_user_id AND left_at IS NULL;

    IF v_community_ids IS NULL OR array_length(v_community_ids, 1) = 0 THEN
      RETURN jsonb_build_object(
        'posts', '[]'::jsonb,
        'hasMore', false,
        'nextOffset', 0
      );
    END IF;
  ELSIF p_feed_type = 'friends' THEN
    SELECT ARRAY_AGG(followed_id) INTO v_following_ids
    FROM user_follows
    WHERE follower_id = p_user_id;

    IF v_following_ids IS NULL OR array_length(v_following_ids, 1) = 0 THEN
      RETURN jsonb_build_object(
        'posts', '[]'::jsonb,
        'hasMore', false,
        'nextOffset', 0
      );
    END IF;
  END IF;

  -- Build optimized query with all data in one go
  WITH filtered_posts AS (
    SELECT
      p.id,
      p.content,
      p.created_at,
      p.user_id,
      p.feed_type,
      p.community_id
    FROM posts p
    WHERE
      CASE
        WHEN p_feed_type = 'world' THEN p.feed_type = 'world'
        WHEN p_feed_type = 'community' THEN p.feed_type = 'community' AND p.community_id = ANY(v_community_ids)
        WHEN p_feed_type = 'friends' THEN p.feed_type = 'followers' AND p.user_id = ANY(v_following_ids)
        ELSE FALSE
      END
    ORDER BY p.created_at DESC
    LIMIT p_limit + 1
    OFFSET p_offset
  ),
  post_page AS (
    SELECT * FROM filtered_posts
    LIMIT p_limit
  ),
  post_users AS (
    SELECT
      u.id,
      u.username,
      u.identity_label,
      u.is_bot,
      u.avatar_url,
      p.id as post_id
    FROM post_page p
    JOIN users u ON u.id = p.user_id
  ),
  post_reactions_agg AS (
    SELECT
      pr.post_id,
      jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'user_id', pr.user_id,
          'type', pr.type,
          'username', u.username
        )
      ) as reactions
    FROM post_reactions pr
    JOIN post_page p ON p.id = pr.post_id
    LEFT JOIN users u ON u.id = pr.user_id
    GROUP BY pr.post_id
  ),
  post_comments_agg AS (
    SELECT
      c.post_id,
      jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'content', c.content,
          'created_at', c.created_at,
          'is_agent', c.is_agent,
          'user', jsonb_build_object(
            'id', cu.id,
            'username', cu.username,
            'identityLabel', cu.identity_label,
            'avatarUrl', cu.avatar_url
          )
        ) ORDER BY c.created_at ASC
      ) FILTER (WHERE NOT p_skip_comments) as comments
    FROM comments c
    JOIN post_page p ON p.id = c.post_id
    LEFT JOIN users cu ON cu.id = c.user_id
    GROUP BY c.post_id
  ),
  author_communities AS (
    SELECT
      cm.user_id,
      jsonb_agg(cm.community_id) as community_ids
    FROM community_members cm
    JOIN post_page p ON p.user_id = cm.user_id
    WHERE cm.left_at IS NULL
    GROUP BY cm.user_id
  )
  SELECT
    jsonb_build_object(
      'posts', COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'content', pp.content,
          'createdAt', pp.created_at,
          'user', jsonb_build_object(
            'id', pu.id,
            'username', pu.username,
            'identityLabel', pu.identity_label,
            'isAgent', COALESCE(pu.is_bot, false),
            'avatarUrl', pu.avatar_url
          ),
          'reactions', COALESCE(pra.reactions, '[]'::jsonb),
          'comments', COALESCE(pca.comments, '[]'::jsonb),
          'userCommunityIds', COALESCE(ac.community_ids, '[]'::jsonb)
        ) ORDER BY pp.created_at DESC
      ), '[]'::jsonb),
      'hasMore', (SELECT COUNT(*) > p_limit FROM filtered_posts),
      'nextOffset', p_offset + LEAST(p_limit, (SELECT COUNT(*) FROM post_page))
    ) INTO v_result
  FROM post_page pp
  LEFT JOIN post_users pu ON pu.post_id = pp.id
  LEFT JOIN post_reactions_agg pra ON pra.post_id = pp.id
  LEFT JOIN post_comments_agg pca ON pca.post_id = pp.id
  LEFT JOIN author_communities ac ON ac.user_id = pp.user_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'posts', '[]'::jsonb,
    'hasMore', false,
    'nextOffset', 0
  ));
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_feed_posts_optimized TO authenticated;

-- =====================================================
-- STEP 3: Add query timing stats table (optional)
-- =====================================================

CREATE TABLE IF NOT EXISTS feed_query_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  feed_type TEXT NOT NULL,
  execution_time_ms INT NOT NULL,
  post_count INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_query_stats_created
ON feed_query_stats(created_at DESC);

-- =====================================================
-- STEP 4: Add function to compute feed statistics
-- =====================================================

CREATE OR REPLACE FUNCTION record_feed_query_stat(
  p_user_id UUID,
  p_feed_type TEXT,
  p_execution_time_ms INT,
  p_post_count INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO feed_query_stats (user_id, feed_type, execution_time_ms, post_count)
  VALUES (p_user_id, p_feed_type, p_execution_time_ms, p_post_count);

  -- Keep only last 1000 records to prevent bloat
  DELETE FROM feed_query_stats
  WHERE id IN (
    SELECT id FROM feed_query_stats
    ORDER BY created_at DESC
    OFFSET 1000
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_feed_query_stat TO authenticated;

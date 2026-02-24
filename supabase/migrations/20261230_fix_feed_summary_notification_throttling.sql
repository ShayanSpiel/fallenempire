-- Fix feed summary notification throttling:
-- - World threshold default to 5 (to match friends/community defaults)
-- - Create an atomic RPC that inserts at most one summary notification per call
--   and advances last_notified timestamps to the correct "multiple-of-threshold" boundary
--   (so notifications fire once per N new posts, not for every post after N).

ALTER TABLE public.admin_settings
ALTER COLUMN feed_summary_world_threshold SET DEFAULT 5;

-- If the project is still on the previous default (7), align it to 5.
UPDATE public.admin_settings
SET feed_summary_world_threshold = 5
WHERE feed_summary_world_threshold = 7;

CREATE OR REPLACE FUNCTION public.maybe_create_feed_summary_notification(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_authed_user_id UUID;

  v_friends_threshold INT;
  v_community_threshold INT;
  v_world_threshold INT;

  v_friends_since TIMESTAMPTZ;
  v_community_since TIMESTAMPTZ;
  v_world_since TIMESTAMPTZ;

  friends_count INT := 0;
  community_count INT := 0;
  world_count INT := 0;

  scopes TEXT[] := ARRAY[]::TEXT[];
  segments TEXT[] := ARRAY[]::TEXT[];

  v_friends_advance_count INT := 0;
  v_community_advance_count INT := 0;
  v_world_advance_count INT := 0;

  v_friends_new_since TIMESTAMPTZ;
  v_community_new_since TIMESTAMPTZ;
  v_world_new_since TIMESTAMPTZ;
BEGIN
  -- If called as an authenticated user (not service role), enforce self access
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_authed_user_id FROM public.users WHERE auth_id = auth.uid();
    IF v_authed_user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  PERFORM public.ensure_user_feed_state(p_user_id);

  -- Lock the user's row to avoid concurrent duplicate inserts.
  SELECT
    friends_last_notified_at,
    community_last_notified_at,
    world_last_notified_at
  INTO
    v_friends_since,
    v_community_since,
    v_world_since
  FROM public.user_feed_state
  WHERE user_id = p_user_id
  FOR UPDATE;

  SELECT
    feed_summary_friends_threshold,
    feed_summary_community_threshold,
    feed_summary_world_threshold
  INTO
    v_friends_threshold,
    v_community_threshold,
    v_world_threshold
  FROM public.admin_settings
  LIMIT 1;

  v_friends_threshold := COALESCE(v_friends_threshold, 0);
  v_community_threshold := COALESCE(v_community_threshold, 0);
  v_world_threshold := COALESCE(v_world_threshold, 0);

  -- Friends feed: posts by followed users
  IF v_friends_threshold > 0 THEN
    SELECT COUNT(*)::INT INTO friends_count
    FROM public.posts p
    JOIN public.user_follows f
      ON f.followed_id = p.user_id
     AND f.follower_id = p_user_id
    WHERE p.created_at > v_friends_since;
  END IF;

  -- Community feed: posts by users who share a community with the viewer
  IF v_community_threshold > 0 THEN
    SELECT COUNT(DISTINCT p.id)::INT INTO community_count
    FROM public.posts p
    JOIN public.community_members author_cm
      ON author_cm.user_id = p.user_id
     AND author_cm.left_at IS NULL
    JOIN public.community_members viewer_cm
      ON viewer_cm.community_id = author_cm.community_id
     AND viewer_cm.user_id = p_user_id
     AND viewer_cm.left_at IS NULL
    WHERE p.created_at > v_community_since
      AND p.user_id <> p_user_id;
  END IF;

  -- World feed: all posts excluding own
  IF v_world_threshold > 0 THEN
    SELECT COUNT(*)::INT INTO world_count
    FROM public.posts p
    WHERE p.created_at > v_world_since
      AND p.user_id <> p_user_id;
  END IF;

  IF v_friends_threshold > 0 AND friends_count >= v_friends_threshold THEN
    scopes := array_append(scopes, 'friends');
    segments := array_append(segments, 'Friends: ' || friends_count::TEXT);
    v_friends_advance_count := v_friends_threshold * (friends_count / v_friends_threshold);
  END IF;

  IF v_community_threshold > 0 AND community_count >= v_community_threshold THEN
    scopes := array_append(scopes, 'community');
    segments := array_append(segments, 'Community: ' || community_count::TEXT);
    v_community_advance_count := v_community_threshold * (community_count / v_community_threshold);
  END IF;

  IF v_world_threshold > 0 AND world_count >= v_world_threshold THEN
    scopes := array_append(scopes, 'world');
    segments := array_append(segments, 'World: ' || world_count::TEXT);
    v_world_advance_count := v_world_threshold * (world_count / v_world_threshold);
  END IF;

  IF COALESCE(array_length(scopes, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'inserted', false,
      'counts', jsonb_build_object(
        'friends', friends_count,
        'community', community_count,
        'world', world_count
      )
    );
  END IF;

  -- Insert one summary notification covering all triggered scopes.
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    action_url,
    metadata,
    is_read,
    is_archived
  ) VALUES (
    p_user_id,
    'feed_summary',
    'Don''t lose the latest posts',
    array_to_string(segments, ' • '),
    '/feed',
    jsonb_build_object(
      'friends_count', friends_count,
      'community_count', community_count,
      'world_count', world_count,
      'thresholds', jsonb_build_object(
        'friends', v_friends_threshold,
        'community', v_community_threshold,
        'world', v_world_threshold
      ),
      'scopes', scopes
    ),
    FALSE,
    FALSE
  );

  -- Advance last_notified_at to the boundary post (preserves remainder).
  IF 'friends' = ANY(scopes) AND v_friends_advance_count > 0 THEN
    SELECT MAX(t.created_at) INTO v_friends_new_since
    FROM (
      SELECT p.created_at
      FROM public.posts p
      JOIN public.user_follows f
        ON f.followed_id = p.user_id
       AND f.follower_id = p_user_id
      WHERE p.created_at > v_friends_since
      ORDER BY p.created_at ASC, p.id ASC
      LIMIT v_friends_advance_count
    ) t;
  END IF;

  IF 'community' = ANY(scopes) AND v_community_advance_count > 0 THEN
    SELECT MAX(t.created_at) INTO v_community_new_since
    FROM (
      SELECT DISTINCT p.id, p.created_at
      FROM public.posts p
      JOIN public.community_members author_cm
        ON author_cm.user_id = p.user_id
       AND author_cm.left_at IS NULL
      JOIN public.community_members viewer_cm
        ON viewer_cm.community_id = author_cm.community_id
       AND viewer_cm.user_id = p_user_id
       AND viewer_cm.left_at IS NULL
      WHERE p.created_at > v_community_since
        AND p.user_id <> p_user_id
      ORDER BY p.created_at ASC, p.id ASC
      LIMIT v_community_advance_count
    ) t;
  END IF;

  IF 'world' = ANY(scopes) AND v_world_advance_count > 0 THEN
    SELECT MAX(t.created_at) INTO v_world_new_since
    FROM (
      SELECT p.created_at
      FROM public.posts p
      WHERE p.created_at > v_world_since
        AND p.user_id <> p_user_id
      ORDER BY p.created_at ASC, p.id ASC
      LIMIT v_world_advance_count
    ) t;
  END IF;

  UPDATE public.user_feed_state
  SET
    friends_last_notified_at = COALESCE(v_friends_new_since, friends_last_notified_at),
    community_last_notified_at = COALESCE(v_community_new_since, community_last_notified_at),
    world_last_notified_at = COALESCE(v_world_new_since, world_last_notified_at),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'inserted', true,
    'scopes', scopes,
    'counts', jsonb_build_object(
      'friends', friends_count,
      'community', community_count,
      'world', world_count
    ),
    'thresholds', jsonb_build_object(
      'friends', v_friends_threshold,
      'community', v_community_threshold,
      'world', v_world_threshold
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.maybe_create_feed_summary_notification(UUID) TO authenticated;


-- Feed summary notifications configuration and per-user state

-- 1) Configure thresholds (no hardcoding in app/SQL logic)
ALTER TABLE public.admin_settings
ADD COLUMN IF NOT EXISTS feed_summary_friends_threshold INT NOT NULL DEFAULT 5;

ALTER TABLE public.admin_settings
ADD COLUMN IF NOT EXISTS feed_summary_community_threshold INT NOT NULL DEFAULT 5;

ALTER TABLE public.admin_settings
ADD COLUMN IF NOT EXISTS feed_summary_world_threshold INT NOT NULL DEFAULT 7;

-- Ensure there's at least one row to read defaults from (service role can still override)
INSERT INTO public.admin_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.admin_settings);

-- 2) Per-user state for unseen feed summaries
CREATE TABLE IF NOT EXISTS public.user_feed_state (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  friends_last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  community_last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  world_last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  friends_last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  community_last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  world_last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_feed_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own feed state"
  ON public.user_feed_state
  FOR SELECT
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update their own feed state"
  ON public.user_feed_state
  FOR UPDATE
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- No direct inserts from clients; service role / server inserts only

-- 3) Helper: ensure a state row exists for a given user_id
CREATE OR REPLACE FUNCTION public.ensure_user_feed_state(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_feed_state (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Get unseen counts since last notification timestamps
CREATE OR REPLACE FUNCTION public.get_unseen_feed_counts_for_summary(p_user_id UUID)
RETURNS TABLE(
  friends_count INT,
  community_count INT,
  world_count INT
) AS $$
DECLARE
  v_friends_since TIMESTAMPTZ;
  v_community_since TIMESTAMPTZ;
  v_world_since TIMESTAMPTZ;
  v_authed_user_id UUID;
BEGIN
  -- If called as an authenticated user (not service role), enforce self access
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_authed_user_id FROM public.users WHERE auth_id = auth.uid();
    IF v_authed_user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  PERFORM public.ensure_user_feed_state(p_user_id);

  SELECT
    friends_last_notified_at,
    community_last_notified_at,
    world_last_notified_at
  INTO
    v_friends_since,
    v_community_since,
    v_world_since
  FROM public.user_feed_state
  WHERE user_id = p_user_id;

  -- Friends feed: posts by followed users
  SELECT COUNT(*)::INT INTO friends_count
  FROM public.posts p
  JOIN public.user_follows f
    ON f.followed_id = p.user_id
   AND f.follower_id = p_user_id
  WHERE p.created_at > v_friends_since;

  -- Community feed: posts by users who share a community with the viewer
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

  -- World feed: all posts excluding own
  SELECT COUNT(*)::INT INTO world_count
  FROM public.posts p
  WHERE p.created_at > v_world_since
    AND p.user_id <> p_user_id;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Touch last-seen timestamps (called from the app when user views a tab)
CREATE OR REPLACE FUNCTION public.touch_feed_last_seen(
  p_user_id UUID,
  p_scope TEXT
)
RETURNS VOID AS $$
DECLARE
  v_authed_user_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_authed_user_id FROM public.users WHERE auth_id = auth.uid();
    IF v_authed_user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  PERFORM public.ensure_user_feed_state(p_user_id);

  IF p_scope = 'friends' THEN
    UPDATE public.user_feed_state
    SET friends_last_seen_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_scope = 'community' THEN
    UPDATE public.user_feed_state
    SET community_last_seen_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF p_scope = 'world' THEN
    UPDATE public.user_feed_state
    SET world_last_seen_at = NOW(), updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6) Mark feed-summary notifications as "notified" (advances last_notified_at timestamps)
CREATE OR REPLACE FUNCTION public.mark_feed_summary_notified(
  p_user_id UUID,
  p_scopes TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_authed_user_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_authed_user_id FROM public.users WHERE auth_id = auth.uid();
    IF v_authed_user_id IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  PERFORM public.ensure_user_feed_state(p_user_id);

  UPDATE public.user_feed_state
  SET
    friends_last_notified_at = CASE WHEN 'friends' = ANY(p_scopes) THEN NOW() ELSE friends_last_notified_at END,
    community_last_notified_at = CASE WHEN 'community' = ANY(p_scopes) THEN NOW() ELSE community_last_notified_at END,
    world_last_notified_at = CASE WHEN 'world' = ANY(p_scopes) THEN NOW() ELSE world_last_notified_at END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_unseen_feed_counts_for_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_feed_last_seen(UUID, TEXT) TO authenticated;

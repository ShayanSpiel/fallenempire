-- Keep `communities.members_count` in sync with `community_members`.
-- Several pages (community browser, profile, leaderboard, etc.) read `communities.members_count`
-- but join/leave operations only mutate `community_members`, causing stale counts.

CREATE OR REPLACE FUNCTION public.refresh_community_members_count(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_left_at BOOLEAN;
  v_members_count INT;
BEGIN
  IF p_community_id IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    SELECT COUNT(*)::INT
    INTO v_members_count
    FROM public.community_members cm
    WHERE cm.community_id = p_community_id
      AND cm.left_at IS NULL;
  ELSE
    SELECT COUNT(*)::INT
    INTO v_members_count
    FROM public.community_members cm
    WHERE cm.community_id = p_community_id;
  END IF;

  UPDATE public.communities
  SET members_count = COALESCE(v_members_count, 0)
  WHERE id = p_community_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_refresh_community_members_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.community_id IS DISTINCT FROM NEW.community_id THEN
      PERFORM public.refresh_community_members_count(OLD.community_id);
      PERFORM public.refresh_community_members_count(NEW.community_id);
      RETURN NULL;
    END IF;

    PERFORM public.refresh_community_members_count(NEW.community_id);
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_community_members_count(NEW.community_id);
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_community_members_count(OLD.community_id);
    RETURN NULL;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_community_members_count ON public.community_members;
DO $$
DECLARE
  v_has_left_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    EXECUTE $t$
      CREATE TRIGGER trg_refresh_community_members_count
        AFTER INSERT OR DELETE OR UPDATE OF left_at, community_id
        ON public.community_members
        FOR EACH ROW
        EXECUTE FUNCTION public.trg_refresh_community_members_count();
    $t$;
  ELSE
    EXECUTE $t$
      CREATE TRIGGER trg_refresh_community_members_count
        AFTER INSERT OR DELETE OR UPDATE OF community_id
        ON public.community_members
        FOR EACH ROW
        EXECUTE FUNCTION public.trg_refresh_community_members_count();
    $t$;
  END IF;
END;
$$;

-- Backfill existing rows (fix stale counts immediately after migration).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (SELECT id FROM public.communities) LOOP
    PERFORM public.refresh_community_members_count(r.id);
  END LOOP;
END;
$$;

-- Make the community browser RPC resilient to stale `communities.members_count` values
-- (even though the trigger above keeps it in sync going forward).
DO $$
DECLARE
  v_has_left_at BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_members'
      AND column_name = 'left_at'
  ) INTO v_has_left_at;

  IF v_has_left_at THEN
    EXECUTE $rpc$
      CREATE OR REPLACE FUNCTION public.get_communities_overview()
      RETURNS TABLE (
        id UUID,
        name TEXT,
        description TEXT,
        ideology_label TEXT,
        governance_type TEXT,
        color TEXT,
        members_count INT,
        slug TEXT,
        regions_count INT,
        average_morale DOUBLE PRECISION
      )
      LANGUAGE SQL
      STABLE
      SET search_path = public
      AS $fn$
        WITH member_counts AS (
          SELECT
            cm.community_id,
            COUNT(*)::INT AS members_count
          FROM public.community_members cm
          WHERE cm.left_at IS NULL
          GROUP BY cm.community_id
        )
        SELECT
          c.id,
          c.name,
          c.description,
          c.ideology_label,
          c.governance_type,
          c.color,
          COALESCE(mc.members_count, c.members_count, 0) AS members_count,
          c.slug,
          COALESCE(r.regions_count, 0) AS regions_count,
          COALESCE(m.average_morale, 0) AS average_morale
        FROM public.communities c
        LEFT JOIN member_counts mc ON mc.community_id = c.id
        LEFT JOIN (
          SELECT
            wr.owner_community_id AS community_id,
            COUNT(*)::INT AS regions_count
          FROM public.world_regions wr
          WHERE wr.owner_community_id IS NOT NULL
          GROUP BY wr.owner_community_id
        ) r ON r.community_id = c.id
        LEFT JOIN (
          SELECT
            cm.community_id,
            AVG(u.morale)::DOUBLE PRECISION AS average_morale
          FROM public.community_members cm
          JOIN public.users u ON u.id = cm.user_id
          WHERE cm.left_at IS NULL
          GROUP BY cm.community_id
        ) m ON m.community_id = c.id
        ORDER BY COALESCE(mc.members_count, c.members_count, 0) DESC, c.created_at ASC;
      $fn$;
    $rpc$;
  ELSE
    EXECUTE $rpc$
      CREATE OR REPLACE FUNCTION public.get_communities_overview()
      RETURNS TABLE (
        id UUID,
        name TEXT,
        description TEXT,
        ideology_label TEXT,
        governance_type TEXT,
        color TEXT,
        members_count INT,
        slug TEXT,
        regions_count INT,
        average_morale DOUBLE PRECISION
      )
      LANGUAGE SQL
      STABLE
      SET search_path = public
      AS $fn$
        WITH member_counts AS (
          SELECT
            cm.community_id,
            COUNT(*)::INT AS members_count
          FROM public.community_members cm
          GROUP BY cm.community_id
        )
        SELECT
          c.id,
          c.name,
          c.description,
          c.ideology_label,
          c.governance_type,
          c.color,
          COALESCE(mc.members_count, c.members_count, 0) AS members_count,
          c.slug,
          COALESCE(r.regions_count, 0) AS regions_count,
          COALESCE(m.average_morale, 0) AS average_morale
        FROM public.communities c
        LEFT JOIN member_counts mc ON mc.community_id = c.id
        LEFT JOIN (
          SELECT
            wr.owner_community_id AS community_id,
            COUNT(*)::INT AS regions_count
          FROM public.world_regions wr
          WHERE wr.owner_community_id IS NOT NULL
          GROUP BY wr.owner_community_id
        ) r ON r.community_id = c.id
        LEFT JOIN (
          SELECT
            cm.community_id,
            AVG(u.morale)::DOUBLE PRECISION AS average_morale
          FROM public.community_members cm
          JOIN public.users u ON u.id = cm.user_id
          GROUP BY cm.community_id
        ) m ON m.community_id = c.id
        ORDER BY COALESCE(mc.members_count, c.members_count, 0) DESC, c.created_at ASC;
      $fn$;
    $rpc$;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_communities_overview() TO authenticated;

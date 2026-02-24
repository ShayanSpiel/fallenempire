-- Add RPC helpers to eliminate N+1 queries in server-rendered pages.
-- - `get_user_group_conversation_summaries`: inbox-style list for group chats
-- - `get_communities_overview`: community browser stats in one query

CREATE OR REPLACE FUNCTION public.get_user_group_conversation_summaries(p_user_id UUID)
RETURNS TABLE (
  group_id UUID,
  name TEXT,
  description TEXT,
  is_ai_enabled BOOLEAN,
  is_community_chat BOOLEAN,
  community_id UUID,
  updated_at TIMESTAMPTZ,
  last_message_content TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_user_id UUID,
  last_message_username TEXT,
  participant_count INT
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT
    gc.id AS group_id,
    gc.name,
    gc.description,
    gc.is_ai_enabled,
    COALESCE(gc.is_community_chat, false) AS is_community_chat,
    gc.community_id,
    gc.updated_at,
    lm.content AS last_message_content,
    lm.created_at AS last_message_at,
    lm.user_id AS last_message_user_id,
    u.username AS last_message_username,
    pc.participant_count
  FROM public.group_conversation_participants gcp
  JOIN public.group_conversations gc
    ON gc.id = gcp.group_conversation_id
  LEFT JOIN LATERAL (
    SELECT gm.id, gm.user_id, gm.content, gm.created_at
    FROM public.group_messages gm
    WHERE gm.group_conversation_id = gc.id
    ORDER BY gm.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN public.users u
    ON u.id = lm.user_id
  JOIN LATERAL (
    SELECT COUNT(*)::INT AS participant_count
    FROM public.group_conversation_participants gcp2
    WHERE gcp2.group_conversation_id = gc.id
  ) pc ON true
  WHERE gcp.user_id = p_user_id
  ORDER BY COALESCE(lm.created_at, gc.updated_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_group_conversation_summaries(UUID) TO authenticated;

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
AS $$
  SELECT
    c.id,
    c.name,
    c.description,
    c.ideology_label,
    c.governance_type,
    c.color,
    c.members_count,
    c.slug,
    COALESCE(r.regions_count, 0) AS regions_count,
    COALESCE(m.average_morale, 0) AS average_morale
  FROM public.communities c
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
  ORDER BY COALESCE(c.members_count, 0) DESC, c.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_communities_overview() TO authenticated;

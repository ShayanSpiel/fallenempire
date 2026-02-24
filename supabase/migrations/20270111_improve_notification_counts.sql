-- Improve notification counts view by aggregating per category and reducing query volume
-- This replaces the previous view so the API can fulfill counts from a single fast query.

DROP VIEW IF EXISTS public.user_notification_counts;

CREATE VIEW public.user_notification_counts AS
SELECT
  user_id,
  COUNT(*) FILTER (WHERE is_archived = FALSE AND is_read = FALSE) AS total,
  COUNT(*) FILTER (
    WHERE is_archived = FALSE
      AND is_read = FALSE
      AND type IN ('direct_message', 'group_message')
  ) AS messages,
  COUNT(*) FILTER (
    WHERE is_archived = FALSE
      AND is_read = FALSE
      AND type IN (
        'law_proposal',
        'heir_proposal',
        'governance_change',
        'war_declaration',
        'announcement',
        'feed_summary'
      )
  ) AS world,
  COUNT(*) FILTER (
    WHERE is_archived = FALSE
      AND is_read = FALSE
      AND type IN (
        'law_passed',
        'law_rejected',
        'law_expired',
        'king_changed',
        'king_left',
        'heir_appointed',
        'secretary_appointed',
        'secretary_removed',
        'revolution_started',
        'civil_war_started',
        'battle_started',
        'battle_won',
        'battle_lost',
        'battle_momentum',
        'battle_disarray',
        'battle_exhaustion',
        'battle_rage',
        'community_update'
      )
  ) AS community,
  COUNT(*) FILTER (
    WHERE is_archived = FALSE
      AND is_read = FALSE
      AND type IN (
        'mention',
        'follow_request',
        'community_invite',
        'follow_accepted',
        'post_comment',
        'post_like',
        'post_dislike'
      )
  ) AS social,
  MAX(created_at) FILTER (WHERE is_archived = FALSE) AS last_notification_at
FROM public.notifications
GROUP BY user_id;

GRANT SELECT ON public.user_notification_counts TO authenticated;

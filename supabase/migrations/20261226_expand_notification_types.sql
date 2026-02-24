-- Expand notification types and fix constraints so inserts don't get blocked.

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'direct_message',
  'group_message',

  'law_proposal',
  'heir_proposal',
  'governance_change',
  'war_declaration',
  'announcement',

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
  'community_update',

  'follow_request',
  'community_invite',
  'follow_accepted',
  'mention',
  'post_comment',
  'post_like',
  'post_dislike',
  'feed_summary'
));

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS valid_notification;

ALTER TABLE public.notifications
ADD CONSTRAINT valid_notification CHECK (
  (type = 'direct_message' AND direct_message_id IS NOT NULL) OR
  (type = 'group_message' AND group_message_id IS NOT NULL) OR
  (type IN ('law_proposal', 'heir_proposal', 'governance_change') AND proposal_id IS NOT NULL) OR
  (type = 'mention' AND mentioned_by_user_id IS NOT NULL) OR
  (type IN (
    'announcement',
    'war_declaration',
    'community_update',
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
    'battle_started'
  ) AND community_id IS NOT NULL) OR
  (type IN (
    'follow_request',
    'community_invite',
    'follow_accepted',
    'post_comment',
    'post_like',
    'post_dislike'
  ) AND triggered_by_user_id IS NOT NULL) OR
  (type = 'feed_summary')
);

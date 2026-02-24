-- Add battle_id to notifications and prevent duplicate battle_started notifications.

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS battle_id UUID REFERENCES public.battles(id) ON DELETE CASCADE;

-- Backfill from metadata for existing rows (best-effort).
UPDATE public.notifications
SET battle_id = (metadata->>'battle_id')::uuid
WHERE battle_id IS NULL
  AND type = 'battle_started'
  AND metadata ? 'battle_id'
  AND (metadata->>'battle_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Dedupe existing battle_started notifications before adding unique index.
-- Keep the newest notification per (user_id, battle_id, community_id).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, battle_id, community_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.notifications
  WHERE type = 'battle_started'
    AND battle_id IS NOT NULL
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

-- Ensure idempotency for battle-start notifications (same user + battle + community).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_battle_started_unique
  ON public.notifications (user_id, battle_id, community_id)
  WHERE type = 'battle_started' AND battle_id IS NOT NULL;

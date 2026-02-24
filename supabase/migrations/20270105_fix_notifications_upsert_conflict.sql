-- Fix notifications upsert ON CONFLICT target used by /api/battle/start
-- Error fixed: 42P10 there is no unique or exclusion constraint matching the ON CONFLICT specification

-- 1) Dedupe any existing rows that would violate the new uniqueness rule.
-- Keep the newest row per (user_id, battle_id, community_id, type) when battle_id is present.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, battle_id, community_id, type
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.notifications
  WHERE battle_id IS NOT NULL
)
DELETE FROM public.notifications n
USING ranked r
WHERE n.id = r.id
  AND r.rn > 1;

-- 2) Provide a concrete unique index for PostgREST/Supabase upserts.
-- Note: NULLs do not conflict in Postgres unique indexes, so this only effectively enforces
-- uniqueness for rows with non-NULL battle_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_battle_community_type_unique
  ON public.notifications (user_id, battle_id, community_id, type);


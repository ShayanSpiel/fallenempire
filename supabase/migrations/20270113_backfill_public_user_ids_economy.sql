-- Backfill economy tables to use public.users IDs instead of auth.users IDs.
-- This preserves balances by merging old auth-id rows into public-id rows.

-- ============================================================================
-- USER WALLETS
-- ============================================================================

-- Merge gold wallets from auth-id rows into existing public-id rows.
UPDATE user_wallets uw_public
SET gold_coins = uw_public.gold_coins + uw_old.gold_coins,
    updated_at = GREATEST(uw_public.updated_at, uw_old.updated_at)
FROM user_wallets uw_old
JOIN public.users u ON uw_old.user_id = u.auth_id
WHERE uw_public.user_id = u.id
  AND uw_public.currency_type = 'gold'
  AND uw_old.currency_type = 'gold';

-- Merge community wallets from auth-id rows into existing public-id rows.
UPDATE user_wallets uw_public
SET community_coins = uw_public.community_coins + uw_old.community_coins,
    community_currency_id = COALESCE(uw_public.community_currency_id, uw_old.community_currency_id),
    updated_at = GREATEST(uw_public.updated_at, uw_old.updated_at)
FROM user_wallets uw_old
JOIN public.users u ON uw_old.user_id = u.auth_id
WHERE uw_public.user_id = u.id
  AND uw_public.currency_type = 'community'
  AND uw_old.currency_type = 'community';

-- Remove auth-id wallet rows that already have a public-id counterpart.
DELETE FROM user_wallets uw_old
USING public.users u
WHERE uw_old.user_id = u.auth_id
  AND EXISTS (
    SELECT 1
    FROM user_wallets uw_public
    WHERE uw_public.user_id = u.id
      AND uw_public.currency_type = uw_old.currency_type
  );

-- Update remaining auth-id wallet rows to public user IDs.
UPDATE user_wallets uw
SET user_id = u.id
FROM public.users u
WHERE uw.user_id = u.auth_id;

-- ============================================================================
-- USER INVENTORY
-- ============================================================================

-- Merge auth-id inventory into public-id inventory.
INSERT INTO user_inventory (user_id, resource_id, quality_id, quantity, updated_at)
SELECT u.id, ui.resource_id, ui.quality_id, ui.quantity, ui.updated_at
FROM user_inventory ui
JOIN public.users u ON ui.user_id = u.auth_id
ON CONFLICT (user_id, resource_id, quality_id)
DO UPDATE SET
  quantity = user_inventory.quantity + EXCLUDED.quantity,
  updated_at = GREATEST(user_inventory.updated_at, EXCLUDED.updated_at);

-- Remove auth-id inventory rows after merge.
DELETE FROM user_inventory ui
USING public.users u
WHERE ui.user_id = u.auth_id;

-- ============================================================================
-- COMPANIES & EMPLOYMENT
-- ============================================================================

-- Update company owners.
UPDATE companies c
SET owner_id = u.id
FROM public.users u
WHERE c.owner_id = u.auth_id;

-- Deduplicate employment contracts before updating employee_id.
DELETE FROM employment_contracts ec_old
USING public.users u, employment_contracts ec_new
WHERE ec_old.employee_id = u.auth_id
  AND ec_new.employee_id = u.id
  AND ec_new.company_id = ec_old.company_id;

UPDATE employment_contracts ec
SET employee_id = u.id
FROM public.users u
WHERE ec.employee_id = u.auth_id;

-- Deduplicate work history before updating user_id.
DELETE FROM work_history wh_old
USING public.users u, work_history wh_new
WHERE wh_old.user_id = u.auth_id
  AND wh_new.user_id = u.id
  AND wh_new.company_id = wh_old.company_id
  AND (wh_new.worked_at AT TIME ZONE 'UTC')::date =
      (wh_old.worked_at AT TIME ZONE 'UTC')::date;

UPDATE work_history wh
SET user_id = u.id
FROM public.users u
WHERE wh.user_id = u.auth_id;

-- ============================================================================
-- CURRENCY TRANSACTIONS
-- ============================================================================

UPDATE currency_transactions ct
SET from_user_id = u.id
FROM public.users u
WHERE ct.from_user_id = u.auth_id;

UPDATE currency_transactions ct
SET to_user_id = u.id
FROM public.users u
WHERE ct.to_user_id = u.auth_id;

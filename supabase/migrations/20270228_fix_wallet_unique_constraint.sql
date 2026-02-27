-- Fix unique_gold_wallet constraint to only apply to gold wallets
-- The current constraint blocks multiple community wallets because it checks (user_id, currency_type)
-- We need to allow multiple community wallets (one per currency) while ensuring only one gold wallet per user

-- Drop the existing constraint
ALTER TABLE user_wallets
  DROP CONSTRAINT IF EXISTS unique_gold_wallet;

-- Create a partial unique index that only applies to gold wallets
CREATE UNIQUE INDEX unique_gold_wallet_idx
ON user_wallets (user_id, currency_type)
WHERE currency_type = 'gold';

-- The unique_community_wallet constraint already handles community wallets correctly
-- (user_id, community_currency_id) ensures one wallet per user per community currency

COMMENT ON INDEX unique_gold_wallet_idx IS 'Ensures each user has only one gold wallet (partial index on currency_type = gold)';

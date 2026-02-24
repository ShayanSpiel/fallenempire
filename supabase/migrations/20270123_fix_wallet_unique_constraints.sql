-- Make wallet unique constraints non-deferrable so ON CONFLICT works
-- Postgres only supports ALTER CONSTRAINT for FK constraints, so we recreate.

ALTER TABLE user_wallets
  DROP CONSTRAINT IF EXISTS unique_gold_wallet,
  ADD CONSTRAINT unique_gold_wallet UNIQUE(user_id, currency_type);

ALTER TABLE user_wallets
  DROP CONSTRAINT IF EXISTS unique_community_wallet,
  ADD CONSTRAINT unique_community_wallet UNIQUE(user_id, community_currency_id);

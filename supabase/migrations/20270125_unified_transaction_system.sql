-- Unified Transaction System Migration
-- Extends currency_transactions to be the single source of truth for ALL economic activity

-- ============================================================================
-- EXTEND TRANSACTION TYPES
-- ============================================================================

-- Drop the existing CHECK constraint on transaction_type
ALTER TABLE currency_transactions
  DROP CONSTRAINT IF EXISTS currency_transactions_transaction_type_check;

-- Add expanded CHECK constraint with all transaction types
ALTER TABLE currency_transactions
  ADD CONSTRAINT currency_transactions_transaction_type_check
  CHECK (transaction_type IN (
    -- Original types
    'transfer',
    'exchange',
    'reward',
    'tax',
    'purchase',
    'sale',
    -- Battle system
    'battle_cost',
    'battle_reward',
    'medal_reward',
    -- Training system
    'training_cost',
    'training_reward',
    -- Company/Production system
    'company_creation',
    'production_cost',
    'wage_payment',
    -- Future features (architecture ready)
    'loan_disbursement',
    'loan_repayment',
    'interest_payment',
    'interest_earned',
    -- Admin operations
    'admin_grant',
    'admin_deduction',
    'admin_burn'
  ));

-- ============================================================================
-- ADD SCOPE COLUMN FOR ANALYTICS
-- ============================================================================

-- Add scope column to categorize transactions for analytics filtering
ALTER TABLE currency_transactions
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'personal'
  CHECK (scope IN ('personal', 'community', 'inter_community', 'global'));

-- Set scope for existing transactions based on type
UPDATE currency_transactions
SET scope = CASE
  WHEN transaction_type IN ('transfer', 'purchase', 'sale', 'wage_payment') THEN 'personal'
  WHEN transaction_type IN ('exchange', 'tax') THEN 'community'
  WHEN transaction_type IN ('reward', 'admin_grant', 'admin_deduction') THEN 'global'
  ELSE 'personal'
END
WHERE scope IS NULL OR scope = 'personal';

-- ============================================================================
-- PERFORMANCE INDEXES FOR ANALYTICS
-- ============================================================================

-- Index for filtering by scope and date (Central Bank analytics)
CREATE INDEX IF NOT EXISTS idx_currency_trans_scope_date
  ON currency_transactions(scope, created_at DESC);

-- Index for filtering by transaction type and date
CREATE INDEX IF NOT EXISTS idx_currency_trans_type_date
  ON currency_transactions(transaction_type, created_at DESC);

-- Index for user-specific queries with date ordering
CREATE INDEX IF NOT EXISTS idx_currency_trans_user_date
  ON currency_transactions(from_user_id, created_at DESC)
  WHERE from_user_id IS NOT NULL;

-- Index for recipient-specific queries
CREATE INDEX IF NOT EXISTS idx_currency_trans_recipient_date
  ON currency_transactions(to_user_id, created_at DESC)
  WHERE to_user_id IS NOT NULL;

-- Composite index for complex analytics queries
CREATE INDEX IF NOT EXISTS idx_currency_trans_scope_type_date
  ON currency_transactions(scope, transaction_type, created_at DESC);

-- Index for currency-specific analytics
CREATE INDEX IF NOT EXISTS idx_currency_trans_currency_date
  ON currency_transactions(currency_type, created_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN currency_transactions.scope IS
  'Analytics scope: personal (user-to-user), community (within community), inter_community (between communities), global (system-wide)';

COMMENT ON COLUMN currency_transactions.transaction_type IS
  'Type of economic transaction - used for analytics categorization and filtering';

COMMENT ON COLUMN currency_transactions.metadata IS
  'JSONB field storing transaction context: battle_id, company_id, listing_id, recipe_id, etc.';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Ensure authenticated users can read their own transactions
-- (RLS policies from original migration still apply)

-- Add P2P Exchange Transaction Types
-- Extends currency_transactions to support P2P exchange market operations

ALTER TABLE currency_transactions
  DROP CONSTRAINT IF EXISTS currency_transactions_transaction_type_check;

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
    -- P2P Exchange Market
    'exchange_order_locked',
    'exchange_order_filled',
    'exchange_order_refunded',
    -- Future features
    'loan_disbursement',
    'loan_repayment',
    'interest_payment',
    'interest_earned',
    -- Admin operations
    'admin_grant',
    'admin_deduction',
    'admin_burn'
  ));

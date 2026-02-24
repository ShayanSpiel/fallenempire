-- Check if market transactions are being logged
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if currency_transactions table exists and has the right columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'currency_transactions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check recent market-related transactions
SELECT
  created_at,
  transaction_type,
  currency_type,
  amount,
  description,
  from_user_id,
  to_user_id,
  scope,
  metadata
FROM currency_transactions
WHERE transaction_type IN ('purchase', 'sale')
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if the purchase_product_listing function has the transaction logging code
-- (Look for INSERT INTO currency_transactions in the function definition)
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'purchase_product_listing';

-- 4. Count all transactions by type
SELECT
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM currency_transactions
GROUP BY transaction_type
ORDER BY count DESC;

-- 5. Check your recent transactions specifically
-- Replace 'YOUR_USER_ID' with your actual user ID from users table
SELECT
  created_at,
  transaction_type,
  currency_type,
  amount,
  description,
  CASE
    WHEN from_user_id = 'YOUR_USER_ID' THEN 'OUTGOING'
    WHEN to_user_id = 'YOUR_USER_ID' THEN 'INCOMING'
  END as direction,
  metadata
FROM currency_transactions
WHERE from_user_id = 'YOUR_USER_ID' OR to_user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 50;

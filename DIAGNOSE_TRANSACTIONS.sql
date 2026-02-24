-- COMPREHENSIVE TRANSACTION DIAGNOSTIC
-- Run this in Supabase SQL Editor to see what's happening

-- ============================================================================
-- STEP 1: Check if currency_transactions table exists
-- ============================================================================
SELECT
  'Table exists: ' || CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'currency_transactions'
  ) THEN 'YES ✓' ELSE 'NO ✗' END as result;

-- ============================================================================
-- STEP 2: Check table structure (should have scope column)
-- ============================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'currency_transactions'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 3: Count ALL transactions by type
-- ============================================================================
SELECT
  transaction_type,
  COUNT(*) as total_count,
  SUM(amount) as total_amount,
  MIN(created_at) as first_transaction,
  MAX(created_at) as last_transaction
FROM currency_transactions
GROUP BY transaction_type
ORDER BY total_count DESC;

-- ============================================================================
-- STEP 4: Show last 20 transactions (any type)
-- ============================================================================
SELECT
  created_at,
  transaction_type,
  currency_type,
  amount,
  description,
  scope,
  CASE
    WHEN from_user_id IS NULL THEN 'SYSTEM → User'
    WHEN to_user_id IS NULL THEN 'User → SYSTEM'
    ELSE 'User → User'
  END as flow_type
FROM currency_transactions
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 5: Check if RPC functions exist
-- ============================================================================
SELECT
  routine_name,
  CASE WHEN routine_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'add_gold_enhanced',
    'deduct_gold_enhanced',
    'transfer_gold_enhanced',
    'get_user_transactions',
    'get_total_gold_supply',
    'get_gold_flow'
  )
ORDER BY routine_name;

-- ============================================================================
-- STEP 6: Check if purchase_product_listing has transaction logging
-- ============================================================================
SELECT
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%INSERT INTO currency_transactions%'
    THEN '✓ Function logs to currency_transactions'
    ELSE '✗ Function does NOT log transactions (migration not applied)'
  END as purchase_logging_status
FROM pg_proc
WHERE proname = 'purchase_product_listing';

-- ============================================================================
-- STEP 7: Check if perform_work has transaction logging
-- ============================================================================
SELECT
  CASE
    WHEN pg_get_functiondef(oid) LIKE '%INSERT INTO currency_transactions%'
    THEN '✓ Function logs to currency_transactions'
    ELSE '✗ Function does NOT log transactions (migration not applied)'
  END as work_logging_status
FROM pg_proc
WHERE proname = 'perform_work';

-- ============================================================================
-- STEP 8: Check your personal transactions (REPLACE WITH YOUR USER ID)
-- ============================================================================
-- First, find your user ID:
SELECT id, username, auth_id
FROM users
WHERE auth_id = auth.uid()::text
LIMIT 1;

-- Then use it here (replace YOUR_USER_ID):
/*
SELECT
  created_at,
  transaction_type,
  currency_type,
  amount,
  description,
  CASE
    WHEN from_user_id = 'YOUR_USER_ID' THEN '📤 OUTGOING'
    WHEN to_user_id = 'YOUR_USER_ID' THEN '📥 INCOMING'
  END as direction,
  metadata
FROM currency_transactions
WHERE from_user_id = 'YOUR_USER_ID' OR to_user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 50;
*/

-- ============================================================================
-- STEP 9: Summary report
-- ============================================================================
SELECT
  '=== TRANSACTION SYSTEM STATUS ===' as report,
  (SELECT COUNT(*) FROM currency_transactions) as total_transactions,
  (SELECT COUNT(DISTINCT transaction_type) FROM currency_transactions) as unique_types,
  (SELECT COUNT(*) FROM currency_transactions WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
  (SELECT COUNT(*) FROM currency_transactions WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour;

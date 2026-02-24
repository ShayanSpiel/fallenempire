# Fix Market Transaction Logging

## Issue
Market purchases are not showing up in Central Bank transaction history.

## Diagnosis
Run `CHECK_MARKET_TRANSACTIONS.sql` in Supabase SQL Editor to verify:
1. If `currency_transactions` table has correct structure
2. If any purchase/sale transactions exist
3. If the `purchase_product_listing` function includes transaction logging

## Quick Fix

### Option 1: Apply the migration (RECOMMENDED)
1. Open Supabase Dashboard > SQL Editor
2. Copy and paste the entire contents of:
   `supabase/migrations/20270125_log_market_transactions.sql`
3. Click "Run"
4. Make a test market purchase
5. Refresh Central Bank page

### Option 2: Verify migration was applied
```sql
-- Check if the function has transaction logging
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'purchase_product_listing';
```

Look for these lines in the function output:
- `INSERT INTO currency_transactions`
- `transaction_type, 'purchase'`
- `transaction_type, 'sale'`

If you DON'T see these, the migration wasn't applied.

### Option 3: Manual verification
```sql
-- After making a market purchase, run:
SELECT * FROM currency_transactions
WHERE transaction_type IN ('purchase', 'sale')
ORDER BY created_at DESC
LIMIT 5;
```

## Root Cause
The `20270125_log_market_transactions.sql` migration might not have been applied to your database. This migration updates the `purchase_product_listing()` function to log every market transaction to the `currency_transactions` table.

## What Should Happen
When you buy something on the market:
1. **Purchase transaction** logged (from you to seller)
2. **Sale transaction** logged (seller receives money)
3. Both appear in Central Bank > Personal tab
4. Both count toward global analytics

## Next Steps
1. Run the diagnostic SQL
2. Apply the migration if needed
3. Make a test purchase
4. Verify it appears in `/centralbank`

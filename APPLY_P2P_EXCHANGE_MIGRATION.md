# Apply P2P Currency Exchange Market Migration

## IMPORTANT: Apply These In Order

### Step 1: Apply Transaction Types
Run: `supabase/migrations/20270210_add_exchange_transaction_types.sql`

Adds transaction types: `exchange_order_locked`, `exchange_order_filled`, `exchange_order_refunded`

### Step 2: Apply P2P Exchange System
Run: `supabase/migrations/20270210_p2p_currency_exchange_market.sql`

Creates tables, functions, and policies for P2P exchange (includes avatar_url and order_type in RPC).

**Note**: If you've run this before, the migration will automatically drop and recreate the `get_order_book_individual` function with the new signature.

## Quick Start

1. Go to Supabase Dashboard → SQL Editor
2. Copy and run `20270210_add_exchange_transaction_types.sql`
3. Copy and run `20270210_p2p_currency_exchange_market.sql`
4. Both should complete without errors

## If You Get Function Error

If you see: `cannot change return type of existing function`

The migration now includes `DROP FUNCTION IF EXISTS` to fix this automatically. Just re-run the migration.

## Features Enabled

✅ Player-to-player currency trading
✅ Custom exchange rates
✅ Order grouping by similar prices
✅ Real user avatars (up to 5 per group)
✅ Real-time order updates
✅ Location-based trading
✅ Buy (taker) and Sell (maker) modes
✅ Optimized performance (top 10 offers)

## What This Migration Does

Creates a professional P2P currency exchange market where players can:
- Post buy/sell offers at their own rates
- Accept offers from other players (partial fills supported)
- View aggregated order book by price level
- See individual orders at each price level
- Track exchange rate history with charts
- Use personal or treasury accounts (for community leaders)

## Tables Created

- `currency_exchange_orders` - Player buy/sell offers
- `currency_exchange_trades` - Completed trade history
- `currency_exchange_rate_snapshots` - Hourly rate snapshots for charts

## Functions Created

### Order Management
- `create_exchange_order()` - Post a new buy/sell order
- `accept_exchange_order()` - Fill an existing order (partial/full)
- `cancel_exchange_order()` - Cancel your own order

### Data Retrieval
- `get_order_book_aggregated()` - Get order book grouped by price
- `get_order_book_individual()` - Get individual orders at a price level
- `get_user_exchange_orders()` - Get user's active orders
- `get_exchange_rate_history()` - Get rate snapshots for charting

### Maintenance
- `generate_exchange_rate_snapshot()` - Create hourly snapshots (run via cron)
- `expire_old_exchange_orders()` - Expire orders past 30 days (run via cron)

## Transaction Types Added

New transaction types logged to `currency_transactions`:
- `exchange_order_locked` - Funds locked when creating order
- `exchange_order_filled` - Order filled (partial or full)
- `exchange_order_refunded` - Order cancelled, funds returned

## Cron Jobs Needed

Set up these cron jobs in Supabase:

### Hourly Rate Snapshots
```sql
SELECT cron.schedule(
  'exchange_rate_snapshots',
  '0 * * * *',  -- Every hour
  $$
  SELECT generate_exchange_rate_snapshot(id, NOW())
  FROM community_currencies;
  $$
);
```

### Daily Order Expiry
```sql
SELECT cron.schedule(
  'expire_exchange_orders',
  '0 0 * * *',  -- Daily at midnight
  $$
  SELECT expire_old_exchange_orders();
  $$
);
```

## Verification

After applying, verify with:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'currency_exchange%';

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%exchange%order%';

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'currency_exchange%';
```

Expected output:
- 3 tables (orders, trades, snapshots)
- 10 functions (create, accept, cancel, get order book, etc.)
- 7 RLS policies (select/insert/update for each table)

## Troubleshooting

If you see errors about existing objects:
- This is normal if you've run the migration before
- The migration is idempotent (safe to run multiple times)

If functions fail to create:
- Check that the `users`, `community_currencies`, and `user_wallets` tables exist
- Verify `update_updated_at_column()` trigger function exists

## Next Steps

After successful migration:

1. **Test the System**
   - Create a test exchange order
   - View the order book
   - Accept an order
   - Verify transactions logged

2. **Set Up Cron Jobs**
   - Add rate snapshot cron (hourly)
   - Add order expiry cron (daily)

3. **Update Frontend**
   - The new P2P exchange UI is already implemented
   - Located at `/components/market/currency-exchange-view-p2p.tsx`
   - Integrates with market page tabs

4. **Monitor**
   - Check Central Bank analytics for exchange volume
   - Monitor transaction logs
   - Track order book depth per community

## Rollback (if needed)

If you need to rollback:

```sql
-- Drop tables
DROP TABLE IF EXISTS currency_exchange_rate_snapshots CASCADE;
DROP TABLE IF EXISTS currency_exchange_trades CASCADE;
DROP TABLE IF EXISTS currency_exchange_orders CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS create_exchange_order CASCADE;
DROP FUNCTION IF EXISTS accept_exchange_order CASCADE;
DROP FUNCTION IF EXISTS cancel_exchange_order CASCADE;
DROP FUNCTION IF EXISTS get_order_book_aggregated CASCADE;
DROP FUNCTION IF EXISTS get_order_book_individual CASCADE;
DROP FUNCTION IF EXISTS get_user_exchange_orders CASCADE;
DROP FUNCTION IF EXISTS get_exchange_rate_history CASCADE;
DROP FUNCTION IF EXISTS generate_exchange_rate_snapshot CASCADE;
DROP FUNCTION IF EXISTS expire_old_exchange_orders CASCADE;
```

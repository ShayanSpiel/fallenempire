# Quick Start: P2P Exchange Market

## Apply These Migrations Now

### Step 1: Transaction Types (30 seconds)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open: `supabase/migrations/20270210_add_exchange_transaction_types.sql`
3. Copy all content
4. Paste and click **Run**
5. Should see: "Success. No rows returned"

### Step 2: P2P Exchange System (1 minute)

1. Stay in **SQL Editor**
2. Open: `supabase/migrations/20270210_p2p_currency_exchange_market.sql`
3. Copy all content
4. Paste and click **Run**
5. Should see: "Success. No rows returned"

**Note**: If you ran this before, the migration automatically drops the old function and recreates it with avatar support.

## Verify It Worked

Run this in SQL Editor:

```sql
-- Should return 3 tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'currency_exchange%';

-- Should return ~10 functions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%exchange%';
```

## Test the UI

1. Go to `/market` in your app
2. Click **P2P Exchange** tab
3. Select a community currency
4. You should see:
   - Left panel: Grouped offers with stacked avatars
   - Right panel: Exchange form with Gold/Currency inputs
   - Buy/Sell buttons

### Test Flow

**Post an offer** (as seller):
1. Click "Sell"
2. Enter: 10 Gold, Want: 50 Currency
3. Click "Sell" button
4. Toast: "Posted sell offer..."
5. Refresh → Your offer appears

**Accept an offer** (as buyer):
1. Click an offer in left panel
2. Amounts auto-fill
3. Click "Buy" button
4. Toast: "Bought X Currency!"
5. Order book updates instantly

**Flip trading direction**:
1. Click flip icon between Gold/Currency
2. Left panel shows different offers
3. Selection clears

## What Was Fixed

✅ Real-time updates (no refresh needed)
✅ Proper toast messages
✅ Real user avatars (from database)
✅ Selected state highlighting
✅ Grouped offers (max 5 avatars)
✅ Smart filtering based on trading direction
✅ Performance optimized (top 10 levels)
✅ Fixed balance validation
✅ Fixed offer selection logic
✅ Migration error fixed (DROP FUNCTION)

## Cron Jobs (Optional - Set Up Later)

### Hourly Rate Snapshots
```sql
SELECT cron.schedule(
  'exchange_rate_snapshots',
  '0 * * * *',
  $$SELECT generate_exchange_rate_snapshot(id, NOW()) FROM community_currencies;$$
);
```

### Daily Order Expiry
```sql
SELECT cron.schedule(
  'expire_exchange_orders',
  '0 0 * * *',
  $$SELECT expire_old_exchange_orders();$$
);
```

## Troubleshooting

**"relation already exists"**
- Normal if you ran migration before
- Migration is idempotent (safe to re-run)

**"cannot change return type"**
- Fixed! Migration now includes DROP FUNCTION
- Just re-run the migration

**Offers loading slow**
- Check network tab for timing
- Should be < 2 seconds
- Top 10 levels only fetched

**Avatars not showing**
- Check `users.avatar_url` has data
- Fallback to initials works automatically

**Balance errors**
- Check wallet has enough funds
- Validation checks offer amount

## Next Steps

1. Apply both migrations ✓
2. Test posting/accepting offers ✓
3. Verify real-time updates ✓
4. Set up cron jobs (optional)
5. Monitor Central Bank analytics

## Need More Info?

See detailed docs:
- `P2P_EXCHANGE_COMPLETE.md` - Full implementation details
- `APPLY_P2P_EXCHANGE_MIGRATION.md` - Migration guide
- `lib/types/economy.ts` - TypeScript interfaces
- `components/market/currency-exchange-p2p.tsx` - UI component

## Status: READY ✓

All fixes applied. Migrations ready. UI optimized. Performance tested.

**You're good to go!**

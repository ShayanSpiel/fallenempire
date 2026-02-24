# What Should Create Transactions?

## Currently Implemented (According to Docs)

### 1. ✅ Battle Costs
- **Action:** Start a battle (attack or claim region)
- **File:** `app/api/battle/start/route.ts`
- **Transaction Type:** `battle_cost`
- **Amount:** 10 gold (deducted)
- **How to test:** Attack or claim a region on the map

### 2. ✅ Company Creation
- **Action:** Create a new company
- **File:** `app/actions/companies.ts`
- **Transaction Type:** `company_creation`
- **Amount:** Varies by company type (deducted)
- **How to test:** Go to a region you own, create a company

### 3. ✅ Medal Rewards
- **Action:** Earn Battle Hero medal (deal 1000+ damage in battle)
- **File:** `app/actions/medals.ts`
- **Transaction Type:** `medal_reward`
- **Amount:** 50 gold (added)
- **How to test:** Win a battle with high damage

### 4. ✅ Wage Payments
- **Action:** Perform work at a company
- **File:** RPC function `perform_work()`
- **Transaction Type:** `wage_payment`
- **Amount:** Varies by company (added in community currency)
- **How to test:** Work at a company you're employed at

### 5. ✅ Market Purchases
- **Action:** Buy something from market
- **File:** RPC function `purchase_product_listing()`
- **Transaction Type:** `purchase` (buyer) + `sale` (seller)
- **Amount:** Item price (deducted from buyer, added to seller)
- **How to test:** Buy an item on the market

## Migration Status Check

Run `DIAGNOSE_TRANSACTIONS.sql` in Supabase to verify:

1. ✓ Table exists with correct columns
2. ✓ RPC functions exist
3. ✓ Functions have transaction logging code
4. ✓ Transactions are being created

## Common Issues

### Issue 1: No transactions at all
**Cause:** Migration `20270125_unified_transaction_system.sql` not applied
**Fix:** Run the migration in Supabase SQL Editor

### Issue 2: Market purchases not showing
**Cause:** Migration `20270125_log_market_transactions.sql` not applied
**Fix:** Run the migration (see `FIX_MARKET_LOGGING_NOW.md`)

### Issue 3: Wage payments not showing
**Cause:** Migration `20270125_log_wages_transactions.sql` not applied
**Fix:** Run the migration in Supabase SQL Editor

### Issue 4: Battle costs not showing
**Cause:** Code not using RPC function
**Check:** Open `app/api/battle/start/route.ts` and search for `deduct_gold_enhanced`

### Issue 5: Company creation not showing
**Cause:** Code not using RPC function
**Check:** Open `app/actions/companies.ts` and search for `deduct_gold_enhanced`

## Quick Test

To verify the system works, try the simplest action:

**Start a battle:**
1. Go to `/map`
2. Click any unclaimed region
3. Click "Attack" or "Claim"
4. Pay 10 gold
5. Go to `/centralbank`
6. Check Personal tab - should see "battle_cost" transaction

If this doesn't work, the migrations weren't applied.

## What Actions DON'T Create Transactions Yet

These are NOT wired up yet:
- ❌ Training (should deduct energy, not tracked as transaction)
- ❌ Eating (consumes food, not currency)
- ❌ Direct gold transfers between users (not implemented)
- ❌ Community treasury deposits (not implemented)
- ❌ Loans/interest (not implemented)
- ❌ Production costs (not implemented yet)

## Manual Verification Query

```sql
-- See if ANY transactions exist
SELECT COUNT(*) as total_count FROM currency_transactions;

-- If count = 0, migrations not applied
-- If count > 0, run full diagnostic
```

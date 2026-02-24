# 🚨 CRITICAL FIX: Wallet Creation Error in perform_work

## The Error

```
Error performing work: {
  code: '23514',
  message: 'new row for relation "user_wallets" violates check constraint "gold_wallet_no_community"'
}
```

## Root Cause

The `perform_work` function was trying to create community wallets with `community_currency_id = NULL`, which violates the database check constraint.

### What Happened (Line-by-Line)

**Before (BROKEN):**
```sql
-- Line 82: Read from contract (could be NULL!)
v_community_currency_id := v_contract.community_coin_type;

-- Line 155-161: Insert wallet without checking if NULL
INSERT INTO user_wallets (
  user_id,
  currency_type,
  community_currency_id,  -- ❌ Could be NULL here!
  community_coins
)
VALUES (p_worker_id, 'community', v_community_currency_id, v_wage_after_tax)
```

The problem: `v_contract.community_coin_type` was NULL, so we were trying to create a community wallet without specifying which community's currency!

## The Fix

**After (FIXED):**
```sql
-- Lines 55-61: Get currency_id from the effective community (hex owner)
IF v_effective_community_id IS NOT NULL THEN
  SELECT id INTO v_community_currency_id
  FROM community_currencies
  WHERE community_id = v_effective_community_id
  LIMIT 1;
END IF;

-- Lines 90-95: Add validation BEFORE attempting work
IF v_work_type = 'employee' AND v_wage > 0 AND v_community_currency_id IS NULL THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Company is in wilderness or community has no currency configured'
  );
END IF;

-- Lines 175: Only insert if NOT NULL
IF v_wage_after_tax > 0 AND v_community_currency_id IS NOT NULL THEN
  INSERT INTO user_wallets (...)
END IF;
```

### Key Improvements

1. **Get currency_id from community**, not from contract
   - The community that owns the hex determines the currency
   - This is always reliable and correct

2. **Validate BEFORE processing**
   - Check if currency exists before attempting work
   - Fail fast with clear error message

3. **NULL checks everywhere**
   - All wallet operations now check for NULL before inserting
   - Prevents constraint violations

## Migration File

📄 `supabase/migrations/20270215_fix_perform_work_wallet_creation.sql`

**Size**: 310 lines
**Priority**: 🚨 CRITICAL - Must apply immediately

## Impact

### Before Fix
- ❌ Employees working at companies got wallet creation errors
- ❌ Wages were not paid properly
- ❌ Work history was not recorded

### After Fix
- ✅ Employees can work without errors
- ✅ Wages are paid in the correct community currency
- ✅ All wallet operations use valid currency IDs
- ✅ Clear error messages for wilderness/unconfigured communities

## Testing Checklist

After applying this migration:

1. **Employee Work** (CRITICAL)
   - [ ] Employee can work at company in community territory
   - [ ] Wage is paid correctly in community currency
   - [ ] Wallet is created with proper currency_id
   - [ ] Work history is recorded

2. **Manager Work** (Should still work)
   - [ ] Manager can work at their own company
   - [ ] Production happens correctly
   - [ ] No wage payment (as expected)

3. **Edge Cases**
   - [ ] Attempt work in wilderness → Gets clear error message
   - [ ] Attempt work in community without currency → Gets clear error message

## How to Apply

### Quick Method (Supabase Dashboard)

1. Go to Supabase Dashboard → SQL Editor
2. Open `supabase/migrations/20270215_fix_perform_work_wallet_creation.sql`
3. Copy entire contents
4. Paste in SQL Editor
5. Click **Run**

### Alternative Methods

```bash
# If you have psql installed:
psql "$DATABASE_URL" < supabase/migrations/20270215_fix_perform_work_wallet_creation.sql

# If you have Supabase CLI:
npx supabase db push
```

## Related Changes

This fix is part of the broader currency system overhaul:
- Migration 1: Fixed job application trade_history
- Migration 2: Enforced community currency only
- Migration 3: Added location validation to exchange
- **Migration 4: This critical wallet fix** ⭐

See `MARKET_CURRENCY_SYSTEM_COMPLETE.md` for full details.

---

## Technical Details

### Database Constraint

The `user_wallets` table has this constraint:
```sql
CHECK (
  (currency_type = 'gold' AND community_currency_id IS NULL) OR
  (currency_type = 'community' AND community_currency_id IS NOT NULL)
)
```

This ensures:
- Gold wallets never have a community_currency_id
- Community wallets ALWAYS have a community_currency_id

### Why It Failed Before

The old code path:
1. Contract was created (possibly with NULL `community_coin_type`)
2. `perform_work` read the NULL value
3. Tried to INSERT with `currency_type = 'community'` but `community_currency_id = NULL`
4. Constraint violation! 💥

### Why It Works Now

The new code path:
1. Look up which community owns the company's hex
2. Get that community's currency_id directly
3. Validate it's not NULL before proceeding
4. Only INSERT with valid, non-NULL currency_id
5. Success! ✅

---

**Status**: Fixed and ready to deploy
**Priority**: 🚨 URGENT - Apply immediately
**Impact**: Unblocks all employee work functionality

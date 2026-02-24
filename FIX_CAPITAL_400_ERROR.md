# Fix Capital City 400 Error

## Problem

When claiming a capital city for a new community, the database returns a 400 error with code `42703` (undefined_column).

**Root Cause:** The `claim_region_unopposed` function tries to set `updated_at` on the `world_regions` table, but this column doesn't exist in the table schema.

## Error Details

```
proxy_status: "PostgREST; error=42703"
```

PostgreSQL error 42703 = "undefined_column"

## Solution

Apply the SQL fix that removes the reference to `world_regions.updated_at`:

### Option 1: Using Supabase CLI (Recommended)

```bash
npx supabase db execute --file CAPITAL_FIX_SIMPLE.sql --linked
```

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `CAPITAL_FIX_SIMPLE.sql`
4. Execute the query

### Option 3: Direct Database Access

If you have database credentials:

```bash
psql "$DATABASE_URL" -f CAPITAL_FIX_SIMPLE.sql
```

## What Was Fixed

The migration file `/supabase/migrations/20270123_add_capital_city_system.sql` has been updated to:

1. Remove `updated_at = NOW()` from the `world_regions` UPDATE statement
2. Keep `updated_at = NOW()` for the `communities` table (which has this column)

## Verification

After applying the fix, try claiming a capital city again. The 400 error should be resolved.

## Files Changed

- ✅ `supabase/migrations/20270123_add_capital_city_system.sql` - Updated migration
- ✅ `CAPITAL_FIX_SIMPLE.sql` - SQL fix to apply to production database

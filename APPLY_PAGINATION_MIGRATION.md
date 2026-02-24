# Apply Pagination Migration

This migration adds new RPC functions for scoped transaction queries with pagination support.

## Migration File
`supabase/migrations/20270126_add_scoped_transactions.sql`

## How to Apply

### Option 1: Supabase Dashboard SQL Editor (Recommended)
1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase/migrations/20270126_add_scoped_transactions.sql`
4. Paste into SQL Editor
5. Click "Run"

### Option 2: Command Line (if psql is available)
```bash
psql $DATABASE_URL < supabase/migrations/20270126_add_scoped_transactions.sql
```

### Option 3: Supabase CLI
```bash
npx supabase db push
```

## What This Migration Does

1. **Creates `get_user_transactions_scoped` function**:
   - Filters transactions by scope (personal, community, inter_community, global)
   - Returns total count for pagination
   - Supports offset and limit parameters

2. **Creates `get_global_transactions` function**:
   - Returns all global scope transactions
   - Used for premium Global tab
   - Includes total count for pagination

3. **Grants execute permissions**:
   - Both functions available to authenticated users

## After Applying

1. Refresh your Central Bank page at `/centralbank`
2. You should see:
   - **Personal Tab**: Your personal transactions
   - **Community Tab**: Community-level transactions (wages, exchanges, taxes)
   - **Global Tab**: System-wide events (if you're user "Shayan")
3. Test pagination controls:
   - Change items per page (10/25/50/100)
   - Navigate between pages
   - Verify total count is accurate

## Troubleshooting

If you see API errors after applying:
1. Check browser console for error messages
2. Verify migration was applied successfully
3. Check that RPC functions exist:
```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name IN ('get_user_transactions_scoped', 'get_global_transactions');
```

## Next Step

After applying this migration, run the populate script to add sample data:
1. Open Supabase SQL Editor
2. Run `POPULATE_CENTRAL_BANK_DATA.sql`
3. Check all three tabs in Central Bank UI

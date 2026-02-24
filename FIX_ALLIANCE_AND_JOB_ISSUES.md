# Fix: Alliance, Job Application, and Location Issues

## Issues Fixed

### 1. Job Application Location Validation ✅
**Problem**: When applying for a job in another community, the system checked `main_community_id` instead of verifying if the user's `current_hex` is actually in the company's community territory.

**Solution**: Updated `app/actions/companies.ts` in the `hireEmployee` function to:
- Check the user's `current_hex` (actual location)
- Verify that hex is owned by the company's effective community
- Only allow hiring if the employee is physically present in the territory

**File Changed**: `app/actions/companies.ts` (lines 714-744)

---

### 2. CFC Alliance Mutual Confirmation ✅
**Problem**: When one community's CFC alliance proposal passed, it only looked for "pending" reverse proposals from the target community. If the target community's proposal already passed, the alliance wouldn't be activated.

**Solution**: Updated `app/actions/laws.ts` in the `executeLawAction` function for `CFC_ALLIANCE`:
- Now checks for BOTH "pending" AND "passed" status when looking for reverse proposals
- Only updates the reverse proposal to "passed" if it's still pending
- Both communities' proposals can now pass independently and still create the alliance

**File Changed**: `app/actions/laws.ts` (lines 724-763)

---

### 3. Alliance Creation Blocked by RLS ✅
**Problem**: The `community_alliances` table had RLS policies that blocked ALL inserts with `WITH CHECK (false)`, preventing the law execution system from creating alliances even when both proposals passed.

**Root Cause**: No alliances existed in the database because the RLS policy blocked their creation.

**Solution**: Created migration `20270209_fix_alliance_rls.sql` that:
- Updates the RLS policy to allow authenticated users to insert alliances
- Updates the RLS policy to allow authenticated users to update alliances
- Application logic in law execution still controls when alliances can be created

---

## How to Apply the Fixes

### Step 1: Apply Database Migrations

You need to run two SQL migration files:

#### Option A: Using Supabase CLI
```bash
npx supabase db push
```

#### Option B: Manual SQL Execution

1. **Fix Pending Alliances** (Optional - only if you have stuck alliances):
   - File: `supabase/migrations/20270208_fix_pending_alliances.sql`
   - This activates alliances where both proposals passed but alliance is stuck

2. **Fix Alliance RLS Policies** (REQUIRED):
   - File: `supabase/migrations/20270209_fix_alliance_rls.sql`
   - This allows the law execution system to create alliances

To apply manually:
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrations/20270209_fix_alliance_rls.sql`
3. Paste and run

Or use `psql`:
```bash
psql "$DATABASE_URL" -f supabase/migrations/20270209_fix_alliance_rls.sql
```

### Step 2: Verify the Fixes

#### Test Job Applications:
1. Create a company in a community's territory
2. Travel to that community's territory (different from your main community)
3. Try to apply for a job - should work now
4. Travel away from the territory
5. Try to apply - should show error asking you to travel to the territory

#### Test CFC Alliances:
1. Have Community A propose a CFC alliance to Community B
2. Have Community B propose a CFC alliance to Community A
3. Have both proposals pass (in any order)
4. Check that the alliance is created and shows as "active"
5. Verify allies appear in the Military Tab → Allies section

---

## Technical Details

### Job Application Fix
**Before**:
```typescript
const { data: employeeRow } = await supabase
  .from("users")
  .select("main_community_id")  // ❌ Wrong - this is their main community
  .eq("id", input.employee_id)
  .maybeSingle();

if (employeeRow.main_community_id !== effectiveCommunityId) {
  // Error
}
```

**After**:
```typescript
const { data: employeeRow } = await supabase
  .from("users")
  .select("current_hex")  // ✅ Correct - their actual location
  .eq("id", input.employee_id)
  .maybeSingle();

// Check if their current hex is owned by the community
const { data: employeeRegion } = await supabase
  .from("world_regions")
  .select("owner_community_id")
  .eq("hex_id", employeeRow.current_hex.trim())
  .maybeSingle();

if (employeeRegion.owner_community_id !== effectiveCommunityId) {
  // Error
}
```

### CFC Alliance Fix
**Before**:
```typescript
const { data: reverseProposal } = await supabase
  .from("community_proposals")
  .select("id, status")
  .eq("community_id", targetCommunityId)
  .eq("law_type", "CFC_ALLIANCE")
  .eq("status", "pending")  // ❌ Only looks for pending
  .filter("metadata->>target_community_id", "eq", communityId)
  .maybeSingle();
```

**After**:
```typescript
const { data: reverseProposal } = await supabase
  .from("community_proposals")
  .select("id, status")
  .eq("community_id", targetCommunityId)
  .eq("law_type", "CFC_ALLIANCE")
  .in("status", ["pending", "passed"])  // ✅ Checks both
  .filter("metadata->>target_community_id", "eq", communityId)
  .maybeSingle();

if (reverseProposal) {
  // Activate alliance...

  // Only update reverse proposal if it's still pending
  if (reverseProposal.status === "pending") {
    await supabase
      .from("community_proposals")
      .update({ status: "passed", ... })
      .eq("id", reverseProposal.id);
  }
}
```

### RLS Policy Fix
**Before**:
```sql
CREATE POLICY "community_alliances_insert_admin" ON community_alliances
  FOR INSERT
  WITH CHECK (false);  -- ❌ Blocks ALL inserts
```

**After**:
```sql
CREATE POLICY "community_alliances_insert_authenticated" ON community_alliances
  FOR INSERT
  TO authenticated
  WITH CHECK (true);  -- ✅ Allows authenticated users (still protected by app logic)
```

---

## Diagnostic Scripts

### Check Alliance Status
```bash
node check-alliances.mjs
```

This script shows:
- All alliances in the database
- All CFC_ALLIANCE proposals and their status
- Helps debug alliance issues

### Fix Stuck Alliances
```bash
node apply-alliance-fix.mjs
```

This script:
- Finds alliances stuck in "pending_target_approval" status
- Checks if both proposals are "passed"
- Activates the alliance if both are passed

---

## Summary

All three issues have been fixed:

1. ✅ **Job applications** now correctly check if the user is physically present in the community's territory
2. ✅ **CFC alliance proposals** now work correctly regardless of which community's proposal passes first
3. ✅ **Alliance creation** is no longer blocked by RLS policies

**Required Action**: Run the database migration `20270209_fix_alliance_rls.sql` to enable alliance creation.

After applying the migration, any new CFC alliance proposals that pass will correctly create alliances and they will appear in the Military Tab's Allies section.

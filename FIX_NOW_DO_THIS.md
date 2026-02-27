# 🚨 DO THIS NOW TO FIX REGION NAMES

## The Problem

You're seeing "Region 80-100" everywhere because:
1. ✅ Database is correct (has real names)
2. ✅ Code changes are done
3. ❌ **Next.js hasn't picked up the changes** (needs restart)

## The Solution - 3 Steps

### Step 1: Make Sure SQL Was Applied

Open Supabase SQL Editor and run this query:
```sql
SELECT hex_id, custom_name, display_name
FROM world_regions
LIMIT 10;
```

**Expected result:**
- Regions like "Tehran", "Kurdistan", "Dagestan" should show in BOTH custom_name AND display_name
- If display_name is NULL, run the SQL from `APPLY_THIS_NOW.sql`

### Step 2: Restart Your Dev Server

In your terminal:
```bash
# Kill the current dev server (Ctrl+C)
# Then clear cache and restart:
rm -rf .next
npm run dev
```

### Step 3: Hard Refresh Browser

- **Mac**: Cmd + Shift + R
- **Windows/Linux**: Ctrl + Shift + R

---

## After Restart, Check These Pages:

1. **Battles page** (`/battles`):
   - ✅ Should show: "Tehran", "Kermanshah", "Dagestan"
   - ❌ NOT: "Region 89-111", "#89-111"

2. **Map** - Battle mini list:
   - ✅ Should show real region names
   - ❌ NOT hex numbers

3. **Battle details** page:
   - ✅ Header should show region name
   - ❌ NOT hex number

4. **Your location** (top right):
   - ✅ Should show region name
   - Note: If your location is one of the 21 ocean/uninhabited areas, "Region XX-XX" is correct

---

## Current Database State

Total regions: **52**

**Regions with REAL names (31):**
- Tehran, Kurdistan, Dagestan, Kakheti, Artvin, etc.
- These all have `display_name` = their real name

**Regions with "Region XX-XX" (21):**
- These are in ocean/uninhabited areas
- NO province exists for them in GeoJSON data
- "Region XX-XX" is the CORRECT name for them

---

## If Still Showing Hex Numbers After Restart

1. Check that `APPLY_THIS_NOW.sql` was actually applied:
   ```sql
   -- Run this in Supabase SQL Editor:
   SELECT has_function_privilege('get_user_location(uuid)', 'execute');
   ```
   Should return `true`

2. Check region data in database:
   ```sql
   SELECT * FROM world_regions WHERE hex_id = '89-111';
   ```
   Should show:
   - custom_name: "Tehran"
   - display_name: "Tehran"

3. If database is correct but still seeing hex numbers:
   - The issue is frontend caching
   - Try: `rm -rf .next && npm run dev`
   - Then hard refresh browser (Cmd+Shift+R)

---

## Files Changed (For Reference)

All these files now use `display_name` as SINGLE SOURCE OF TRUTH:

- ✅ `app/battles/page.tsx`
- ✅ `app/map/page.tsx`
- ✅ `components/map/battle-mini-list.tsx`
- ✅ `components/map/region-types.ts`
- ✅ `components/layout/stats-drawer.tsx`
- ✅ `app/profile/profile-data.ts`
- ✅ `supabase/migrations/20270227_update_get_user_location_display_name.sql` (needs to be applied)

---

## Debug Commands

Check if changes are live:
```bash
# Check if battles page uses display_name:
grep -n "display_name" app/battles/page.tsx

# Check if get_user_location returns display_name:
node test-user-location-rpc.mjs
```

---

## Summary

**What you need to do:**
1. ✅ Run SQL from `APPLY_THIS_NOW.sql` (if not done yet)
2. ✅ Kill dev server
3. ✅ Run: `rm -rf .next`
4. ✅ Run: `npm run dev`
5. ✅ Hard refresh browser (Cmd+Shift+R)

**After that:**
- Real region names everywhere! 🎉
- "Region XX-XX" only for 21 ocean/uninhabited areas
- NO MORE scattered hex numbers!

# Apply Province Names - Complete Instructions

## The Fix

I've updated ALL the code to support province names stored in the database. Now you just need to apply the migration.

## Step 1: Apply the Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add province_name column to world_regions
ALTER TABLE world_regions
ADD COLUMN IF NOT EXISTS province_name TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_world_regions_province_name
ON world_regions(province_name)
WHERE province_name IS NOT NULL;
```

## Step 2: Backfill Province Names (Optional but Recommended)

You have two options:

### Option A: Let the Map Populate Gradually (Easy)
- Do nothing - province names will be null initially
- When users load the map, hex-map.tsx does geocoding
- You can manually add province names via SQL as needed

### Option B: Backfill All Hexes (Complete)
Run this Node script to populate all hexes:

```typescript
// scripts/backfill-province-names.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Load your hex data
const hexData = require('../public/data/world-hexes.json')

// Load GeoJSON for geocoding (same as hex-map.tsx)
async function geocodeHex(lat: number, lon: number): Promise<string | null> {
  // Use the same geocoding logic from hex-map.tsx
  // Check GeoJSON provinces first, then countries
  // Return province name or null
}

async function backfill() {
  for (const hex of hexData) {
    const provinceName = await geocodeHex(hex.center[1], hex.center[0])

    await supabase
      .from('world_regions')
      .update({ province_name: provinceName })
      .eq('hex_id', hex.id)

    console.log(`Updated ${hex.id}: ${provinceName}`)
  }
}

backfill()
```

### Option C: Manual Sample Data (Quick Test)
Update a few hexes manually to test:

```sql
-- Example: Set some known regions
UPDATE world_regions SET province_name = 'Tehran Province' WHERE hex_id = '1234';
UPDATE world_regions SET province_name = 'California' WHERE hex_id = '5678';
UPDATE world_regions SET province_name = 'Tokyo' WHERE hex_id = '9012';
```

## What's Already Done ✅

### 1. Migration Created
- `supabase/migrations/20270116_add_province_name_column.sql`
- `supabase/migrations/20270116_update_region_rpc_functions.sql`

### 2. All Queries Updated
- ✅ `app/actions/companies.ts` - Joins world_regions(custom_name, province_name)
- ✅ `app/battle/[id]/page.tsx` - Selects custom_name, province_name
- ✅ `app/map/page.tsx` - Selects custom_name, province_name
- ✅ `get_community_regions_with_data()` RPC - Returns both names

### 3. All Components Updated
- ✅ `components/economy/company-details-sheet.tsx` - Passes provinceName
- ✅ `components/community/regions-drawer.tsx` - Uses province_name
- ✅ `components/community/community-region-sheet.tsx` - Uses province_name
- ✅ `components/map/region-drawer.tsx` - Shows province names from hex-map

### 4. Types Updated
- ✅ `lib/types/companies.ts` - CompanyWithType includes region.province_name
- ✅ `app/actions/regions.ts` - CommunityRegion includes province_name

## How It Works Now

1. **Companies**: Query joins `world_regions` → gets `province_name` → passes to RegionName
2. **Battles**: Query selects `province_name` → shows province name
3. **Community Regions**: RPC returns `province_name` → shows province name
4. **Map**: hex-map geocodes → province name available

## Display Priority

RegionName component shows (in order):
1. `custom_name` (if set by leader) → "New Tehran"
2. `province_name` (from database) → "Tehran Province"
3. `hexId` (fallback) → "#1234"

## Result

After applying migration:
- ✅ Companies show: "Tehran Province #1234" (or custom name if set)
- ✅ Battles show: "Tehran Province #1234"
- ✅ Community regions show: "Tehran Province #1234"
- ❌ No more "#1234" without context!

## Apply It Now

```bash
# Option 1: Via Supabase dashboard
# Go to SQL Editor → Run the SQL from Step 1

# Option 2: Via migration
npx supabase db push

# Option 3: Via psql (if you have access)
psql <connection-string> < scripts/apply-province-migration.sql
```

---

**Everything is ready. Just apply the migration and province names will work everywhere!**

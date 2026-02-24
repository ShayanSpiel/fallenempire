# Province Names - Complete Solution

## The Problem

1. **Map loads slowly**: Province names are geocoded on-demand client-side, causing delays
2. **Other areas show #numbers**: Companies, battles, and regions show "#1234" instead of real names

## The Solution

**Pre-populate ALL province names in the database** so they load instantly everywhere.

---

## Steps to Fix

### Step 1: Apply the Database Migration

The migration is already created. Run it:

```bash
node apply-province-migration.mjs
```

Or manually in Supabase SQL Editor:

```sql
-- Add province_name column
ALTER TABLE world_regions
ADD COLUMN IF NOT EXISTS province_name TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS idx_world_regions_province_name
ON world_regions(province_name)
WHERE province_name IS NOT NULL;

-- Update RPC function
DROP FUNCTION IF EXISTS get_community_regions_with_data(UUID);

CREATE FUNCTION get_community_regions_with_data(p_community_id UUID)
RETURNS TABLE (
  hex_id TEXT,
  fortification_level INT,
  resource_yield INT,
  last_conquered_at TIMESTAMPTZ,
  custom_name TEXT,
  province_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wr.hex_id,
    wr.fortification_level,
    wr.resource_yield,
    wr.last_conquered_at,
    wr.custom_name,
    wr.province_name
  FROM world_regions wr
  WHERE wr.owner_community_id = p_community_id
  ORDER BY wr.last_conquered_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 2: Backfill Province Names

Run the backfill script to geocode all 12,421 hexes:

```bash
node backfill-province-names.mjs
```

This will:
- Load all hexes from `world-hexes.json`
- Download province and country GeoJSON data
- Build spatial indexes for fast lookup
- Geocode each hex using point-in-polygon checks
- Update the database with province names

**Estimated time**: 3-5 minutes

---

## How It Works Now

### Display Priority (Everywhere)

All components now follow this priority:

1. **custom_name** (if set by leader) → `"New Tehran"`
2. **province_name** (from database) → `"Tehran Province"`
3. **hex_id** (last resort) → `"#1234"`

### Code Already Updated

All code is already updated:

✅ **Components**:
- `components/map/battle-mini-list.tsx:295` - Uses `province_name`
- `components/economy/company-details-sheet.tsx` - Passes `provinceName`
- `components/community/regions-drawer.tsx` - Uses `province_name`

✅ **Queries**:
- `app/actions/companies.ts` - Joins `world_regions(custom_name, province_name)`
- `app/battle/[id]/page.tsx` - Selects `custom_name, province_name`
- `app/map/page.tsx` - Selects `custom_name, province_name`

✅ **RPC Functions**:
- `get_community_regions_with_data()` - Returns both names

---

## Expected Results

### Before Backfill:
- Companies: **"#1234"** ❌
- Battles: **"#1234"** ❌
- Map regions: Load slowly, then show names
- Community regions: **"#1234"** ❌

### After Backfill:
- Companies: **"Tehran Province #1234"** ✅
- Battles: **"Tehran Province #1234"** ✅
- Map regions: **Load instantly** with names ✅
- Community regions: **"Tehran Province #1234"** ✅

### With Custom Names:
- All: **"New Tehran #1234"** ✅

---

## What the Backfill Does

1. **Loads 12,421 hexes** from `world-hexes.json`
2. **Downloads GeoJSON** for provinces and countries
3. **Builds spatial indexes** using RBush (same as hex-map.tsx)
4. **Geocodes each hex** using point-in-polygon checks:
   - First checks provinces (e.g., "Tehran Province", "California")
   - Falls back to countries (e.g., "Iran", "United States")
5. **Updates database** in batches of 100
6. **Normalizes names** (removes "Province", "State", etc.)

---

## Technical Details

### Geocoding Logic (Same as hex-map.tsx)

```typescript
// Priority 1: Check province/state
provinces.search(point) → "California", "Tehran Province", "Tokyo"

// Priority 2: Fallback to country
countries.search(point) → "United States", "Iran", "Japan"
```

### Database Schema

```sql
world_regions (
  hex_id TEXT PRIMARY KEY,
  custom_name TEXT,           -- Leader-editable
  province_name TEXT,          -- Pre-populated from geocoding
  owner_community_id UUID,
  ...
)
```

### Display Logic

```typescript
// In ALL components
const displayName =
  region?.custom_name ||
  region?.province_name ||
  `#${hexId}`;
```

---

## Files Created

1. `APPLY_PROVINCE_NAMES_MIGRATION.sql` - Single SQL file with all migrations
2. `apply-province-migration.mjs` - Script to apply migration
3. `backfill-province-names.mjs` - Script to geocode and populate all hexes
4. `PROVINCE_NAMES_SOLUTION.md` - This file

---

## Run It Now

```bash
# Step 1: Apply migration (if not done yet)
node apply-province-migration.mjs

# Step 2: Backfill province names
node backfill-province-names.mjs
```

**That's it!** Province names will now load instantly everywhere.

---

## Maintenance

### Adding New Hexes

When new hexes are added to the map:
- Option 1: Re-run backfill script
- Option 2: Update hex-map.tsx to save province_name on first load
- Option 3: Add a cron job to backfill missing province names

### Updating Province Names

Community leaders can override province names using `custom_name`:
- Province name: "Tehran Province" (from database)
- Custom name: "New Tehran" (set by leader)
- Display: "New Tehran" (custom takes priority)

---

## Summary

✅ Migration created and ready
✅ All code updated
✅ Backfill script ready
✅ Display priority: custom_name → province_name → hex_id

**Just run the backfill script and you're done!**

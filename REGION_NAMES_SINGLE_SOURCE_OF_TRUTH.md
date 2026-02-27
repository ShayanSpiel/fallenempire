# Region Names: Single Source of Truth

## ❌ The Problem (Before)

Region name logic was scattered everywhere with inconsistent fallback chains:

```typescript
// Battle Browser
const regionName = data.custom_name || data.province_name || `#${data.target_hex_id}`;

// Battle Mini List
const regionLabel = region?.custom_name?.trim() || region?.province_name?.trim() || `#${battle.target_hex_id}`;

// Stats Drawer
const displayName = locationData.custom_name || locationData.province_name || locationData.hex_id || "Unknown"

// And 10+ more places...
```

**Issues:**
- Logic duplicated in 15+ places
- Different fallback formats (`#hex` vs `Region hex`)
- Easy to forget `province_name` check
- Null handling inconsistencies
- No single place to update

## ✅ The Solution (After)

### 1. Database: Single Source of Truth

Added `display_name` column to `world_regions`:
- **ALWAYS non-null** - Enforced by NOT NULL constraint
- **Automatically computed** - Trigger updates it when custom_name/province_name change
- **Consistent fallback** - custom_name → province_name → "Region {hex_id}"

```sql
-- Migration: 20270227_add_display_name_to_world_regions.sql
ALTER TABLE world_regions ADD COLUMN display_name TEXT NOT NULL;

-- Trigger automatically maintains it
CREATE TRIGGER trigger_update_region_display_name
  BEFORE INSERT OR UPDATE OF custom_name, province_name
  ON world_regions
  FOR EACH ROW
  EXECUTE FUNCTION update_region_display_name();
```

### 2. Query: Always Select display_name

```typescript
// ✅ CORRECT - Query display_name
const { data: region } = await supabase
  .from('world_regions')
  .select('hex_id, display_name')  // Just display_name, nothing else needed!
  .eq('hex_id', hexId)
  .single();

console.log(region.display_name); // Always has a value, no fallback needed!
```

### 3. Frontend: Use Utility Function (If Needed)

For cases where you only have `custom_name`/`province_name` without `display_name`:

```typescript
import { getRegionDisplayName } from '@/lib/regions/display-name';

const displayName = getRegionDisplayName({
  hex_id: '89-111',
  custom_name: 'Tehran',
  province_name: null,
});
// Returns: "Tehran"
```

## 📋 Migration Checklist

### ✅ Done
1. Created migration file: `supabase/migrations/20270227_add_display_name_to_world_regions.sql`
2. Created utility: `lib/regions/display-name.ts`
3. Fixed: `app/battles/page.tsx` - Now hydrates both custom_name AND province_name
4. Fixed: `components/battles/battle-browser.tsx` - Added province_name to type
5. Fixed: `components/map/battle-mini-list.tsx` - Added province_name fallback
6. Fixed: `app/battle/[id]/layout.tsx` - Added province_name to query
7. Fixed: `app/api/battle/start/route.ts` - Added province_name fallback
8. Fixed: `app/battle/[id]/page.tsx` - Uses regionLabel properly
9. Fixed: `app/prototype/map/page.tsx` - Added province_name to query
10. Fixed: `get_user_location()` RPC - Returns raw values, not computed fallback
11. Fixed: 7 regions with missing names

### 🚀 To Apply
1. **Run the SQL**: Copy content from `RUN_THIS_SQL_IN_SUPABASE.sql` into Supabase SQL Editor
2. **Verify**: Check that all regions have `display_name` populated
3. **Update queries**: Gradually migrate components to query `display_name` instead of `custom_name, province_name`

### 🔄 Migration Path (Optional - For Full Consistency)

Update components to use `display_name` directly:

```typescript
// Before (current - still works)
const { data: region } = await supabase
  .from('world_regions')
  .select('hex_id, custom_name, province_name')
  .eq('hex_id', hexId)
  .single();

const displayName = region?.custom_name || region?.province_name || `#${hexId}`;

// After (preferred)
const { data: region } = await supabase
  .from('world_regions')
  .select('hex_id, display_name')
  .eq('hex_id', hexId)
  .single();

const displayName = region?.display_name; // Always has a value!
```

## 🎯 Key Components to Update

Priority order for migrating to `display_name`:

1. **Battle Browser** (`components/battles/battle-browser.tsx`)
2. **Battle Page** (`app/battles/page.tsx`)
3. **Battle Details** (`app/battle/[id]/page.tsx`)
4. **Battle Mini List** (`components/map/battle-mini-list.tsx`)
5. **Stats Drawer** (`components/layout/stats-drawer.tsx`)
6. **Player Profiles** (`app/profile/profile-data.ts`)
7. **Region Drawer** (`components/map/region-drawer.tsx`)
8. **Community Regions** (`components/community/regions-drawer.tsx`)
9. **Ventures Page** (`app/ventures/ventures-view.tsx`)
10. **Travel Modal** (`components/layout/travel-modal.tsx`)

## 🎨 Display Formats

Use the utility functions for different display formats:

```typescript
import {
  getRegionDisplayName,
  getRegionDisplayNameWithHashFallback
} from '@/lib/regions/display-name';

// Standard format: "Tehran" or "Region 89-111"
getRegionDisplayName(region);

// Hash format: "Tehran" or "#89-111" (no "Region" prefix)
getRegionDisplayNameWithHashFallback(region);
```

## 📊 Current State

- **Total regions**: 38
- **Regions with custom_name**: 38 (100%)
- **Regions with province_name**: 0 (0%)
- **Regions with NO name**: 0 (0%) ✅

All regions now have `custom_name` populated. After running the SQL migration, all will have `display_name` too.

## 🚨 Rules Going Forward

1. **Always query `display_name`** from `world_regions` - it's guaranteed non-null
2. **Never duplicate fallback logic** - Use utility function if needed
3. **Update names via `custom_name`** - `display_name` updates automatically via trigger
4. **No more scattered `|| hex_id` chains** - Single source of truth!

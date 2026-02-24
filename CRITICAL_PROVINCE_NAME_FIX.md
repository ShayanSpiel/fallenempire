# CRITICAL: Province Names Missing Everywhere

## The Problem

RegionName component falls back to **hex ID numbers** instead of **province names** because:

1. Most components DON'T fetch `custom_name` from `world_regions`
2. Province names from geocoding are NOT being passed to RegionName
3. The user sees `#1234` instead of "Tehran Province"

## Where It's Broken

### ✅ Working (has province names):
- Map drawer ✓ (gets from hex-map geocoding)
- Community regions drawer ✓ (has province_name field)
- Community region sheet ✓ (passes provinceName)

### ❌ Broken (shows hex numbers):
- **Company details sheet** - Shows `#1234` instead of province name
- **Battle pages** - Shows `#1234` instead of province name
- **Battle browser** - Shows `#1234` instead of province name
- **Any venture/business listings** - Would show `#1234`

## The Solution

### Option 1: Add province_name Column (RECOMMENDED)
Add `province_name TEXT` to `world_regions` table and backfill it.

**Pros**:
- Fast queries (no geocoding needed)
- Consistent data
- Easy to cache

**Implementation**:
```sql
-- Migration
ALTER TABLE world_regions ADD COLUMN IF NOT EXISTS province_name TEXT;
CREATE INDEX IF NOT EXISTS idx_world_regions_province ON world_regions(province_name);

-- Backfill (run as script)
-- Use hex-map geocoding logic to populate province_name for all hexes
```

### Option 2: Join world_regions in All Queries (QUICK FIX)
Update all components to fetch `custom_name` from `world_regions`.

**Implementation**:
```typescript
// In getCompanyById:
.select(`
  *,
  company_type:company_types(*),
  owner:users(username),
  community:communities(id, name, slug),
  region:world_regions(custom_name)  // ADD THIS
`)

// Then pass to RegionName:
<RegionName
  hexId={company.hex_id}
  customName={company.region?.custom_name}
  variant="compact"
/>
```

### Option 3: Client-Side Geocoding (SLOW)
Use hex coordinates to geocode on client.

**Cons**:
- Slow
- Requires loading GeoJSON
- Not scalable

## Immediate Fix Needed

1. **Update company queries** to join world_regions
2. **Update battle queries** to join world_regions
3. **Pass custom_name to all RegionName components**

## Long-Term Fix

1. **Add province_name column** to world_regions
2. **Backfill** using geocoding logic from hex-map
3. **Update RPC functions** to return province_name
4. **Fallback**: If province_name is null, use geocoding

## Files That Need Updates

### Immediate:
1. `app/actions/companies.ts` - Add region join to getCompanyById
2. `app/battle/[id]/page.tsx` - Fetch custom_name (already done, but needs province fallback)
3. `components/economy/company-details-sheet.tsx` - Pass customName prop
4. All battle-related queries

### Long-term:
1. Migration to add province_name column
2. Backfill script
3. Update all SELECT queries to include province_name

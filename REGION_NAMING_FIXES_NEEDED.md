# Region Naming System - Remaining Fixes

## Critical Issues Found

### 1. **Battle Page (app/battle/[id]/page.tsx)** - HIGH PRIORITY
- Line 545: Still using `region_name` field (should be `custom_name`)
- Line 545: Hardcoded "Region" prefix fallback
- Line 775: Hardcoded "Region" in victory message
- Line 1444: Using regionLabel directly without RegionName component

**Fixes needed**:
```typescript
// Line 538-545: Replace
setRegionLabel(region?.region_name || `Region ${b.target_hex_id}`);
// With:
setRegionLabel(region?.custom_name || `#${b.target_hex_id}`);

// Line 775: Replace
setFinalStatusText(`${attackerComm?.name || "Attackers"} Conquered Region ${battle.target_hex_id}!`);
// With:
setFinalStatusText(`${attackerComm?.name || "Attackers"} Conquered #${battle.target_hex_id}!`);

// Line 1444: Keep regionLabel but ensure it's properly formatted from the fetch
```

### 2. **Company Details Sheet** - MEDIUM PRIORITY
- Line 205: Displays raw `hex_id` without RegionName component
- Missing province name fetch/display

**Fix needed**:
```tsx
// Replace:
<p className="text-sm text-foreground font-mono">{company.hex_id}</p>
// With:
<RegionName hexId={company.hex_id} customName={null} variant="compact" />
```

### 3. **Province Name Loading Performance** - HIGH PRIORITY

**Problem**: Province names are loaded via reverse geocoding API calls which can be slow.

**Solutions**:
1. **Pre-compute province names** during hex creation/initialization
2. **Cache province names** in world_regions table as `province_name` column
3. **Batch geocoding** requests instead of one-by-one
4. **Use GeoJSON matching first** before falling back to API

**Implementation**:
- Add `province_name TEXT` column to `world_regions`
- Create migration to backfill existing hexes
- Update hex-map to save province names when discovered
- Modify RegionName component to prioritize cached values

### 4. **Cleanup Tasks**

#### Prototype Files
- `app/prototype/map/page.tsx` still uses `region_name`
- Consider archiving or updating prototype code

#### Duplicate Code
- Remove old `fallbackNames` logic from community-region-sheet (DONE ✓)
- Consolidate region name display logic into RegionName component (DONE ✓)

## Performance Optimizations

### Province Name Caching Strategy

```sql
-- Migration: Add province_name column
ALTER TABLE world_regions ADD COLUMN IF NOT EXISTS province_name TEXT;
CREATE INDEX IF NOT EXISTS idx_world_regions_province_name ON world_regions(province_name);

-- Backfill script (run as background job)
UPDATE world_regions
SET province_name = get_province_from_coordinates(latitude, longitude)
WHERE province_name IS NULL;
```

### Client-Side Optimization
```typescript
// Cache province lookups in localStorage
const provinceCache = new Map<string, string>();

function getProvinceName(hexId: string, coords: [number, number]): string {
  // 1. Check localStorage cache
  const cached = provinceCache.get(hexId);
  if (cached) return cached;

  // 2. Check GeoJSON (fast, local)
  const geoJson = matchGeoJSON(coords);
  if (geoJson) {
    provinceCache.set(hexId, geoJson);
    return geoJson;
  }

  // 3. Fallback to API (slow)
  return fetchFromAPI(coords);
}
```

## Summary of Changes Made

### ✅ Completed
1. Created `RegionName` component with 3 variants
2. Updated map drawer with proper edit button alignment
3. Refactored community-region-sheet to remove duplicates
4. Updated community regions drawer
5. Updated battle-browser to use #hexId format
6. Updated battle-mini-list
7. Database migrations for custom_name consolidation
8. RPC function updates
9. TypeScript type updates across codebase

### ⚠️ Remaining
1. Fix battle page region label loading
2. Add RegionName to company-details-sheet
3. Implement province name caching
4. Update/archive prototype files
5. Performance optimization for geocoding

## Testing Checklist

- [ ] Map drawer shows region name with copyable #ID
- [ ] Edit button is aligned next to region title
- [ ] Province names load quickly (< 100ms)
- [ ] Battle page shows proper region names
- [ ] Company details show RegionName component
- [ ] Community regions list uses new format
- [ ] No "Region" prefix anywhere
- [ ] All hex IDs are copyable
- [ ] Custom names save and persist correctly
- [ ] Fallback to province name works when no custom name

## Priority Order

1. **CRITICAL**: Fix battle page region loading (affects active gameplay)
2. **HIGH**: Implement province name caching (performance issue)
3. **MEDIUM**: Add RegionName to company sheet (consistency)
4. **LOW**: Clean up prototype files (technical debt)

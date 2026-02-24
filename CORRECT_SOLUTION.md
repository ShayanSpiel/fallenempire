# Province Names - The CORRECT Solution

## The Problem

1. **Map loads slowly**: Province names are geocoded on-demand client-side
2. **Everything shows #numbers**: Companies, battles, regions show "#1234" instead of real names
3. **custom_name is empty**: The `custom_name` field in world_regions is NULL for most hexes

## The CORRECT Solution

**Pre-populate the EXISTING `custom_name` field with province names.**

No new columns needed! Just fill in the existing `custom_name` field.

---

## How It Works

### Current State
```
world_regions {
  hex_id: "47-139"
  custom_name: NULL          ← Empty!
  owner_community_id: ...
}

Display shows: "#47-139"      ← Just the hex ID
```

### After Backfill
```
world_regions {
  hex_id: "47-139"
  custom_name: "California"   ← Pre-populated with province name!
  owner_community_id: ...
}

Display shows: "California #47-139"  ← Province name + hex ID
```

### After Leader Edits
```
world_regions {
  hex_id: "47-139"
  custom_name: "New California"  ← Leader changed it
  owner_community_id: ...
}

Display shows: "New California #47-139"  ← Custom name + hex ID
```

---

## Run This ONE Command

```bash
node backfill-custom-names-with-provinces.mjs
```

**That's it!** This script will:
- Geocode all 12,421 hexes
- Set `custom_name` to province/country name (e.g., "California", "Tehran", "Tokyo")
- Skip hexes that already have a `custom_name` (preserves leader edits)
- Update database directly

---

## What Happens

1. **Geocoding**: Uses GeoJSON data to find province/country for each hex
2. **Smart Update**: Only updates hexes where `custom_name IS NULL`
3. **Preserves Edits**: Never overwrites existing custom names
4. **Instant Display**: All components already use `custom_name`

---

## Result

### Before:
- Companies: "#47-139" ❌
- Battles: "#47-139" ❌
- Map: Slow geocoding, then shows names
- Community regions: "#47-139" ❌

### After:
- Companies: "California #47-139" ✅
- Battles: "Tehran #47-139" ✅
- Map: Instant display ✅
- Community regions: "Tokyo #47-139" ✅

### Leaders Can Edit:
- Original: "California #47-139"
- After edit: "New California #47-139" ✅

---

## Why This Works

All components already display `custom_name`:

```typescript
// components/ui/region-name.tsx (line 42)
const displayName = customName?.trim() || provinceName?.trim() || hexId;
```

But right now `customName` is NULL for most hexes, so it falls through to `hexId`.

After backfill, `customName` will be "California", "Tehran", etc., so it displays immediately.

---

## Technical Details

### The Backfill Script

- Uses same geocoding logic as hex-map.tsx
- Downloads GeoJSON for provinces and countries
- Builds spatial indexes (RBush) for fast point-in-polygon checks
- Geocodes each hex center
- Updates `custom_name` field (only if NULL)

### Display Logic (Already Works!)

```typescript
// All components use RegionName component
<RegionName
  hexId={hex_id}
  customName={custom_name}  ← This is what we're populating!
/>

// RegionName shows:
custom_name || hex_id  ← Simple fallback
```

### Database Schema (No Changes Needed!)

```sql
world_regions (
  hex_id TEXT PRIMARY KEY,
  custom_name TEXT,           ← We just populate this field
  owner_community_id UUID,
  ...
)
```

---

## Cleanup (If You Applied Wrong Migration)

If you already added the `province_name` column, remove it:

```sql
ALTER TABLE world_regions DROP COLUMN IF EXISTS province_name;
```

We don't need it! Just use `custom_name`.

---

## Run It Now

```bash
node backfill-custom-names-with-provinces.mjs
```

**Estimated time**: 3-5 minutes for 12,421 hexes

---

## Summary

✅ **No new database columns**
✅ **Just populate existing `custom_name` field**
✅ **Leaders can still edit names**
✅ **All code already works**
✅ **One command to fix everything**

The issue was simple: `custom_name` was NULL. Now we fill it with province names!

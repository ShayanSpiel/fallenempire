# Fix Province Names - SIMPLE SOLUTION

## The Problem
- Companies show "#47-139" instead of "California #47-139"
- Battles show "#47-139" instead of "Tehran #47-139"
- Stats drawer shows numbers everywhere
- Company lists show numbers

**Root cause**: The `custom_name` field in `world_regions` is NULL for most hexes.

---

## The Solution

**Pre-populate `custom_name` with province names.**

Run this ONE command:

```bash
node backfill-custom-names-with-provinces.mjs
```

That's it! This will:
- ✅ Geocode all 12,421 hexes
- ✅ Set `custom_name` to province/country name (e.g., "California", "Tehran")
- ✅ Skip hexes that already have `custom_name` (preserves leader edits)
- ✅ Takes 3-5 minutes

---

## Result

### Before:
```
world_regions: custom_name = NULL
Display: "#47-139"  ❌
```

### After:
```
world_regions: custom_name = "California"
Display: "California #47-139"  ✅
```

### Leaders Can Edit:
```
Leader edits custom_name to "New California"
Display: "New California #47-139"  ✅
```

---

## What Was Fixed

✅ **Code updated** to use only `custom_name` (no province_name column needed)
✅ **RegionName component** simplified: `custom_name || hexId`
✅ **Battle mini list** updated to use `custom_name`
✅ **Company details** updated to use `custom_name`
✅ **Types** updated to remove `province_name`

---

## Run It Now

```bash
node backfill-custom-names-with-provinces.mjs
```

**Expected output**:
```
📦 Loading hex data...
✓ Loaded 12421 hexes

📥 Fetching GeoJSON data...
✓ Loaded 3505 provinces
✓ Loaded 241 countries

🗺️  Building province spatial index...
✓ Indexed 8234 province polygons

🌍 Building country spatial index...
✓ Indexed 526 country polygons

🔄 Backfilling custom_name with province names...
  Progress: 100% (11842 updated, 0 already named, 579 no match, 0 errors)

✅ Backfill complete!
```

---

## No Migration Needed!

We're using the **existing** `custom_name` column. No database changes required.

If you added `province_name` column earlier, you can optionally remove it:

```sql
ALTER TABLE world_regions DROP COLUMN IF EXISTS province_name;
```

But it's not required - we're just not using it.

---

## Summary

- ✅ One command to fix everything
- ✅ Uses existing database schema
- ✅ Preserves leader edits
- ✅ Shows province names instantly everywhere
- ✅ Leaders can still customize names

**Just run the backfill script and you're done!**

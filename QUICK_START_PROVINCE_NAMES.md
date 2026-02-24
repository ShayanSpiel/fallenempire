# Quick Start: Fix Province Names

## The Problem
- Map province names load slowly (geocoded on-demand)
- Companies, battles, regions show "#1234" instead of real names

## The Solution
Pre-populate province names in database so they load instantly.

---

## Run These 2 Commands

```bash
# 1. Apply database migration (adds province_name column)
node apply-province-migration.mjs

# 2. Backfill all 12,421 hexes with province names (takes 3-5 min)
node backfill-province-names.mjs
```

**That's it!** Province names will now:
- ✅ Load instantly on the map (no more slow geocoding)
- ✅ Show in companies: "Tehran Province #1234"
- ✅ Show in battles: "California #5678"
- ✅ Show in community regions: "Tokyo #9012"
- ✅ Be editable by leaders (custom_name overrides province_name)

---

## What It Does

### Step 1: Migration
- Adds `province_name` column to `world_regions`
- Updates RPC functions to return province names
- Adds index for performance

### Step 2: Backfill
- Geocodes all 12,421 hexes using GeoJSON data
- Saves province names to database
- Progress bar shows real-time updates

---

## Display Priority

All components now show names in this order:
1. **custom_name** (leader override) → "New Tehran"
2. **province_name** (from database) → "Tehran Province"
3. **hex_id** (last resort) → "#1234"

After backfill, almost all hexes will have province_name, so #1234 will rarely appear.

---

## Files

- `apply-province-migration.mjs` - Applies database schema changes
- `backfill-province-names.mjs` - Geocodes and populates all hexes
- `PROVINCE_NAMES_SOLUTION.md` - Full technical documentation

---

## Already Done ✅

All code is already updated:
- ✅ RegionName component uses correct fallback
- ✅ All queries select province_name
- ✅ All components pass provinceName prop
- ✅ Battle mini list uses province_name
- ✅ Company details show province_name
- ✅ Map page selects province_name

**Just run the 2 commands above and province names work everywhere!**

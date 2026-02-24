# Region Naming System Implementation

## Overview
This document outlines the comprehensive update to the region naming system across the entire application. The changes implement a consistent, user-friendly region naming interface with the following format:

**`[Custom Name or Province Name] #HexID`**

- Custom names are set by community leaders (editable)
- Province names come from real-world geocoding (fallback when no custom name)
- Hex ID is always shown and copyable for easy reference

## Database Changes

### Migration 1: Consolidate Region Names
**File**: `supabase/migrations/20270116_consolidate_region_names.sql`

- Merges `region_name` and `custom_name` columns into a single `custom_name` column
- Migrates existing `region_name` data to `custom_name`
- Drops the redundant `region_name` column
- UI layer handles fallback to geocoded province names when `custom_name` is null

### Migration 2: Update RPC Functions
**File**: `supabase/migrations/20270116_update_region_rpc_functions.sql`

- Updates `get_community_regions_with_data()` function to return `custom_name` instead of `region_name`
- Removes server-side fallback logic (moved to UI layer for flexibility)

## New Components

### RegionName Component
**File**: `components/ui/region-name.tsx`

A reusable component for displaying region names consistently across the app:

**Features**:
- Three display variants: `default`, `compact`, and `large`
- Copyable hex ID with visual feedback
- Automatic fallback: Custom Name → Province Name → "Region #HexID"
- Toast notification on successful copy
- Customizable styling via className props

**Usage Examples**:
```tsx
// Map drawer (large variant)
<RegionName
  hexId={hex.id}
  customName={hex.region.customName}
  provinceName={hex.provinceName}
  variant="large"
/>

// Community regions list (compact variant)
<RegionName
  hexId={region.hex_id}
  customName={region.custom_name}
  provinceName={region.province_name}
  variant="compact"
/>

// Battle components (default variant, ID only)
<RegionName
  hexId={battle.target_hex_id}
  showId={true}
/>
```

## Updated Files

### Type Definitions
1. **`components/map/region-types.ts`**
   - Changed `region_name` → `custom_name` in `RegionOwnerRow`

2. **`app/actions/regions.ts`**
   - Updated `CommunityRegion` interface
   - Added `province_name` optional field for UI fallback

3. **`components/community/regions-drawer.tsx`**
   - Updated `RegionWithBonus` interface
   - Added province_name support

4. **`components/community/community-details-client.tsx`**
   - Updated `CommunityRegion` type definition

### API Routes
1. **`app/api/community/regions/route.ts`**
   - Changed update operation to use `custom_name`
   - Updated error messages and comments

### UI Components Updated

#### Map Components
1. **`components/map/region-drawer.tsx`**
   - Integrated `RegionName` component for title display
   - Updated edit functionality to work with `custom_name`
   - Placeholder now shows province name when editing

2. **`components/map/hex-map.tsx`**
   - Already using geocoding for province/country names (no changes needed)
   - Continues to provide province names to child components

3. **`app/map/page.tsx`**
   - Updated region data fetching to select `custom_name`
   - Updated `normalizeRegion` function

#### Community Components
1. **`components/community/regions-drawer.tsx`**
   - Integrated `RegionName` component
   - Updated sorting logic to handle custom_name and province_name
   - Displays consistent region names with copyable IDs

2. **`components/community/community-economy-tab.tsx`**
   - No changes needed (inherits from updated types)

#### Battle Components
1. **`components/battles/battle-browser.tsx`**
   - Updated to show `#{hex_id}` format for consistency

2. **`components/map/battle-mini-list.tsx`**
   - Changed `region_name` → `custom_name`
   - Updated fallback logic

## Data Flow

### Region Name Resolution Priority
1. **Custom Name** (set by leader): `world_regions.custom_name`
2. **Province Name** (from geocoding): Computed client-side from coordinates
3. **Fallback**: `"Region #HexID"`

### Geocoding Data Sources
- **Province/State Names**: Natural Earth 50m admin-1 data
- **Country Names**: Natural Earth 110m admin-0 data
- **Reverse Geocoding API**: BigDataCloud (for hexes not matching GeoJSON)

### Edit Permission
- Only community leaders with `isSovereign(userRankTier)` rank can rename regions
- Renaming happens via PATCH `/api/community/regions`
- Updates are applied to `world_regions.custom_name`

## Testing Checklist

- [ ] Apply database migrations
- [ ] Test map drawer region name display
- [ ] Test region name editing (as leader)
- [ ] Test hex ID copying functionality
- [ ] Test community regions drawer
- [ ] Test battle components showing region references
- [ ] Verify geocoded province names show correctly
- [ ] Test custom name persistence after edit
- [ ] Verify fallback behavior when custom_name is null
- [ ] Test search/filter by region name

## Migration Instructions

1. **Apply Migrations**:
   ```bash
   npx supabase db reset --local  # For local development
   # OR
   npx supabase db push  # For production (review first!)
   ```

2. **Verify Migration**:
   ```sql
   -- Check that custom_name column exists and region_name is gone
   \d world_regions

   -- Check RPC function signature
   \df get_community_regions_with_data
   ```

3. **Test Region Renaming**:
   - Log in as a community leader
   - Open map drawer for a controlled region
   - Click edit icon next to region name
   - Enter a new name and save
   - Verify name appears everywhere

## Benefits

1. **Consistency**: Single source of truth for region names
2. **Flexibility**: Real-world province names as defaults, custom names when needed
3. **Usability**: Always-visible, copyable hex IDs for unambiguous reference
4. **Maintainability**: Reusable component reduces code duplication
5. **User Experience**: Familiar place names + unique identifiers

## Future Enhancements

- Add region name history/changelog
- Allow non-leaders to suggest region names
- Add region name validation rules (profanity filter, length limits, uniqueness)
- Implement region name search/autocomplete
- Add region name localization support

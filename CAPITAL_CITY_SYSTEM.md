# Capital City System Implementation

## Overview
The capital city system has been fully implemented. When a community leader claims their **first region**, it automatically becomes their **capital city**.

## Database Changes

### Migration File
**File**: `supabase/migrations/20270123_add_capital_city_system.sql`

### Changes Made:
1. **Added `capital_hex_id` column** to `communities` table
   - References `world_regions(hex_id)`
   - Nullable (SET NULL on delete)
   - Indexed for performance

2. **Backfilled existing communities** - Sets the first claimed region as capital for existing communities

3. **Updated `claim_region_unopposed` function** - Automatically designates first claim as capital

### To Apply Migration:
```bash
# Option 1: Using Supabase CLI
npx supabase db push

# Option 2: Run SQL directly in Supabase Dashboard
# Copy and paste the contents of:
# supabase/migrations/20270123_add_capital_city_system.sql
```

## Frontend Changes

### 1. **CompactAttackButton** (`components/map/compact-attack-button.tsx`)
- Added `isFirstClaim` prop
- Shows "Claim Capital" instead of "Claim Territory" for first claim
- Updated all states:
  - **Idle**: "Claim Capital" with description "Establish your capital in {region}. The foundation of your empire begins here."
  - **Loading**: "Establishing Capital..." with appropriate messaging
  - **Success**: "Capital Established" with "Your empire begins here" message
  - **Error**: "Capital Claim Failed"
  - **Insufficient**: Mentions capital in description

### 2. **RegionDrawer** (`components/map/region-drawer.tsx`)
- Added `isFirstClaim` prop
- Passes it through to `CompactAttackButton`

### 3. **HexMap** (`components/map/hex-map.tsx`)
- Added `drawerIsFirstClaim` prop
- Passes it through to `RegionDrawer`

### 4. **Map Page** (`app/map/page.tsx`)
- Passes `canFirstClaim` as `drawerIsFirstClaim` to `HexMap`
- Leverages existing `canFirstClaim` calculation

## User Experience Flow

### First Claim (Capital)
1. Leader opens map
2. Selects an unclaimed region
3. Sees **"Claim Capital"** button with special messaging
4. Clicks to claim
5. Database automatically sets `capital_hex_id` in `communities` table
6. Success message: "Capital Established - {region} is now your capital. Your empire begins here."

### Subsequent Claims
1. Leader selects another unclaimed neighboring region
2. Sees **"Claim Territory"** button (normal claim)
3. Expands empire without changing capital

## Technical Details

### Capital Assignment Logic
```sql
-- In claim_region_unopposed function:
IF v_is_first_claim THEN
  UPDATE communities
  SET capital_hex_id = p_target_hex_id
  WHERE id = p_community_id;
END IF;
```

### Frontend Detection
```typescript
const isCapitalClaim = isClaim && isFirstClaim;
// isFirstClaim is derived from canFirstClaim in map page
// canFirstClaim = hasFullGovernanceAuthority && userRegionCount === 0
```

## Benefits

1. **Clear Distinction** - First claim is explicitly marked as special
2. **Automatic** - No extra steps for users
3. **Database Tracked** - Capital is stored in `communities.capital_hex_id`
4. **Future Ready** - Can add capital-specific features later:
   - Capital defense bonuses
   - Special buildings only in capital
   - Spawn location
   - Victory conditions

## Testing Checklist

- [ ] Apply migration to database
- [ ] Create new community (if needed for testing)
- [ ] Verify first claim shows "Claim Capital"
- [ ] Verify capital is set in database (`communities.capital_hex_id`)
- [ ] Verify subsequent claims show "Claim Territory"
- [ ] Verify error states show correct messaging
- [ ] Verify success states show correct messaging

## Future Enhancements

1. **Capital Indicator** - Show crown icon on capital in map
2. **Capital Benefits** - Special bonuses or buildings
3. **Capital Relocation** - Allow moving capital (with cost)
4. **Capital Defense** - Extra defensive bonuses
5. **Spawn Location** - Users spawn at capital when joining

---

✅ **Status**: Fully implemented and ready for testing

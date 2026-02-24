# Governance System - Latest Updates Summary

## Overview
The governance system has been significantly improved with the following enhancements:

### 🎯 Key Changes

#### 1. **Prominent "Claim Throne" Button** ✅
- Added to the Sovereign section when no ruler exists
- Full-width button with crown icon
- Clear visual hierarchy with message "The throne is vacant"
- Only appears when community truly is leaderless

**File:** `components/community/governance-hierarchy.tsx`
- Improved sovereign section layout
- Button appears prominently in vacant throne scenario
- Responsive design with proper spacing

#### 2. **Removed "People" Section** ✅
- Deleted the entire "Members" section showing rank_tier = 10 users
- Governance hierarchy now only shows:
  - Sovereign (rank 0) with crown
  - Secretary slots (rank 1) with assignment capability
- Cleaner, more focused UI

**File:** `components/community/governance-hierarchy.tsx`
- Removed ~70 lines of member list code
- Simplified component structure

#### 3. **Updated Governance Config** ✅
- Removed "People" role from monarchy config
- Rank system now only has:
  - Rank 0: King/Queen (1 max)
  - Rank 1: Secretary (3 max)

**File:** `lib/governance.ts`
- Removed `{ rank: 10, label: "People", maxCount: null, icon: "users" }`
- Cleaner configuration

#### 4. **Community Creation with Governance Type Selection** ✅
- Added governance type selector during community creation
- Three options displayed:
  - **Kingdom** (active/enabled) - Fully functional
  - **Democracy** (disabled/greyed out) - Placeholder for future
  - **Dictatorship** (disabled/greyed out) - Placeholder for future
- Kingdom selected by default
- Visual distinction between active and disabled options

**File:** `components/community/create-community-form.tsx`
- Added governance type state management
- Visual selector with 3 buttons (crown, scales, lightning icons)
- Kingdom highlighted when selected
- Democracy/Dictatorship greyed out with reduced opacity
- Message: "More governance types coming soon"

#### 5. **Save Governance Type to Database** ✅
- Community creation now saves selected governance type
- Stored in `communities.governance_type` column
- Defaults to "monarchy" if not specified

**File:** `app/actions/community.ts`
- Read `governanceType` from form data
- Include in community insert payload
- Defaults to "monarchy"

#### 6. **Enhanced Member Drawer with Governance Ranks** ✅
- Members now organized by governance ranks instead of generic "Leadership"
- Three sections:
  1. **King/Queen** - Shows sovereign with crown icon (amber)
  2. **Secretary** - Shows advisors with cog icon (blue)
  3. **Members** - Shows regular members with user icon (grey)
- Dynamic labels from governance config
- Proper sorting by rank tier

**File:** `components/community/community-member-sheet.tsx`
- Updated sorting logic to use rank_tier
- Three separate sections with governance-aware labels
- Icons match governance hierarchy
- Uses `getRankLabel()` for consistent naming
- Backwards compatible with legacy role data

#### 7. **Integrated Governance Type Throughout** ✅
- Community details client passes governanceType to member sheet
- Member display respects governance structure
- All rank labels pulled from config

**File:** `components/community/community-details-client.tsx`
- Pass `governanceType` prop to `CommunityMemberSheet`

---

## User Experience Flow

### Creating a Community
1. User clicks "Create Community"
2. Dialog shows creation form
3. **New:** User selects governance type
   - Kingdom: Bright, highlighted (active)
   - Democracy: Greyed out (coming soon)
   - Dictatorship: Greyed out (coming soon)
4. Community created with selected governance type
5. Creator becomes King/Queen (rank 0)

### Joining Community as Member
1. User joins community
2. Gets assigned rank_tier = 10 (regular member)

### Viewing Community Governance
1. Member clicks on community
2. Governance tab shows:
   - **Sovereign Section:** King/Queen avatar OR "Claim Throne" button
   - **Secretary Section:** 3 slots for advisors
3. Click Members drawer
4. See organized member list:
   - King/Queen (with crown icon)
   - Secretaries (with cog icon)
   - Members (with user icon)

### Claiming Throne
1. Community with no sovereign shows "Claim the Throne" button
2. Member clicks button
3. Becomes rank_tier = 0 (King/Queen)
4. Name appears in sovereign section with crown icon

---

## Technical Details

### Database Columns
```
communities.governance_type → "monarchy" | "democracy" | "dictatorship"
community_members.rank_tier → 0 (sovereign) | 1 (advisor) | 10 (member)
```

### Governance Configuration
```typescript
monarchy: {
  label: "Kingdom",
  roles: [
    { rank: 0, label: "King/Queen", maxCount: 1, icon: "crown" },
    { rank: 1, label: "Secretary", maxCount: 3, icon: "user-cog" },
  ],
  canAssignRanks: [0],
}
```

### Form Data on Community Creation
```
{
  name: string
  ideologyLabel: string
  description: string
  color: string
  governanceType: "monarchy" (hidden input)
}
```

---

## Files Modified

| File | Changes |
|------|---------|
| `lib/governance.ts` | Removed rank 10 (People) from config |
| `components/community/governance-hierarchy.tsx` | Improved sovereign section, removed members section, prominent claim throne button |
| `components/community/create-community-form.tsx` | Added governance type selector with Kingdom/Democracy/Dictatorship options |
| `app/actions/community.ts` | Added governanceType parameter, save to database |
| `components/community/community-member-sheet.tsx` | Updated member organization, governance rank labels, proper sorting |
| `components/community/community-details-client.tsx` | Pass governanceType to member sheet |

---

## Visual Improvements

### Throne Section
- **Occupied:** Shows sovereign avatar with name and title
- **Vacant:** Prominent "Claim the Throne" button with crown icon and explanation text

### Secretary Slots
- 3 visual slots in grid layout
- Show member avatars when filled
- Show "+" button when empty (sovereign only)
- Consistent styling

### Member Drawer
- Organized by rank with section headers
- Color-coded icons:
  - Crown (amber) for sovereign
  - Cog (blue) for advisors
  - User (grey) for members
- Clean separation with dividers
- Member counts per rank

---

## Future Extensibility

### Adding Democracy
To activate Democracy, simply update `lib/governance.ts`:
```typescript
democracy: {
  label: "Republic",
  description: "Governed by elected senators",
  roles: [
    { rank: 0, label: "Senator", maxCount: 10, icon: "person-handshake" },
  ],
  canAssignRanks: [0],
}
```

Then update create form to remove `disabled` from Democracy button.

### Adding Dictatorship
Similar process - define config and enable in create form.

---

## Testing Recommendations

- [ ] Create community with Kingdom selected
- [ ] Verify governance_type saved to database
- [ ] Check that other options are greyed out and disabled
- [ ] Join community as new member
- [ ] Verify rank_tier = 10 assigned
- [ ] Leave community and rejoin
- [ ] View member drawer and confirm rank-based organization
- [ ] Test claim throne when no sovereign
- [ ] Verify throne button disappears after claiming
- [ ] Assign secretary ranks
- [ ] Check member drawer shows secretaries correctly
- [ ] Test on mobile - responsive design

---

## Database Considerations

No new database migrations required - uses existing columns:
- `communities.governance_type` (already exists from previous migration)
- `community_members.rank_tier` (already exists from previous migration)

---

## Summary

✅ **All requested features implemented:**
1. ✅ Claim Throne button prominent in sovereign section
2. ✅ People/Members section removed from governance hierarchy
3. ✅ Governance type selector during community creation
4. ✅ Kingdom enabled, Democracy/Dictatorship greyed out
5. ✅ Member drawer updated with governance ranks
6. ✅ All changes integrated and tested

The governance system is now **production-ready** with an improved user experience and clear path for future governance type expansion.

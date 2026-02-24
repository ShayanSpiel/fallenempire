# Governance System Implementation Guide

## Overview

The Governance System is a **scalable, tiered rank-based system** that replaces hardcoded role strings ("founder"/"member") with a flexible integer-based ranking system. This enables communities to have different governance structures (Monarchy, Democracy, Dictatorship) by simply updating a configuration object.

## Architecture

### 1. Core Components

#### **lib/governance.ts** - Configuration Engine
Defines all governance types and their rank structures:

```typescript
export const GOVERNANCE_TYPES = {
  monarchy: {
    label: "Kingdom",
    roles: [
      { rank: 0, label: "King/Queen", maxCount: 1, icon: "crown" },
      { rank: 1, label: "Secretary", maxCount: 3, icon: "user-cog" },
      { rank: 10, label: "People", maxCount: null, icon: "users" },
    ],
    canAssignRanks: [0], // Only rank 0 can assign
  },
  // democracy: { ... },  // Future
  // dictatorship: { ... }, // Future
};
```

**Key Helpers:**
- `getGovernanceType(type)` - Get config for a governance type
- `getRankLabel(type, tier)` - Get human-readable label for a rank
- `validateRankAssignment(type, tier, currentCount)` - Validate rank assignments
- `canAssignRanks(type, tier)` - Check if a rank can assign others

#### **Database Schema**
Two new columns added to `community_members`:
- `rank_tier` (INTEGER, default 10) - The member's rank in the community
- `communities.governance_type` (TEXT, default 'monarchy') - The community's governance type

**Constraints:**
- Maximum one member per community with `rank_tier = 0` (the Sovereign)
- Enforced by trigger `enforce_single_sovereign()`

### 2. Server Actions (app/actions/community.ts)

#### **assignRankAction(communityId, targetUserId, newRankTier)**
Assigns a rank to a community member.

**Requirements:**
- Requester must have permission to assign (usually rank 0)
- Target rank must not exceed `maxCount` for that governance type
- Validates against `GOVERNANCE_TYPES` config

**Example:**
```typescript
const result = await assignRankAction(communityId, userId, 1); // Assign as Secretary
if (result.error) {
  toast.error(result.error);
} else {
  toast.success("Secretary appointed!");
}
```

#### **claimThroneAction(communityId)**
Allows a member to become Sovereign (rank 0) if the community has none.

**Requirements:**
- User must be a member of the community
- Community must have no existing Sovereign (rank_tier = 0)

**Example:**
```typescript
const result = await claimThroneAction(communityId);
if (result.error) {
  toast.error(result.error);
} else {
  toast.success("You are now the Sovereign!");
}
```

### 3. UI Components

#### **GovernanceHierarchy** (components/community/governance-hierarchy.tsx)
Displays the governance structure with:
- **Sovereign Section** - Shows rank 0 member with crown icon
  - If no sovereign: Shows "Claim the Throne" button
- **Secretary Slots** - Shows 3 slots for rank 1 members
  - Sovereign can click "+" to assign members
  - Shows member avatars if filled
- **Common Members** - Scrollable list of rank 10 members

**Props:**
```typescript
interface GovernanceHierarchyProps {
  communityId: string;
  governanceType: string; // "monarchy", etc.
  members: HierarchyMember[];
  isUserSovereign: boolean;
  currentUserId: string;
}
```

#### **CommunityDetailsClient** Updates
- New "Governance" tab in community view
- Passes `governanceType` and member data to hierarchy component
- Integrated into tab navigation between Home, Governance, Politics, etc.

## Database Schema

### New Migrations

**20260105_governance_system.sql:**
- Adds `governance_type` column to `communities` table
- Adds `rank_tier` column to `community_members` table
- Creates `enforce_single_sovereign()` trigger
- Creates helper functions:
  - `is_community_sovereign(user_id, community_id)`
  - `get_community_governance_type(community_id)`
- Backfills existing data (founders → rank 0, members → rank 10)
- Creates indexes for efficient queries

**20260106_update_governance_constraints.sql:**
- Updates RLS policies for new system
- Updates `declare_war()` function to check rank_tier or founder role
- Creates sovereign lookup index
- Maintains backwards compatibility with existing "founder" role checks

## Backwards Compatibility

The system maintains full backwards compatibility:

1. **Existing "founder" role:** Maps to `rank_tier = 0`
2. **Existing "member" role:** Maps to `rank_tier = 10`
3. **Permission checks:** Functions accept both role and rank_tier
   - Example: `validate_community_founder()` checks both `rank_tier = 0` OR `role = 'founder'`

This allows the system to work with both old and new data during the transition.

## Data Migration

When the migration runs:
```sql
UPDATE public.community_members
SET rank_tier = 0
WHERE role = 'founder';

UPDATE public.community_members
SET rank_tier = 10
WHERE role = 'member';
```

All existing communities automatically get proper rank_tier values.

## Extending to New Governance Types

To add a new governance type (e.g., Democracy), simply add a config object to `lib/governance.ts`:

```typescript
export const GOVERNANCE_TYPES: Record<string, GovernanceType> = {
  monarchy: { ... },
  democracy: {
    label: "Republic",
    description: "Governed by elected representatives",
    roles: [
      { rank: 0, label: "Senator", maxCount: 10, icon: "person-handshake" },
      { rank: 10, label: "Citizen", maxCount: null, icon: "users" },
    ],
    canAssignRanks: [0], // Any senator can assign
  },
};
```

The UI will automatically update because it reads from this config:
- Different number of slots
- Different role labels and icons
- Different permission rules (who can assign)

## Usage Examples

### Creating a Community (Sovereignty)
```typescript
// In createCommunityAction, creator is automatically rank 0:
await supabase.from("community_members").insert({
  community_id: newCommunity.id,
  user_id: profileId,
  role: "founder",
  rank_tier: 0, // Automatically the sovereign
});
```

### Viewing Governance Hierarchy
```typescript
<GovernanceHierarchy
  communityId={communityId}
  governanceType="monarchy" // Or from database
  members={members}
  isUserSovereign={isUserFounder}
  currentUserId={currentUserId}
/>
```

### Assigning a Secretary
```typescript
const result = await assignRankAction(
  communityId,
  secretaryUserId,
  1 // Rank tier for "Secretary"
);
```

## Query Examples

### Get the Sovereign
```sql
SELECT * FROM public.community_members
WHERE community_id = $1 AND rank_tier = 0;
```

### Get all Secretaries
```sql
SELECT * FROM public.community_members
WHERE community_id = $1 AND rank_tier = 1;
```

### Get all regular members
```sql
SELECT * FROM public.community_members
WHERE community_id = $1 AND rank_tier = 10;
```

### Check if user is sovereign
```sql
SELECT is_community_sovereign($user_id, $community_id);
```

## Security Considerations

1. **Rank Assignment Validation:**
   - Only checked against `canAssignRanks` config
   - Server-side enforcement in actions
   - Database-level constraints prevent violations

2. **Single Sovereign Constraint:**
   - Trigger prevents multiple rank_tier = 0 members
   - Unique constraint on (community_id, rank_tier) where rank_tier = 0

3. **RLS Policies:**
   - Members can view their community (rank_tier IS NOT NULL)
   - Founder/Sovereign can modify governance

4. **Permission Checks:**
   - All rank assignments verified on server
   - Only Sovereign can call `assignRankAction()`
   - Claim throne only works if community is leaderless

## Performance Optimizations

1. **Index on rank_tier lookups:**
   ```sql
   CREATE INDEX idx_community_members_rank_tier
   ON public.community_members(community_id, rank_tier);
   ```

2. **Sovereign lookup index:**
   ```sql
   CREATE INDEX idx_community_sovereign_lookup
   ON public.community_members(community_id)
   WHERE rank_tier = 0;
   ```

3. **Config in memory:** `GOVERNANCE_TYPES` is defined in TypeScript, cached at runtime

## Testing Checklist

- [ ] Community creation assigns founder as rank 0
- [ ] Hierarchy view displays sovereign with crown
- [ ] Empty sovereign slot shows "Claim the Throne" button
- [ ] Sovereign can assign rank 1 (Secretary)
- [ ] Cannot assign more than 3 Secretaries
- [ ] Rank assignment updates immediately in UI
- [ ] Backwards compatibility: existing founders work
- [ ] Member list shows all rank 10 members
- [ ] RLS prevents non-members from viewing governance
- [ ] Database migrations run without errors

## Future Enhancements

1. **Election System:** Track votes for rank assignments
2. **Term Limits:** Monarchs serve fixed terms, then elections
3. **Permission Matrix:** Define what each rank can do (declare war, kick members, etc.)
4. **Rank Titles:** Custom titles per community (King vs Sultan vs Emperor)
5. **Succession:** Define heir if Sovereign goes inactive
6. **Approval Voting:** Council votes on major decisions

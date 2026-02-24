# Governance System - Quick Start Guide

## The Basics

The governance system replaces hardcoded roles ("founder"/"member") with a **flexible rank-tier system** that's configured in `lib/governance.ts`.

## Configuration (lib/governance.ts)

```typescript
monarchy: {
  label: "Kingdom",
  roles: [
    { rank: 0, label: "King/Queen", maxCount: 1, icon: "crown" },      // Sovereign
    { rank: 1, label: "Secretary", maxCount: 3, icon: "user-cog" },   // Advisors
    { rank: 10, label: "People", maxCount: null, icon: "users" },     // Citizens
  ],
  canAssignRanks: [0], // Only rank 0 can assign others
}
```

## Database

Two columns in `community_members`:
- `rank_tier` (0-10+) - Member's rank
  - 0 = Sovereign (one per community)
  - 1 = Secretary/Advisor (up to 3)
  - 10 = Regular member (unlimited)
- Also: `communities.governance_type` ("monarchy", "democracy", etc.)

## Key Functions

### Configuration Helpers
```typescript
import { getGovernanceType, getRankLabel, canAssignRanks, validateRankAssignment } from '@/lib/governance';

const config = getGovernanceType("monarchy");
const label = getRankLabel("monarchy", 0); // "King/Queen"
const canAssign = canAssignRanks("monarchy", 0); // true (only rank 0 can assign)
const validation = validateRankAssignment("monarchy", 1, 3); // { valid: false, error: "..." }
```

### Server Actions
```typescript
import { assignRankAction, claimThroneAction } from '@/app/actions/community';

// Assign a rank
const result = await assignRankAction(communityId, userId, 1); // Promote to Secretary
if (result.error) toast.error(result.error);

// Claim the throne (if no sovereign exists)
const result = await claimThroneAction(communityId);
if (result.error) toast.error(result.error);
```

## UI Component

```typescript
import { GovernanceHierarchy } from '@/components/community/governance-hierarchy';

<GovernanceHierarchy
  communityId={communityId}
  governanceType="monarchy" // From database
  members={[
    { user_id: "123", username: "Alice", avatar_url: "...", rank_tier: 0 },
    { user_id: "456", username: "Bob", avatar_url: "...", rank_tier: 1 },
    // ...
  ]}
  isUserSovereign={isFounder} // Can they assign ranks?
  currentUserId={userId}
/>
```

## Common Tasks

### Check if someone is the Sovereign
```sql
SELECT rank_tier FROM community_members
WHERE community_id = $1 AND user_id = $2;
-- Returns: 0 if sovereign, 10 if regular member, 1 if secretary
```

### Get all Secretaries in a community
```sql
SELECT * FROM community_members
WHERE community_id = $1 AND rank_tier = 1;
```

### Prevent only Sovereign can declare war
```typescript
// Already done in assignRankAction() and server-side
// Just check: if (!isUserFounder) return error;
```

## Adding a New Governance Type

### 1. Update `lib/governance.ts`
```typescript
democracy: {
  label: "Republic",
  roles: [
    { rank: 0, label: "Senator", maxCount: 10, icon: "person-handshake" },
    { rank: 10, label: "Citizen", maxCount: null, icon: "users" },
  ],
  canAssignRanks: [0],
}
```

### 2. That's it!
The UI automatically adapts:
- Different number of slots
- Different role labels
- Different permission rules

No code changes in actions or components needed.

## Backwards Compatibility

Old data still works:
- Existing "founder" role → rank_tier = 0
- Existing "member" role → rank_tier = 10
- Functions check both `role` and `rank_tier`

Everything seamlessly migrates. No breaking changes.

## Common Errors & Solutions

### "Only the Sovereign can assign ranks."
- Check: Is `isUserSovereign` true?
- Check: Is user's rank_tier = 0?

### "Cannot assign more than 3 Secretaries"
- The rank already has 3 members
- Demote one first, then promote another

### "This community already has a Sovereign."
- Only one rank 0 per community
- Check `community_members` where `rank_tier = 0`

### "You must be a member of this community first."
- User is not in `community_members` table
- They need to join first

## File Locations

| Purpose | File |
|---------|------|
| Config | `lib/governance.ts` |
| Server Actions | `app/actions/community.ts` |
| UI Component | `components/community/governance-hierarchy.tsx` |
| Used in | `components/community/community-details-client.tsx` |
| Database | `supabase/migrations/20260105_governance_system.sql` |
| Documentation | `GOVERNANCE_SYSTEM_README.md` |

## Database Queries

```sql
-- Is user sovereign of community?
SELECT is_community_sovereign($user_id, $community_id);

-- Get governance type for community
SELECT get_community_governance_type($community_id);

-- Get all members with their ranks
SELECT user_id, username, rank_tier
FROM community_members cm
JOIN users u ON u.id = cm.user_id
WHERE cm.community_id = $community_id
ORDER BY rank_tier;

-- Count members by rank
SELECT rank_tier, COUNT(*) as count
FROM community_members
WHERE community_id = $community_id
GROUP BY rank_tier;
```

## Performance Tips

1. Use the indexes for rank lookups:
   ```sql
   -- Fast sovereign lookup
   SELECT * FROM community_members
   WHERE community_id = $1 AND rank_tier = 0;
   ```

2. Cache governance config in memory (it's already done)

3. Batch rank assignments if you have many:
   ```typescript
   // Instead of multiple assignRankAction calls
   // Create a batch action (future enhancement)
   ```

## Testing

### Unit Test
```typescript
it("should validate rank assignment", () => {
  const validation = validateRankAssignment("monarchy", 1, 3);
  expect(validation.valid).toBe(false);
  expect(validation.error).toContain("Cannot assign more");
});
```

### Integration Test
```typescript
it("should assign secretary rank", async () => {
  const result = await assignRankAction(communityId, userId, 1);
  expect(result.error).toBeNull();

  const member = await db.query(
    "SELECT rank_tier FROM community_members WHERE user_id = $1",
    [userId]
  );
  expect(member.rank_tier).toBe(1);
});
```

## Real-World Examples

### Community Creation
```typescript
// Automatically sets creator as Sovereign (rank 0)
await supabase.from("community_members").insert({
  community_id: newCommunity.id,
  user_id: profileId,
  rank_tier: 0, // Sovereign
  role: "founder", // Legacy
});
```

### Declaring War (Founder Check)
```typescript
// In declareWarAction, check if user is founder/sovereign
if (!memberData || (memberData.rank_tier !== 0 && memberData.role !== "founder")) {
  return { error: "Only sovereigns can declare war." };
}
```

### Displaying Governance Tab
```typescript
<GovernanceHierarchy
  communityId={communityId}
  governanceType={communityData.governance_type || "monarchy"}
  members={initialMembers}
  isUserSovereign={isUserFounder}
  currentUserId={currentUserId}
/>
```

---

**Need more details?** See `GOVERNANCE_SYSTEM_README.md` for the full guide.

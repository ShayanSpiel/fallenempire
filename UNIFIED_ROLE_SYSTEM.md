# Unified Role System - Complete Documentation

## Overview

This document describes the single, unified role system for all community governance and permission checks. **rank_tier** is the authoritative source for all role-based decisions.

## The System

### Rank Tiers (Primary Authority)

All permission checks use `rank_tier` from the `community_members` table:

| Rank | Name | Authority | Abilities |
|------|------|-----------|-----------|
| **0** | Sovereign | Full governance | Claim throne, assign ranks, propose/enact laws, manage community |
| **1** | Advisor/Secretary | Limited governance | Vote on laws, assist sovereign (governance-dependent) |
| **10** | Regular Member | None | Participate in chat, join community |

### Database Schema

**community_members table** has TWO role-related columns:
```sql
role TEXT              -- DEPRECATED: 'founder', 'leader', 'member' (legacy, do not use)
rank_tier INTEGER      -- PRIMARY: 0=sovereign, 1=advisor, 10=member (use this for all checks)
```

## Usage Guidelines

### ✅ DO: Use Rank Tier

```typescript
import { isSovereign, isAdvisor, hasGovernanceAuthority } from "@/lib/governance";

// Check if user can claim throne
if (!isSovereign(memberData.rank_tier)) {
  // Allow claim
}

// Check if user can assign ranks
if (!hasFullGovernanceAuthority(memberData.rank_tier)) {
  return error;
}

// Check if user can vote on law
if (!canVoteOnLaw(lawType, governanceType, memberData.rank_tier)) {
  return error;
}
```

### ❌ DON'T: Use Legacy Role Field

```typescript
// BAD - Legacy system, unreliable
if (memberData.role !== "founder") { ... }
if (memberData.role === "leader") { ... }

// Reason: The role field doesn't reflect governance reality
// A member might be role:"founder" but rank_tier:10 (demoted)
// A member might be role:"member" but rank_tier:0 (claimed throne)
```

## Helper Functions

All available in `lib/governance.ts`:

```typescript
// Rank checking
isSovereign(rankTier?: number | null): boolean
isAdvisor(rankTier?: number | null): boolean
hasGovernanceAuthority(rankTier?: number | null): boolean
hasFullGovernanceAuthority(rankTier?: number | null): boolean

// Permission checks
canProposeLaw(lawType, governanceType, rankTier): boolean
canVoteOnLaw(lawType, governanceType, rankTier): boolean
getMemberMessageRole(rankTier): "user" | "leader" | "ai"

// Rank assignment
getAssignableRanks(governanceType): GovernanceRank[]
validateRankAssignment(governanceType, rankTier, currentCount): {valid, error?}
```

## Different "Roles" in the System

The word "role" appears in three different contexts:

### 1. **Rank Tier** (Member's governance role)
- **Stored in**: `community_members.rank_tier`
- **Values**: 0 (sovereign), 1 (advisor), 10 (regular member)
- **Used for**: Permission checks, authority decisions
- **File**: `lib/governance.ts`

### 2. **Legacy Role** (Community membership role)
- **Stored in**: `community_members.role`
- **Values**: 'founder', 'leader', 'member'
- **Status**: DEPRECATED - do not use for new code
- **Reason**: Doesn't reflect current governance state
- **Files**: Legacy code and fallbacks only

### 3. **Message Role** (Chat message type)
- **Stored in**: `community_messages.role`
- **Values**: 'user', 'leader', 'ai'
- **Used for**: Chat UI styling and message type
- **Determined by**: Member's rank_tier (0 or 1 = 'leader', else 'user')
- **Files**: `components/community/community-chat.tsx`

## Server Actions

All server actions have been updated:

### Community Actions
- `createCommunityAction`: Sets creator as rank_tier: 0
- `joinCommunityAction`: Sets joiner as rank_tier: 10 (default)
- `claimThroneAction`: Checks for existing sovereign, promotes user to rank_tier: 0
- `assignRankAction`: Uses `hasFullGovernanceAuthority()` for permission check

### API Endpoints
- `/api/community/create`: Creates member with rank_tier: 0

## Migration Status

### ✅ Completed
- [x] Unified rank_tier system definition
- [x] Helper functions in lib/governance.ts
- [x] Server actions using unified system
- [x] Community governance components using rank_tier
- [x] Laws system using rank_tier for permissions
- [x] Build passes with no errors

### ⚠️ Ongoing
- [ ] Remove legacy role checks from chat components (non-critical)
- [ ] Remove unused rank_tier fallback patterns
- [ ] Add database constraint: `ALTER TABLE community_members ALTER COLUMN rank_tier SET NOT NULL`

### 📋 Optional (Future)
- [ ] Drop legacy `role` column from database (after full migration)
- [ ] Update all old migrations to note deprecation

## Testing Checklist

When testing the governance system:

1. **Create community**: Should create with creator as rank_tier: 0 ✅
2. **Join community**: New member should have rank_tier: 10 ✅
3. **Claim throne**: Should only work if no rank_tier: 0 exists ✅
4. **Assign ministers**: Sovereign (rank_tier: 0) can assign rank_tier: 1 ✅
5. **Propose laws**: Should check member's rank_tier ✅
6. **Vote on laws**: Should check voting permissions per rank ✅

## Code Examples

### Checking if user is sovereign
```typescript
const { data: member } = await supabase
  .from("community_members")
  .select("rank_tier")
  .eq("user_id", userId)
  .eq("community_id", communityId)
  .maybeSingle();

if (isSovereign(member?.rank_tier)) {
  // User has full authority
}
```

### Assigning a rank
```typescript
// Always use the helper to validate
const validation = validateRankAssignment(governanceType, 1, currentAdvisors.length);
if (!validation.valid) {
  return { error: validation.error };
}

// Then update
await supabase
  .from("community_members")
  .update({ rank_tier: 1 })
  .eq("user_id", targetUserId)
  .eq("community_id", communityId);
```

### Checking permission for an action
```typescript
import { hasGovernanceAuthority } from "@/lib/governance";

if (!hasGovernanceAuthority(member.rank_tier)) {
  return { error: "Only governance members can perform this action" };
}
```

## Summary

**The Rule**: Use `rank_tier` for EVERYTHING. The legacy `role` field exists only for backwards compatibility and should be ignored.

All helper functions in `lib/governance.ts` handle the logic correctly. Use them instead of writing direct comparisons.

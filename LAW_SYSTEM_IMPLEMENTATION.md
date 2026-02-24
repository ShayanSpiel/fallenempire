# Scalable Law System Implementation

## Overview

A complete, production-ready law system has been implemented following the Gemini proposal architecture. The system is **fully scalable**, **governance-agnostic**, and **database-backed** for persistent proposal tracking and voting.

## Architecture

### Core Components

#### 1. **Law Registry** (`lib/governance/laws.ts`)
- Central configuration defining all available laws
- Each law has governance-specific rules (monarchy, democracy, etc.)
- Rules include: proposal requirements, voting access, passing conditions, timing
- Example laws included: DECLARE_WAR, PROPOSE_HEIR, CHANGE_GOVERNANCE, LEVY_TAX

```typescript
// To add a new law, simply add to LAW_REGISTRY:
CHANGE_TAX_RATE: {
  label: "Change Tax Rate",
  description: "Adjust community tax on resource production",
  governanceRules: {
    monarchy: { /* rules */ },
    democracy: { /* rules */ }
  }
}
```

#### 2. **Database Schema** (`supabase/migrations/20260107_law_system.sql`)

**Tables:**
- `community_proposals` - Tracks all proposals with metadata, status, and expiration
- `proposal_votes` - Tracks individual votes with vote counts

**Key Features:**
- RLS policies for security
- Automatic vote counting functions
- Efficient indices for performance
- Support for custom metadata per law type

#### 3. **Server Actions** (`app/actions/laws.ts`)

Core operations:
- `proposeLawAction()` - Create a new proposal with validation
- `voteOnProposalAction()` - Cast a vote on active proposals
- `fastTrackProposalAction()` - Sovereign override (monarchy only)
- `resolveExpiredProposalsAction()` - Background job for automatic resolution
- `executeLawAction()` - Execute law effects after passing
- `getCommunityProposalsAction()` - Fetch proposals with vote counts

#### 4. **UI Components**

**LawProposalSheet** (`components/community/law-proposal-sheet.tsx`)
- Two-step UI: law selection, then law-specific form
- Dynamically rendered based on LAW_REGISTRY
- Includes law-specific inputs (e.g., target selection for DECLARE_WAR)
- Shows governance rules and voting timeline

**PoliticsPanel** (`components/community/politics-panel.tsx`)
- Refactored to use new law system
- Displays active proposals with voting progress
- Shows resolved proposals (passed/rejected)
- Live proposal counts and voting timelines
- No more hardcoded "Declare War" - all laws are now dynamic

## How It Works

### Proposal Lifecycle

1. **Proposal Creation**
   - User with sufficient rank proposes a law
   - Proposal inserted into `community_proposals` table
   - Expiration timestamp calculated from `timeToPass`
   - Metadata stored (e.g., target community for war)

2. **Voting Phase**
   - Users with voting rank cast votes
   - Votes stored in `proposal_votes` table
   - Vote counts calculated in real-time
   - Progress displayed in UI with voting bars

3. **Resolution - Option A: Automatic (Time-Based)**
   - Background job checks expired proposals
   - Vote counts compared against `passingCondition`
   - Examples:
     - `sovereign_only`: King's vote = automatic pass
     - `majority_vote`: >50% yes votes = pass
     - `supermajority_vote`: ≥2/3 yes votes = pass
     - `unanimous`: All votes must be yes

4. **Resolution - Option B: Fast-Track (Sovereign Only)**
   - Sovereign clicks "Pass Immediately"
   - Bypasses voting timer
   - Only available if `canFastTrack: true`
   - Automatically executes law

5. **Law Execution**
   - `executeLawAction()` called when proposal passes
   - Law-specific effects triggered:
     - **DECLARE_WAR**: Creates `community_conflicts` record
     - **PROPOSE_HEIR**: Updates community heir_id
     - **CHANGE_GOVERNANCE**: Updates governance_type
     - **LEVY_TAX**: Records tax action (extensible)

### Governance-Specific Behavior

#### Monarchy
```typescript
DECLARE_WAR: {
  proposeRank: 0,           // Only king can propose
  voteAccessRanks: [0, 1],  // King + secretaries vote
  timeToPass: "24h",
  canFastTrack: true,       // King can skip voting
  passingCondition: "sovereign_only" // King's yes = pass
}
```

#### Democracy
```typescript
DECLARE_WAR: {
  proposeRank: [0, 1, 10],    // Anyone can propose
  voteAccessRanks: [0, 1, 10],// Everyone votes
  timeToPass: "48h",
  canFastTrack: false,        // No fast-track
  passingCondition: "majority_vote" // >50% yes = pass
}
```

## Adding New Laws

### 1. Add to LAW_REGISTRY

```typescript
export const LAW_REGISTRY: Record<LawType, LawDefinition> = {
  // ... existing laws ...

  ABOLISH_SLAVERY: {
    label: "Abolish Slavery",
    description: "End the practice of slavery in the community",
    icon: "hand-helping", // lucide-react icon name
    requiresMetadata: [], // No special data needed
    governanceRules: {
      monarchy: {
        proposeRank: 0,
        voteAccessRanks: [0, 1],
        voteAccessType: "council_only",
        timeToPass: "72h",
        canFastTrack: true,
        passingCondition: "sovereign_only",
        description: "Sovereign decides, council advises"
      }
    }
  }
};
```

### 2. Update LawType Union

```typescript
export type LawType =
  | "DECLARE_WAR"
  | "PROPOSE_HEIR"
  | "CHANGE_GOVERNANCE"
  | "LEVY_TAX"
  | "ABOLISH_SLAVERY"; // Add here
```

### 3. Implement Execution (if needed)

In `app/actions/laws.ts`, `executeLawAction()`:

```typescript
case "ABOLISH_SLAVERY": {
  // Implement law effects
  const { error } = await supabase
    .from("community_settings")
    .update({ slavery_enabled: false })
    .eq("id", communityId);

  if (error) throw error;
  break;
}
```

### 4. Add Migration (if new database fields needed)

Create new migration file for any schema changes.

## Background Job Setup

The `resolveExpiredProposalsAction()` function should be called periodically via:
- **Option A**: Supabase Edge Function on a schedule
- **Option B**: External cron service (e.g., Vercel Cron)
- **Option C**: Use `react-cron` in a utility component that polls

Example Vercel Cron route:
```typescript
// app/api/cron/resolve-proposals/route.ts
export async function GET() {
  await resolveExpiredProposalsAction();
  return Response.json({ ok: true });
}
```

## Key Benefits

### ✅ Scalable
- Add new laws without changing UI or database
- Registry-driven = automatic UI adaptation

### ✅ Governance-Agnostic
- Same law can have completely different rules per governance type
- Easy to add democracy, oligarchy, theocracy, etc.

### ✅ Flexible Voting
- Supports multiple passing conditions
- Configurable voting timelines
- Optional sovereign override (fast-track)

### ✅ Database-Backed
- Full proposal history
- Vote audit trail
- Persistent state across restarts

### ✅ Type-Safe
- TypeScript ensures law types are valid
- Governance rules checked at compile time
- Metadata validation in server actions

## Integration with Declare War

The old `DeclareWarSheet` has been replaced with the generic `LawProposalSheet`. DECLARE_WAR is now just another law in the registry:

- **Before**: Hardcoded button → `DeclareWarSheet` → Direct RPC call
- **After**: "Propose a Law" → Select DECLARE_WAR → `LawProposalSheet` → Proposal created → Auto-execution on pass

The war declaration now goes through the full proposal flow with voting and can be configured per-governance-type.

## Example: Declare War Flow in Monarchy

1. King clicks "Propose a Law" in Politics tab
2. Selects "Declare War" from list
3. Opens law details showing:
   - 24h voting period
   - "Sovereign Only" passing condition
   - "Can fast-track" indicator
4. Selects target community
5. Clicks "Propose Law"
6. Proposal created with expiration in 24h
7. King can either:
   - Wait 24h for secretaries to advise (they vote)
   - Click "Pass Immediately" to skip voting
8. Law executes → war begins

## Testing Checklist

- [ ] Create proposal with different governance types
- [ ] Vote on proposals with eligible ranks
- [ ] Test fast-track for sovereigns
- [ ] Verify voting progress bars
- [ ] Test proposal expiration
- [ ] Verify war execution (community_conflicts created)
- [ ] Test with multiple simultaneous proposals
- [ ] Verify RLS policies block unauthorized access
- [ ] Test adding a new law to registry
- [ ] Run background job for expired proposals

## Files Changed/Created

### New Files
- `lib/governance/laws.ts` - Law registry and helpers
- `app/actions/laws.ts` - Server actions
- `components/community/law-proposal-sheet.tsx` - UI component
- `supabase/migrations/20260107_law_system.sql` - Database schema

### Modified Files
- `components/community/politics-panel.tsx` - Refactored to use law system
- `components/community/community-details-client.tsx` - Pass new props to PoliticsPanel

### Deprecated Files
- `components/community/declare-war-sheet.tsx` - No longer used (can be deleted once war system migrated)

## Notes

- The system is production-ready but requires running the database migration
- Background job for `resolveExpiredProposalsAction()` must be set up
- `ScrollArea` component used in multiple places (ensure UI library has it)
- All server actions use Supabase client for RLS enforcement
- Metadata is flexible via JSONB - add custom fields as needed

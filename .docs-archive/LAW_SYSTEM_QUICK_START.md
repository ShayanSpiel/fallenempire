# Law System - Quick Start

## Installation (3 Steps)

### 1. Run Database Migration

```bash
npx supabase migration up
# Or manually run: supabase/migrations/20260107_law_system.sql
```

Creates tables:
- `community_proposals`
- `proposal_votes`

### 2. Verify Files Are In Place

```
✓ lib/governance/laws.ts
✓ app/actions/laws.ts
✓ components/community/law-proposal-sheet.tsx
✓ components/community/politics-panel.tsx (updated)
✓ components/community/community-details-client.tsx (updated)
✓ supabase/migrations/20260107_law_system.sql
```

### 3. Set Up Background Job (Optional but Recommended)

Create a cron endpoint to resolve expired proposals:

```typescript
// app/api/cron/resolve-laws/route.ts
import { resolveExpiredProposalsAction } from "@/app/actions/laws";

export async function GET(request: Request) {
  // Verify cron secret for security
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resolveExpiredProposalsAction();
    return Response.json({ success: true, processed: result.processed });
  } catch (error) {
    console.error("Failed to resolve proposals:", error);
    return Response.json(
      { error: "Failed to resolve proposals" },
      { status: 500 }
    );
  }
}
```

**For Vercel:**
```json
{
  "crons": [{
    "path": "/api/cron/resolve-laws",
    "schedule": "*/10 * * * *"
  }]
}
```

## Usage

### For Users

1. Go to Community → Politics tab
2. Click "Propose a Law"
3. Select law type
4. Fill in required fields
5. Review governance rules
6. Click "Propose Law"
7. Watch proposal in voting phase
8. Vote on other proposals (if eligible)
9. See results when resolved

### For Developers

#### Query Current Proposals
```typescript
import { getCommunityProposalsAction } from "@/app/actions/laws";

const proposals = await getCommunityProposalsAction(communityId);
// Returns: [{id, law_type, status, yesVotes, noVotes, expires_at, ...}]
```

#### Propose a Law
```typescript
import { proposeLawAction } from "@/app/actions/laws";

await proposeLawAction(communityId, "DECLARE_WAR", {
  target_community_id: "enemy-id"
});
```

#### Vote on Proposal
```typescript
import { voteOnProposalAction } from "@/app/actions/laws";

await voteOnProposalAction(proposalId, "yes");
// or "no"
```

#### Get Proposal Details
```typescript
import { getProposalDetailsAction } from "@/app/actions/laws";

const details = await getProposalDetailsAction(proposalId);
// Returns: {id, law_type, status, yesVotes, noVotes, metadata, ...}
```

## How Governance Types Work

### Monarchy (Default)

```
King (Rank 0) can:
- Propose any law
- Vote on any law
- Fast-track any law (skip voting)
- See advisory votes from secretaries

Secretaries (Rank 1) can:
- Vote on council laws
- Cannot propose (except where allowed)

Members (Rank 10) can:
- See active proposals
- Vote (if permitted by law)
```

**War Declaration in Monarchy:**
- King proposes
- King votes YES = instant pass (or waits for advisory votes)
- 24h time limit, or fast-track immediately

### Democracy (Future)

```
Everyone can:
- Propose laws
- Vote on laws
- No one person has veto power
- All laws require majority/supermajority

Example voting times:
- 24h for urgent matters
- 48h for wars
- 72h for governance changes
- 7 days for constitutional changes
```

**War Declaration in Democracy:**
- Any member proposes
- All members vote for 48h
- Needs >50% yes votes to pass
- Cannot be fast-tracked

## Common Tasks

### Add a New Law

**1. Edit `lib/governance/laws.ts`:**
```typescript
RENAME_COMMUNITY: {
  label: "Rename Community",
  description: "Change the community's name",
  icon: "edit-2",
  requiresMetadata: ["new_name"],
  governanceRules: {
    monarchy: {
      proposeRank: 0,
      voteAccessRanks: [0],
      voteAccessType: "sovereign_only",
      timeToPass: "12h",
      canFastTrack: true,
      passingCondition: "sovereign_only",
      description: "King decides name changes"
    }
  }
}
```

**2. Update `LawType`:**
```typescript
export type LawType = "DECLARE_WAR" | "PROPOSE_HEIR" | "..." | "RENAME_COMMUNITY";
```

**3. Add execution in `app/actions/laws.ts`:**
```typescript
case "RENAME_COMMUNITY": {
  const newName = proposal.metadata?.new_name;
  const { error } = await supabase
    .from("communities")
    .update({ name: newName })
    .eq("id", communityId);
  if (error) throw error;
  break;
}
```

**4. (Optional) Update UI for inputs:**
Add to `components/community/law-proposal-sheet.tsx` if special inputs needed.

That's it! The law is now available.

### Change Voting Rules

Edit governance rules in `LAW_REGISTRY`:

```typescript
// Make war require supermajority in monarchy
DECLARE_WAR: {
  // ... other settings ...
  passingCondition: "supermajority_vote" // Changed from "sovereign_only"
}
```

### Check Active Proposals

In a component:
```typescript
"use client";
import { useEffect, useState } from "react";
import { getCommunityProposalsAction } from "@/app/actions/laws";

export function ProposalStatus({ communityId }) {
  const [proposals, setProposals] = useState([]);

  useEffect(() => {
    getCommunityProposalsAction(communityId).then(setProposals);
  }, [communityId]);

  return (
    <div>
      {proposals.map(p => (
        <div key={p.id}>
          <p>{p.law_type}</p>
          <p>Yes: {p.yesVotes}, No: {p.noVotes}</p>
          <p>Status: {p.status}</p>
        </div>
      ))}
    </div>
  );
}
```

## Troubleshooting

### Proposal isn't showing up
- Check user rank is allowed to propose
- Check community_proposals table exists (migration ran?)
- Check user is member of community

### Voting not working
- Check user rank has voting access
- Check haven't already voted
- Check proposal status is "pending"

### Fast-track button missing
- Only sovereign (rank 0) should see it
- Check law has `canFastTrack: true`
- Check governance type supports it

### Proposal not resolving
- Background job not running?
- Check `resolveExpiredProposalsAction()` is called on schedule
- Manually call in dev: `await resolveExpiredProposalsAction()`

## Database Queries (Debugging)

```sql
-- See all proposals
SELECT * FROM public.community_proposals;

-- See votes on a proposal
SELECT proposal_id, vote, COUNT(*)
FROM public.proposal_votes
GROUP BY proposal_id, vote;

-- See pending proposals older than 24h
SELECT * FROM public.community_proposals
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '24 hours';

-- Count proposals per community
SELECT community_id, COUNT(*) as proposal_count
FROM public.community_proposals
GROUP BY community_id;
```

## Performance Considerations

- Index on `community_proposals(community_id, status)` speeds up lookups
- Vote counts calculated on-the-fly (efficient for small communities)
- Consider caching proposal counts if >1000 proposals
- Background job should run every 5-10 minutes

## Security Notes

- All actions use Supabase RLS (row-level security)
- Rank requirements enforced server-side
- Users can only vote once per proposal (UNIQUE constraint)
- Voting access checked via `can_user_vote_on_proposal()` function
- Fast-track only available to sovereign (checked in action)

## Next Steps

1. ✅ Run migration
2. ✅ Set up cron job
3. ✅ Test proposing a law
4. ✅ Test voting
5. ✅ Test auto-resolution
6. ✅ Add custom laws to registry
7. ✅ Deploy to production

---

**Questions?** Check `LAW_SYSTEM_IMPLEMENTATION.md` and `LAW_SYSTEM_EXAMPLES.md` for detailed explanations.

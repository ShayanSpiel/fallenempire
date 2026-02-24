# Law System - Practical Examples

## Example 1: Declare War in Monarchy

### Setup
- Community: "The Kingdom"
- Governance: monarchy
- Sovereign (Rank 0): Alice
- Secretaries (Rank 1): Bob, Carol
- Members (Rank 10): David, Eve, Frank

### Flow

**Step 1: Proposal Creation**
Alice clicks "Propose Law" → Selects "Declare War" → Selects "The Republic" as target

```typescript
await proposeLawAction("kingdom-id", "DECLARE_WAR", {
  target_community_id: "republic-id"
})
```

Rules from registry:
- Only rank 0 can propose ✓ (Alice is sovereign)
- Expiration: 24h from now
- Passing condition: sovereign_only
- Fast-track: allowed

**Step 2: Voting Phase (Optional)**
- Bob votes YES
- Carol votes NO
- Voting doesn't matter (sovereign_only rule)

**Step 3: Resolution**

*Option A - Fast Track (Immediate):*
- Alice clicks "Pass Immediately"
- Proposal status → "passed"
- War executes immediately

*Option B - Wait It Out:*
- 24 hours pass
- Background job runs `resolveExpiredProposalsAction()`
- Checks: Does sovereign (rank 0) have at least 1 yes vote?
  - Alice hasn't voted yet, but sovereign_only means pass
- Proposal status → "passed"
- War executes

**Step 4: Law Execution**
```typescript
// executeLawAction called automatically
const { error } = await supabase
  .from("community_conflicts")
  .insert({
    initiator_community_id: "kingdom-id",
    target_community_id: "republic-id",
    status: "active",
    started_at: now
  })
```

Conflict created, war begins!

---

## Example 2: Declare War in Democracy

### Setup
- Community: "The Republic"
- Governance: democracy
- Leaders (Rank 0-1): Alice, Bob
- Members (Rank 10): Carol, David, Eve, Frank, George

### Flow

**Step 1: Proposal Creation**
David (regular member, rank 10) clicks "Propose Law" → Selects "Declare War"

```typescript
await proposeLawAction("republic-id", "DECLARE_WAR", {
  target_community_id: "kingdom-id"
})
```

Rules from registry:
- Ranks [0, 1, 10] can propose ✓ (David is rank 10)
- Expiration: 48h
- Passing condition: majority_vote
- Fast-track: NOT allowed

**Step 2: Voting Phase (Required)**
Everyone can vote:
- Alice votes YES
- Bob votes NO
- Carol votes YES
- David votes YES (proposer)
- Eve votes YES
- Frank votes NO
- George votes YES

Vote count: 5 YES, 2 NO → **Majority** ✓

**Step 3: Resolution**
After 48h, background job runs:
```typescript
const yesVotes = 5;
const noVotes = 2;
const passingCondition = "majority_vote";
const passes = shouldProposalPass(5, 2, 7, "majority_vote");
// returns: 5 > 2 = true ✓
```

Proposal status → "passed"

**Step 4: Law Execution**
War is declared! The Republic and Kingdom are now in conflict.

---

## Example 3: Adding "Levy Tax" Law (Implementation Guide)

### Step 1: Update LAW_REGISTRY

```typescript
// lib/governance/laws.ts

LEVY_TAX: {
  label: "Levy Tax",
  description: "Impose a tax on community resources.",
  icon: "coins",
  requiresMetadata: ["tax_amount", "tax_reason"],
  governanceRules: {
    monarchy: {
      proposeRank: [0, 1],  // King or secretary
      voteAccessRanks: [0, 1],
      voteAccessType: "council_only",
      timeToPass: "24h",
      canFastTrack: true,
      passingCondition: "sovereign_only",
      description: "King decides taxes, secretary can propose.",
    },
    democracy: {
      proposeRank: [0, 1, 10],  // Anyone
      voteAccessRanks: [0, 1, 10],
      voteAccessType: "all_members",
      timeToPass: "72h",
      canFastTrack: false,
      passingCondition: "supermajority_vote",  // 2/3 majority
      description: "Requires supermajority (2/3) to impose taxes.",
    },
  },
}
```

### Step 2: Update LawType

```typescript
// lib/governance/laws.ts

export type LawType =
  | "DECLARE_WAR"
  | "PROPOSE_HEIR"
  | "CHANGE_GOVERNANCE"
  | "LEVY_TAX";  // Add here
```

### Step 3: Update proposeLawAction (if metadata validation needed)

Metadata validation already happens automatically in `proposeLawAction()`:

```typescript
// app/actions/laws.ts (already implemented)

const lawDef = getLawDefinition(lawType);
if (lawDef.requiresMetadata) {
  for (const field of lawDef.requiresMetadata) {
    if (!(field in metadata)) {
      throw new Error(`Missing required metadata field: ${field}`);
    }
  }
}
```

### Step 4: Implement Law Execution

```typescript
// app/actions/laws.ts, in executeLawAction()

case "LEVY_TAX": {
  const { tax_amount, tax_reason } = proposal.metadata;

  if (!tax_amount || typeof tax_amount !== "number") {
    throw new Error("Invalid tax amount");
  }

  // Record the tax in your treasury/economy system
  const { error } = await supabase
    .from("community_treasury")
    .insert({
      community_id: communityId,
      amount: tax_amount,
      reason: tax_reason,
      imposed_at: new Date().toISOString(),
    });

  if (error) throw error;

  // Optionally distribute to community members
  // Or apply economic penalties/bonuses

  break;
}
```

### Step 5: UI Component (LawProposalSheet handles automatically!)

The `LawProposalSheet` will:
1. Detect LEVY_TAX from registry
2. Show description and rules
3. Need to add metadata inputs (see Step 6)

### Step 6: Extend LawProposalSheet for Tax Inputs

```typescript
// components/community/law-proposal-sheet.tsx

// Add after the DECLARE_WAR section:

{selectedLaw === "LEVY_TAX" && (
  <div className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Tax Amount
    </p>
    <Input
      type="number"
      placeholder="Amount to levy..."
      min="0"
      value={taxAmount}
      onChange={(e) => setTaxAmount(Number(e.target.value))}
      className="h-10"
      disabled={isLoading}
    />

    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Reason
    </p>
    <Input
      placeholder="Why is this tax being levied?"
      value={taxReason}
      onChange={(e) => setTaxReason(e.target.value)}
      className="h-10"
      disabled={isLoading}
    />
  </div>
)}
```

And update handleProposeLaw:

```typescript
const handleProposeLaw = async () => {
  if (!selectedLaw) return;

  let metadata: Record<string, any> = {};

  if (selectedLaw === "DECLARE_WAR") {
    // ... existing code
  } else if (selectedLaw === "LEVY_TAX") {
    if (!taxAmount || taxAmount <= 0) {
      setError("Tax amount must be greater than 0");
      return;
    }
    metadata = {
      tax_amount: taxAmount,
      tax_reason: taxReason || "General taxation",
    };
  }

  // ... rest of function
};
```

### Step 7: Database Recording (Optional)

If you want to track taxes historically:

```sql
-- Add to your migrations
CREATE TABLE IF NOT EXISTS public.community_treasury_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id),
  proposal_id UUID NOT NULL REFERENCES public.community_proposals(id),
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  imposed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## Example 4: Propose Heir in Monarchy

### Setup
- Kingdom with current Sovereign: Alice
- Heirs/Succession order matters
- Rank 0: Alice (Sovereign)
- Rank 1: Bob, Carol (Secretaries)

### How It Works

**Rules (from registry):**
- Only Rank 0 can propose
- Voting: Rank 0 and 1 only (council only)
- Time: 12 hours
- Passing: Sovereign only (Alice's vote matters)
- Fast-track: Yes (Alice can confirm immediately)

**Proposal:**
Alice proposes Carol as the heir.

```typescript
await proposeLawAction("kingdom-id", "PROPOSE_HEIR", {
  target_user_id: "carol-id"
})
```

**Voting:**
- Alice votes YES (as sovereign)
- Bob votes YES
- Carol votes YES

**Resolution:**
Immediately passes (sovereign_only + Alice voted YES)

**Execution:**
```typescript
case "PROPOSE_HEIR": {
  const targetUserId = proposal.metadata?.target_user_id;
  const { error } = await supabase
    .from("communities")
    .update({ heir_id: targetUserId })
    .eq("id", communityId);
  if (error) throw error;
  break;
}
```

Now Carol is registered as heir. If Alice loses sovereign status, Carol takes over!

---

## Example 5: Multiple Simultaneous Proposals

### Scenario
- Monarchy has 3 active proposals:
  1. Declare War on North Kingdom (12h remaining, 6 yes/2 no)
  2. Levy Tax for Army (8h remaining, needs 1 approval from king)
  3. Promote David to Secretary (5h remaining, 7 yes/1 no)

### Display in PoliticsPanel

```
Laws & Proposals  [3 active]

[Active Proposals]

⚔ Declare War
 ↳ Declare war on the North Kingdom
 ⏱ 12h remaining
 ████░░░░░░ 6/8 votes

💰 Levy Tax
 ↳ Impose a tax on community resources
 ⏱ 8h remaining
 [No votes shown - sovereign only]

👤 [Hypothetical] Promote to Council
 ↳ Promote David to Secretary rank
 ⏱ 5h remaining
 ████████░░ 7/8 votes

[Resolved]

✓ Change Governance Type - Passed
✗ Request Alliance - Rejected
```

---

## Testing: Full Cycle Script

```typescript
// Test: Create war proposal, vote, and resolve

// 1. Propose
const proposal = await proposeLawAction(
  "test-community-id",
  "DECLARE_WAR",
  { target_community_id: "enemy-community-id" }
);

// 2. Vote (for democracy)
await voteOnProposalAction(proposal.id, "yes");

// 3. Check status
const details = await getProposalDetailsAction(proposal.id);
console.log(details.status); // "pending"
console.log(details.yesVotes); // 1

// 4. Simulate expiration
// In real scenario, background job handles this
// For testing, manually call:
await resolveExpiredProposalsAction();

// 5. Verify execution
const finalDetails = await getProposalDetailsAction(proposal.id);
console.log(finalDetails.status); // "passed"

// 6. Check conflict was created
const conflicts = await supabase
  .from("community_conflicts")
  .select()
  .eq("initiator_community_id", "test-community-id");
console.log(conflicts.data.length); // 1
```

---

## Summary

The law system is extremely flexible. The examples show:
- ✅ Different governance types with different rules
- ✅ Voting mechanics (majority, supermajority, sovereign-only)
- ✅ Fast-track vs time-based resolution
- ✅ Custom metadata per law
- ✅ Law execution with side effects
- ✅ Multiple simultaneous proposals

To add a new law: Registry entry → Validation logic → Execution handler → UI inputs (optional).

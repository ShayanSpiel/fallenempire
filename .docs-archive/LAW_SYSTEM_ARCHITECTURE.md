# Law System - Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│                    (PoliticsPanel Component)                    │
└───────┬───────────────────────────────────────────┬─────────────┘
        │                                           │
   ┌────▼─────────────────┐            ┌──────────▼──────────┐
   │  LawProposalSheet    │            │  Active Proposals   │
   │  - Law selection     │            │  - Vote progress    │
   │  - Metadata inputs   │            │  - Status display   │
   │  - Governance rules  │            │  - Voting timeline  │
   └────┬─────────────────┘            └────────┬────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │    SERVER ACTIONS (actions/laws.ts)   │
        │                                       │
        │  ┌─ proposeLawAction                  │
        │  ├─ voteOnProposalAction              │
        │  ├─ fastTrackProposalAction           │
        │  ├─ getProposalDetailsAction          │
        │  ├─ getCommunityProposalsAction       │
        │  ├─ resolveExpiredProposalsAction     │
        │  └─ executeLawAction                  │
        │                                       │
        └───────────────────┬───────────────────┘
                            │
        ┌───────────────────▼──────────────────────┐
        │      LAW REGISTRY (governance/laws.ts)   │
        │                                          │
        │  ┌─ LAW_REGISTRY                        │
        │  │  ├─ DECLARE_WAR                      │
        │  │  │  ├─ monarchy { rules }            │
        │  │  │  └─ democracy { rules }           │
        │  │  ├─ PROPOSE_HEIR                     │
        │  │  ├─ CHANGE_GOVERNANCE               │
        │  │  └─ LEVY_TAX                        │
        │  │                                      │
        │  ├─ Helper functions                    │
        │  │  ├─ getGovernanceRules()             │
        │  │  ├─ canProposeLaw()                  │
        │  │  ├─ canVoteOnLaw()                   │
        │  │  ├─ shouldProposalPass()             │
        │  │  └─ parseTimeToMilliseconds()        │
        │  │                                      │
        │  └─ Type definitions                    │
        │     ├─ LawType                          │
        │     ├─ GovernanceRules                  │
        │     └─ LawDefinition                    │
        │                                          │
        └───────────────────┬──────────────────────┘
                            │
        ┌───────────────────▼──────────────────────┐
        │    SUPABASE (Database & RLS)             │
        │                                          │
        │  ┌─ community_proposals                  │
        │  │  ├─ id, community_id, law_type       │
        │  │  ├─ status (pending/passed/rejected) │
        │  │  ├─ metadata (JSONB)                 │
        │  │  ├─ expires_at, resolved_at          │
        │  │  └─ RLS: read all in community       │
        │  │                                      │
        │  ├─ proposal_votes                      │
        │  │  ├─ id, proposal_id, user_id, vote  │
        │  │  ├─ UNIQUE(proposal_id, user_id)    │
        │  │  └─ RLS: read own votes              │
        │  │                                      │
        │  ├─ Functions                           │
        │  │  ├─ get_proposal_vote_counts()       │
        │  │  └─ can_user_vote_on_proposal()      │
        │  │                                      │
        │  └─ Indices                             │
        │     ├─ idx_community_proposals_*        │
        │     └─ idx_proposal_votes_*             │
        │                                          │
        └──────────────────────────────────────────┘
```

## Data Flow: Creating a War Proposal

```
User Action: Click "Propose Law" → Select "Declare War" → Choose target

                        │
                        ▼

User clicks "Propose Law" button
  │
  ├─ Opens LawProposalSheet component
  │  ├─ Query LAW_REGISTRY for available laws
  │  ├─ Filter by user rank and governance type
  │  └─ Display list of laws user can propose
  │
  ▼

User selects "Declare War"
  │
  ├─ LawProposalSheet shows law details
  │  ├─ Display from LAW_REGISTRY
  │  ├─ Show governance rules (24h, sovereign_only, etc.)
  │  └─ Show metadata input (target community search)
  │
  ▼

User searches & selects target community
  │
  ├─ Supabase query: find communities by name
  ├─ Display results in dropdown
  └─ User selects target
  │
  ▼

User clicks "Propose Law"
  │
  ├─ LawProposalSheet calls proposeLawAction()
  │  │
  │  ├─ Server-side validation:
  │  │  ├─ Is user authenticated?
  │  │  ├─ Is user member of community?
  │  │  ├─ Get user's rank_tier
  │  │  ├─ Get community's governance_type
  │  │  ├─ Check canProposeLaw(DECLARE_WAR, monarchy, rank=0)
  │  │  ├─ Validate metadata (target_community_id provided)
  │  │  └─ Calculate expires_at from timeToPass (24h)
  │  │
  │  ├─ Check for duplicate pending proposals
  │  │  └─ SELECT FROM community_proposals WHERE status='pending'
  │  │
  │  └─ INSERT into community_proposals
  │     ├─ community_id
  │     ├─ proposer_id
  │     ├─ law_type: "DECLARE_WAR"
  │     ├─ status: "pending"
  │     ├─ metadata: {target_community_id: "..."}
  │     └─ expires_at: NOW() + 24h
  │
  ▼

proposeLawAction() returns success
  │
  └─ LawProposalSheet:
     ├─ Close sheet
     ├─ Call onProposalCreated callback
     └─ PoliticsPanel reloads proposals

                        │
                        ▼

Proposal visible in Politics panel
  ├─ Shows in "Active Proposals" section
  ├─ Displays vote progress (initially 0/0)
  ├─ Shows "24h remaining"
  └─ Users can vote if they have access_ranks
```

## Data Flow: Voting

```
User (Secretary, Rank 1) sees war proposal
  │
  ├─ Check: canVoteOnLaw(DECLARE_WAR, monarchy, rank=1)
  │  └─ Returns: true (rank 1 in voteAccessRanks)
  │
  ▼

User clicks "Vote" button
  │
  └─ LawProposalSheet shows vote options: YES / NO

                        │
                        ▼

User clicks "YES"
  │
  ├─ Component calls voteOnProposalAction(proposalId, "yes")
  │  │
  │  ├─ Server-side:
  │  │  ├─ Get proposal details
  │  │  ├─ Check status == "pending"
  │  │  ├─ Get user's rank in community
  │  │  ├─ Check canVoteOnLaw() returns true
  │  │  ├─ Check no existing vote (UNIQUE constraint)
  │  │  │
  │  │  └─ INSERT into proposal_votes
  │  │     ├─ proposal_id
  │  │     ├─ user_id
  │  │     └─ vote: "yes"
  │  │
  │  └─ Return success
  │
  ▼

Vote stored in database
  │
  ├─ proposal_votes table now has record
  ├─ Vote counts calculated on next query
  └─ UI updates to show: "1/3 votes"
```

## Data Flow: Automatic Resolution

```
Background job runs every 10 minutes
  │
  └─ Call resolveExpiredProposalsAction()
     │
     ├─ Query: SELECT FROM community_proposals
     │  WHERE status='pending' AND expires_at <= NOW()
     │
     ▼

For each expired proposal:
  │
  ├─ Get vote counts:
  │  └─ SELECT vote FROM proposal_votes
  │     WHERE proposal_id = proposal_id
  │  └─ Count yes_votes and no_votes
  │
  ├─ Get community and governance rules
  │  ├─ Query: community's governance_type
  │  └─ Query: LAW_REGISTRY for rules
  │
  ├─ Check passingCondition
  │  │
  │  ├─ If "sovereign_only": yesVotes >= 1? ✓
  │  ├─ If "majority_vote": yesVotes > noVotes? ✓
  │  ├─ If "supermajority_vote": yesVotes >= (2/3 * total)? ✓
  │  └─ If "unanimous": noVotes == 0 && all voted yes? ✓
  │
  ├─ Update proposal_votes status
  │  └─ UPDATE community_proposals
  │     ├─ status: "passed" or "rejected"
  │     ├─ resolved_at: NOW()
  │     └─ resolution_notes: "vote count..."
  │
  ├─ If status == "passed":
  │  │
  │  └─ Call executeLawAction(DECLARE_WAR, proposalId)
  │     │
  │     ├─ Get proposal metadata
  │     ├─ Switch on law_type
  │     │
  │     └─ case "DECLARE_WAR":
  │        ├─ Extract target_community_id from metadata
  │        ├─ INSERT into community_conflicts
  │        │  ├─ initiator_community_id
  │        │  ├─ target_community_id
  │        │  ├─ status: "active"
  │        │  └─ started_at: NOW()
  │        │
  │        └─ War is now active!
  │
  └─ Next proposal... (loop)

                        │
                        ▼

UI reflects changes
  ├─ Proposal moves from "Active" to "Resolved"
  ├─ Shows green checkmark if passed
  ├─ Shows red X if rejected
  └─ War details visible in conflict tracking
```

## Data Flow: Fast-Track

```
Sovereign (Rank 0) sees war proposal in UI
  │
  ├─ Only rank 0 can see "Pass Immediately" button
  └─ Button only appears if law.canFastTrack == true

                        │
                        ▼

Sovereign clicks "Pass Immediately"
  │
  ├─ Component calls fastTrackProposalAction(proposalId)
  │  │
  │  ├─ Server-side validation:
  │  │  ├─ Get proposal
  │  │  ├─ Check status == "pending"
  │  │  ├─ Check user rank == 0 (sovereign only)
  │  │  ├─ Check law.canFastTrack == true
  │  │  │
  │  │  └─ UPDATE community_proposals
  │  │     ├─ status: "passed"
  │  │     ├─ resolved_at: NOW()
  │  │     └─ resolution_notes: "Fast-tracked by sovereign"
  │  │
  │  └─ Call executeLawAction() immediately
  │
  ▼

Law executes instantly
  │
  ├─ No waiting for timer
  ├─ Vote counts ignored
  └─ War begins immediately!
```

## Governance Rules Structure

```
Each law has governance-specific rules:

DECLARE_WAR: {
  governance_type: {
    proposeRank: number | number[],     // Who can propose
    voteAccessRanks: number[],          // Who can vote
    voteAccessType: string,             // Description
    timeToPass: string,                 // "24h", "48h", etc
    canFastTrack: boolean,              // Sovereign override
    passingCondition: string,           // sovereign_only, majority_vote, etc
    description: string                 // Explains the rules
  }
}

Examples:

monarchy: {
  proposeRank: 0,                     // Only king
  voteAccessRanks: [0, 1],            // King and secretaries
  timeToPass: "24h",
  canFastTrack: true,                 // King can skip voting
  passingCondition: "sovereign_only"  // King's vote = pass
}

democracy: {
  proposeRank: [0, 1, 10],            // Anyone
  voteAccessRanks: [0, 1, 10],        // Everyone votes
  timeToPass: "48h",
  canFastTrack: false,                // No one can skip voting
  passingCondition: "majority_vote"   // >50% yes = pass
}
```

## Passing Conditions Explained

```
┌──────────────────────────────────────────────────────────────┐
│ PASSING CONDITION LOGIC                                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ sovereign_only                                                │
│ ├─ At least 1 "yes" vote from sovereign (rank 0)            │
│ ├─ Other votes ignored                                        │
│ ├─ Use case: Monarchy, quick decisions                        │
│ └─ Example: King votes yes, instant pass                      │
│                                                               │
│ majority_vote                                                 │
│ ├─ More "yes" votes than "no" votes                          │
│ ├─ Formula: yesVotes > noVotes                                │
│ ├─ Use case: Democracy, general proposals                     │
│ └─ Example: 6 yes, 4 no = PASS                               │
│                                                               │
│ supermajority_vote                                            │
│ ├─ At least 2/3 of votes are "yes"                           │
│ ├─ Formula: yesVotes >= ceil((totalVotes * 2) / 3)          │
│ ├─ Use case: Democracy, major changes                         │
│ └─ Example: 10 total votes, need 7+ yes to pass              │
│                                                               │
│ unanimous                                                     │
│ ├─ All votes must be "yes"                                   │
│ ├─ Formula: noVotes == 0 && yesVotes == eligible_voters      │
│ ├─ Use case: Rare (constitutional amendments)                │
│ └─ Example: All 5 members vote yes, 0 no = PASS             │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
CommunityDetailsClient
└─ PoliticsPanel (refactored)
   ├─ Button: "Propose a Law"
   │
   ├─ LawProposalSheet
   │  ├─ Law Selection View
   │  │  ├─ Search input
   │  │  └─ Law list (from LAW_REGISTRY)
   │  │
   │  └─ Law Details View
   │     ├─ Law information
   │     ├─ Governance rules display
   │     ├─ Metadata inputs (dynamic by law)
   │     └─ Propose button
   │
   ├─ Active Proposals Section
   │  └─ For each proposal:
   │     ├─ Law name and description
   │     ├─ Vote progress bar
   │     ├─ Time remaining
   │     └─ Vote button (if eligible)
   │
   └─ Resolved Proposals Section
      └─ For each resolved proposal:
         ├─ Law name
         ├─ Pass/Reject status
         └─ Result icon
```

## State Management

```
PoliticsPanel (component state):
├─ proposals: Proposal[]          // All community proposals
├─ isLoadingProposals: boolean    // Loading indicator
├─ isProposalSheetOpen: boolean   // Sheet visibility
└─ Fetches from server action

LawProposalSheet (component state):
├─ selectedLaw: LawType | null    // Which law selected
├─ isLoading: boolean             // Action in progress
├─ error: string | null           // Error messages
├─ searchTerm: string             // Law search
│
└─ Law-specific state (if needed):
   ├─ warTargetSearch: string     // For DECLARE_WAR
   ├─ selectedWarTarget: {...}    // Selected target
   └─ warTargets: {...}[]         // Search results
```

## Security Layers

```
┌────────────────────────────────────────┐
│ PROPOSED BY USER ACTION                │
│ ├─ Must be authenticated               │
│ └─ User must exist in auth.users       │
└────────────────────┬───────────────────┘
                     │
                     ▼
┌────────────────────────────────────────┐
│ SERVER VALIDATION (proposeLawAction)  │
│ ├─ Is user member of community?        │
│ ├─ What is user's rank_tier?           │
│ ├─ Can rank propose this law?           │
│ └─ Is metadata valid?                  │
└────────────────────┬───────────────────┘
                     │
                     ▼
┌────────────────────────────────────────┐
│ DATABASE RLS POLICIES                  │
│ ├─ Can only READ own votes              │
│ ├─ Can only INSERT votes in own         │
│ │  community membership                 │
│ └─ Can only DELETE own proposals        │
└────────────────────┬───────────────────┘
                     │
                     ▼
┌────────────────────────────────────────┐
│ DATABASE CONSTRAINTS                   │
│ ├─ UNIQUE(proposal_id, user_id)        │
│ │  Prevents duplicate votes             │
│ ├─ NOT NULL constraints                │
│ └─ Foreign key constraints              │
└────────────────────────────────────────┘
```

---

This architecture ensures:
- **Scalability**: Add laws without code changes
- **Flexibility**: Different rules per governance type
- **Security**: Multi-layer validation and RLS
- **Performance**: Indexed queries, efficient vote counting
- **Maintainability**: Centralized law definitions

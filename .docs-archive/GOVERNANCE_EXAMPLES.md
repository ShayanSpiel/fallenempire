# Governance System - Implementation Examples

## Example 1: Adding a Democracy Governance Type

### Step 1: Update Configuration
```typescript
// lib/governance.ts

export const GOVERNANCE_TYPES: Record<string, GovernanceType> = {
  monarchy: {
    label: "Kingdom",
    // ... existing config
  },

  // NEW: Democracy type
  democracy: {
    label: "Republic",
    description: "Governed by elected senators",
    roles: [
      { rank: 0, label: "Senator", maxCount: 10, icon: "person-handshake" },
      { rank: 10, label: "Citizen", maxCount: null, icon: "users" },
    ],
    canAssignRanks: [0], // Senators can assign other senators
  },
};
```

### Result
- UI automatically shows 10 Senator slots instead of 3 Secretary slots
- Governor hierarchy component renders different layout
- No other code changes needed

---

## Example 2: Creating a Community with Governance

### Setup
```typescript
// app/actions/community.ts - createCommunityAction

// After creating the community:
const newCommunity = insertResult.data;

// Set creator as Sovereign (rank 0)
await supabase.from("community_members").insert({
  community_id: newCommunity.id,
  user_id: profileId,
  role: "founder", // Legacy support
  rank_tier: 0,     // NEW: Sovereign
  governance_type: "monarchy", // Could be "democracy", "dictatorship"
});

// Update communities table with governance type
await supabase.from("communities").update({
  governance_type: "monarchy",
}).eq("id", newCommunity.id);
```

---

## Example 3: Assigning Ranks (Server Action)

### Basic Usage
```typescript
// components/community/governance-hierarchy.tsx

const handleAssignRank = (targetUserId: string, rankTier: number) => {
  startTransition(async () => {
    const result = await assignRankAction(
      communityId,
      targetUserId,
      rankTier
    );

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${getRankLabel(governanceType, rankTier)} appointed!`);
    }
  });
};
```

### What Happens Inside
```typescript
// app/actions/community.ts - assignRankAction

export async function assignRankAction(
  communityId: string,
  targetUserId: string,
  newRankTier: number
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  // 1. Get governance type
  const { data: communityData } = await supabase
    .from("communities")
    .select("governance_type")
    .eq("id", communityId);
  const governanceType = communityData?.governance_type || "monarchy";

  // 2. Check if requester is Sovereign
  const { data: requesterData } = await supabase
    .from("community_members")
    .select("rank_tier")
    .eq("community_id", communityId)
    .eq("user_id", profileId);

  if (!requesterData || requesterData.rank_tier !== 0) {
    return { error: "Only the Sovereign can assign ranks." };
  }

  // 3. Validate rank assignment against config
  const { data: currentRankMembers } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("rank_tier", newRankTier);

  const validation = validateRankAssignment(
    governanceType,
    newRankTier,
    currentRankMembers?.length || 0
  );

  if (!validation.valid) {
    return { error: validation.error };
  }

  // 4. Update rank in database
  const { error } = await supabase
    .from("community_members")
    .update({ rank_tier: newRankTier })
    .eq("community_id", communityId)
    .eq("user_id", targetUserId);

  if (error) throw error;

  // 5. Return success
  revalidatePath(`/community/${communityId}`);
  return { message: "Rank assigned successfully." };
}
```

---

## Example 4: Claiming the Throne (No Sovereign)

### UI Implementation
```typescript
// components/community/governance-hierarchy.tsx

<div className="min-h-32 rounded-lg border-2 border-dashed">
  {sovereign ? (
    // Show current sovereign
    <div>
      <Avatar className="h-16 w-16">
        {sovereign.avatar_url && <img src={sovereign.avatar_url} />}
      </Avatar>
      <p>{sovereign.username}</p>
    </div>
  ) : (
    // No sovereign - show claim button
    <div>
      <p className="text-sm font-semibold text-muted-foreground mb-3">
        The throne awaits a ruler
      </p>
      {!isUserSovereign && (
        <Button
          onClick={() => startTransition(async () => {
            const result = await claimThroneAction(communityId);
            if (!result.error) {
              toast.success("You have claimed the throne!");
            } else {
              toast.error(result.error);
            }
          })}
          disabled={isPending}
          variant="default"
        >
          <Crown className="h-4 w-4 mr-2" />
          Claim the Throne
        </Button>
      )}
    </div>
  )}
</div>
```

### Server Action
```typescript
// app/actions/community.ts

export async function claimThroneAction(
  communityId: string
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  // 1. Check no sovereign exists
  const { data: sovereignData } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("rank_tier", 0)
    .maybeSingle();

  if (sovereignData) {
    return { error: "This community already has a Sovereign." };
  }

  // 2. Check user is a member
  const { data: memberData } = await supabase
    .from("community_members")
    .select("rank_tier")
    .eq("community_id", communityId)
    .eq("user_id", profileId)
    .maybeSingle();

  if (!memberData) {
    return { error: "You must be a member of this community first." };
  }

  // 3. Promote to rank 0
  const { error } = await supabase
    .from("community_members")
    .update({ rank_tier: 0 })
    .eq("community_id", communityId)
    .eq("user_id", profileId);

  if (error) throw error;

  revalidatePath(`/community/${communityId}`);
  return { message: "You have claimed the throne!" };
}
```

---

## Example 5: Checking Permissions in Server Actions

### Declare War (Only Sovereign)
```typescript
// app/actions/community.ts

export async function declareWarAction(
  initiatorCommunityId: string,
  targetCommunityId: string
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  // Check if user is sovereign or founder
  const { data: memberData } = await supabase
    .from("community_members")
    .select("role, rank_tier")
    .eq("community_id", initiatorCommunityId)
    .eq("user_id", profileId)
    .maybeSingle();

  // Accept both rank_tier = 0 (new) OR role = 'founder' (legacy)
  const isAuthorized =
    memberData &&
    (memberData.rank_tier === 0 || memberData.role === "founder");

  if (!isAuthorized) {
    return {
      error: "Only community sovereigns can declare war.",
      message: null,
    };
  }

  // Rest of war logic...
}
```

---

## Example 6: Querying Members by Rank

### Get Sovereign
```sql
SELECT u.id, u.username, u.avatar_url, cm.rank_tier
FROM community_members cm
JOIN users u ON u.id = cm.user_id
WHERE cm.community_id = $1 AND cm.rank_tier = 0;
```

### Get All Secretaries (Monarchy)
```sql
SELECT u.id, u.username, u.avatar_url
FROM community_members cm
JOIN users u ON u.id = cm.user_id
WHERE cm.community_id = $1 AND cm.rank_tier = 1
ORDER BY u.created_at;
```

### Get Regular Members
```sql
SELECT u.id, u.username, u.avatar_url
FROM community_members cm
JOIN users u ON u.id = cm.user_id
WHERE cm.community_id = $1 AND cm.rank_tier = 10
ORDER BY u.username;
```

### Fetch All with Ranks (for UI)
```sql
SELECT
  cm.user_id,
  u.username,
  u.avatar_url,
  cm.rank_tier,
  c.governance_type
FROM community_members cm
JOIN users u ON u.id = cm.user_id
JOIN communities c ON c.id = cm.community_id
WHERE cm.community_id = $1
ORDER BY cm.rank_tier ASC, u.username;
```

---

## Example 7: Governance Hierarchy Component Flow

```typescript
// components/community/governance-hierarchy.tsx

export function GovernanceHierarchy({
  communityId,
  governanceType, // "monarchy" | "democracy" | etc
  members,        // All community members with rank_tier
  isUserSovereign,
  currentUserId,
}: GovernanceHierarchyProps) {
  // 1. Get governance config based on type
  const config = getGovernanceType(governanceType);

  // 2. Separate members by rank
  const sovereign = members.find((m) => m.rank_tier === 0);
  const advisors = members.filter((m) => m.rank_tier === 1);
  const citizens = members.filter((m) => m.rank_tier === 10);

  // 3. For each rank in config, render section
  return (
    <div>
      {/* Sovereign Section */}
      <div>
        <h2>{config.roles[0].label}</h2> {/* "King/Queen" */}
        {sovereign ? (
          <Avatar src={sovereign.avatar_url} />
        ) : (
          <button onClick={claimThrone}>Claim the Throne</button>
        )}
      </div>

      {/* Advisors Section (config says maxCount: 3) */}
      <div>
        <h2>{config.roles[1].label}</h2> {/* "Secretary" */}
        {Array.from({ length: config.roles[1].maxCount }).map((_, i) => (
          <slot key={i}>
            {advisors[i] ? (
              <Avatar src={advisors[i].avatar_url} />
            ) : isUserSovereign ? (
              <button onClick={() => assignRank(userId, 1)}>+</button>
            ) : (
              <div />
            )}
          </slot>
        ))}
      </div>

      {/* Citizens Section */}
      <div>
        <h2>{config.roles[2].label}</h2> {/* "People" */}
        {citizens.map((citizen) => (
          <div key={citizen.user_id}>{citizen.username}</div>
        ))}
      </div>
    </div>
  );
}
```

---

## Example 8: Adding Permissions to Ranks

### Future Enhancement
```typescript
// lib/governance.ts (FUTURE)

export interface GovernanceRank {
  rank: number;
  label: string;
  maxCount: number | null;
  icon: string;
  permissions?: string[]; // NEW
}

monarchy: {
  roles: [
    {
      rank: 0,
      label: "King/Queen",
      maxCount: 1,
      icon: "crown",
      permissions: [
        "declare_war",
        "assign_ranks",
        "update_settings",
        "kick_members",
      ],
    },
    {
      rank: 1,
      label: "Secretary",
      maxCount: 3,
      icon: "user-cog",
      permissions: ["kick_members"],
    },
    {
      rank: 10,
      label: "People",
      maxCount: null,
      icon: "users",
      permissions: ["post_in_chat"],
    },
  ],
}

// Check permission
export function hasPermission(
  governanceType: string,
  rankTier: number,
  permission: string
): boolean {
  const config = getGovernanceType(governanceType);
  const rank = config.roles.find((r) => r.rank === rankTier);
  return rank?.permissions?.includes(permission) ?? false;
}
```

---

## Example 9: Database Trigger in Action

```sql
-- This trigger automatically fires when inserting/updating rank_tier

CREATE OR REPLACE FUNCTION enforce_single_sovereign()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.rank_tier = 0 THEN
    -- If setting rank 0, check no one else has it
    IF EXISTS (
      SELECT 1 FROM public.community_members
      WHERE community_id = NEW.community_id
        AND rank_tier = 0
        AND user_id != NEW.user_id
    ) THEN
      RAISE EXCEPTION 'A community can only have one Sovereign (rank 0)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Example: This would FAIL (prevents data corruption)
UPDATE community_members
SET rank_tier = 0
WHERE community_id = 'abc-123' AND user_id = 'xyz-789';
-- Error: A community can only have one Sovereign (rank 0)

-- Example: This would SUCCEED
UPDATE community_members
SET rank_tier = 1
WHERE community_id = 'abc-123' AND user_id = 'xyz-789';
-- OK: Promoting to Secretary (rank 1)
```

---

## Example 10: Complete Community View Integration

```typescript
// app/community/[slug]/page.tsx (Server Component)

export default async function CommunityPage({ params }) {
  const community = await getCompleteCommunityData(params.slug);
  const members = await getCommunityMembers(community.id);
  const currentUser = await getCurrentUser();

  return (
    <CommunityDetailsClient
      communityId={community.id}
      communityName={community.name}
      initialMembers={members.map((m) => ({
        id: m.id,
        user_id: m.user_id,
        username: m.username,
        avatar_url: m.avatar_url,
        role: m.role,
        rank_tier: m.rank_tier, // NEW
      }))}
      membersCount={members.length}
      occupiedRegions={community.regions}
      communityDescription={community.description}
      communityIdeology={community.ideology_label}
      communityColor={community.color}
      isUserFounder={community.founder_id === currentUser?.id}
      isUserMember={members.some((m) => m.user_id === currentUser?.id)}
      governanceType={community.governance_type} // NEW
      currentUserId={currentUser?.id} // NEW
    />
  );
}
```

---

These examples show the governance system in action across database, server, and UI layers.

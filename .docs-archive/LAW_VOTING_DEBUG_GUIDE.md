# Law Voting System - Debug Guide

## Overview
The law voting system has been enhanced with comprehensive logging to help diagnose issues. All server-side actions log detailed information about the voting process.

## Logging Locations

### 1. Propose Law Action
**File**: `app/actions/laws.ts` > `proposeLawAction()`

**Logs to check**:
```
[proposeLawAction] Starting proposal: {communityId, lawType, metadata}
[proposeLawAction] profileId: <user-id>
[proposeLawAction] community: {governance_type, ...}
[proposeLawAction] member: {rank_tier, user_id, ...}
[proposeLawAction] canProposeLaw: true/false
[proposeLawAction] expiresAt: <date>
[proposeLawAction] Proposal created: {id, ...}
```

### 2. Vote On Proposal Action
**File**: `app/actions/laws.ts` > `voteOnProposalAction()`

**Logs to check**:
```
[voteOnProposalAction] profileId: <user-id>
[voteOnProposalAction] proposal: {community_id, law_type, status}
[voteOnProposalAction] community: {governance_type}
[voteOnProposalAction] member: {rank_tier, user_id}
[voteOnProposalAction] canVote: true/false
[voteOnProposalAction] Inserting vote: {proposalId, profileId, vote}
[voteOnProposalAction] Vote recorded successfully
```

### 3. Get Community Proposals
**File**: `app/actions/laws.ts` > `getCommunityProposalsAction()`

**Logs to check**:
```
[getCommunityProposalsAction] Fetching proposals for community: <id>
[getCommunityProposalsAction] Found proposals: <count>
[getCommunityProposalsAction] Enriched proposal: {id, lawType, status, yesVotes, noVotes, proposer_name}
```

## Common Issues & Solutions

### Issue 1: "You are not a member of this community"
**Likely Cause**: The user's profile ID doesn't match a community_members record

**Debug Steps**:
1. Check the logs for `[proposeLawAction] member:` - should NOT be `null`
2. Verify in database:
   ```sql
   SELECT * FROM community_members
   WHERE community_id = '<community-id>'
   AND user_id = '<user-profile-id>';
   ```
3. If no result, the user needs to be added to community_members table

### Issue 2: "You do not have permission to vote on this proposal"
**Likely Cause**: User's rank_tier doesn't match voting requirements

**Debug Steps**:
1. Check logs for `[voteOnProposalAction] canVote: false`
2. Check the `rankTier` in logs - should be appropriate for law type
3. For DECLARE_WAR in monarchy: Only rank 0 and 1 can vote
4. Verify in database:
   ```sql
   SELECT rank_tier FROM community_members
   WHERE community_id = '<community-id>'
   AND user_id = '<user-profile-id>';
   ```

### Issue 3: "You have already voted on this proposal"
**Expected**: This is correct behavior after first vote

**Debug Steps**:
1. Check database for duplicate votes:
   ```sql
   SELECT * FROM proposal_votes
   WHERE proposal_id = '<proposal-id>'
   AND user_id = '<user-profile-id>';
   ```
2. Should only have ONE record with the user's vote

### Issue 4: Vote not being recorded
**Likely Cause**: RLS policy blocking write or vote table structure issue

**Debug Steps**:
1. Check for error in `[voteOnProposalAction] Vote insert error:`
2. Verify proposal_votes table exists:
   ```sql
   \d proposal_votes
   ```
3. Check RLS policies on proposal_votes:
   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'proposal_votes';
   ```
4. Verify vote column accepts "yes" and "no" (should be enum or text)

## How to View Logs

### Browser Console (Client-side)
1. Open DevTools: `F12` or `Ctrl+Shift+I`
2. Go to **Console** tab
3. Filter for `[proposeLawAction]` or `[voteOnProposalAction]`
4. Look for red error messages

### Server Logs (Terminal)
1. When running `npm run dev`, logs appear in terminal
2. Look for `[proposeLawAction]` or `[voteOnProposalAction]` prefixes
3. Red text = errors, Blue/Gray = info logs

### Supabase Dashboard
1. Go to Supabase console
2. Check "Logs" section for database errors
3. Look for failed inserts or permission errors

## Database Verification Queries

### Check User Profile
```sql
SELECT id, username FROM users
WHERE auth_id = '<your-auth-id>';
```

### Check Community Membership
```sql
SELECT cm.user_id, cm.rank_tier, cm.role, c.governance_type
FROM community_members cm
JOIN communities c ON c.id = cm.community_id
WHERE c.id = '<community-id>';
```

### Check Voting Rules
```sql
-- For the law type in question, check governance rules
-- Monarchy + DECLARE_WAR = rank 0 and 1 can vote
-- Monarchy + MESSAGE_OF_THE_DAY = only rank 0 can vote
```

### Check Proposals
```sql
SELECT id, law_type, status, proposer_id, created_at, expires_at
FROM community_proposals
WHERE community_id = '<community-id>'
ORDER BY created_at DESC;
```

### Check Votes on Specific Proposal
```sql
SELECT user_id, vote, created_at
FROM proposal_votes
WHERE proposal_id = '<proposal-id>'
ORDER BY created_at;
```

## Testing Checklist

Before reporting issues, verify:
- [ ] You are logged in
- [ ] Your user profile exists in `users` table
- [ ] You are a member of the community in `community_members`
- [ ] Your rank_tier is appropriate (0 for King, 1 for Secretary, 10 for member)
- [ ] The proposal exists in `community_proposals`
- [ ] The proposal status is "pending" (not "passed" or "rejected")
- [ ] Check browser console for errors
- [ ] Check server terminal for logs

## Key Code Locations

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `proposeLawAction` | `app/actions/laws.ts` | 35 | Propose new law |
| `voteOnProposalAction` | `app/actions/laws.ts` | 127 | Vote on proposal |
| `getCommunityProposalsAction` | `app/actions/laws.ts` | 552 | Fetch all proposals |
| `canVoteOnLaw` | `lib/governance/laws.ts` | 150 | Check vote permission |
| `canProposeLaw` | `lib/governance/laws.ts` | 135 | Check propose permission |

## Next Steps if Issues Persist

1. **Collect all logs** from browser console and server terminal
2. **Run verification queries** from section above
3. **Check RLS policies** - laws use rank-based access control
4. **Verify database schema** - all required columns present
5. **Test with fresh proposal** - create new law and try voting

## Related Files

- Law definitions: `lib/governance/laws.ts`
- Law design: `lib/law-design-system.ts`
- Proposal UI: `components/community/law-proposal-drawer.tsx`
- Voting UI: `components/community/politics-panel.tsx`
- Database migrations: `supabase/migrations/20260107_law_system.sql`

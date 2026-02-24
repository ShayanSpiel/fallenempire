# How to Trigger/Resolve Pending Laws

## 🎯 Quick Summary

Your app has **decisive vote resolution** built-in - when a king votes, the law immediately resolves. But for older proposals or expired ones, here are your options:

---

## Method 1: SQL Direct (Fastest) ⚡

### View all pending proposals:
```sql
SELECT 
  cp.id,
  cp.law_type,
  c.name AS community,
  c.governance_type,
  cp.created_at,
  cp.expires_at,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'yes') AS yes_votes,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'no') AS no_votes
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.status = 'pending'
ORDER BY cp.created_at DESC;
```

### Resolve all expired proposals:
```sql
SELECT * FROM resolve_expired_proposals();
```

This returns a summary:
- `processed_count`: Total proposals checked
- `passed_count`: Laws that passed
- `rejected_count`: Laws that failed
- `expired_count`: Proposals with no votes

---

## Method 2: API Endpoint (Production) 🔄

Call your existing cron endpoint:

```bash
# Local development
curl -X POST http://localhost:3000/api/cron/workflows

# Production
curl -X POST https://your-app.com/api/cron/workflows \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

This triggers all cron jobs including law resolution.

---

## Method 3: Admin Panel (Future) 🎛️

Create an admin button that calls:

```typescript
import { resolveExpiredProposalsAction } from '@/app/actions/laws';

async function resolveAllPendingLaws() {
  try {
    const result = await resolveExpiredProposalsAction();
    console.log('Resolved proposals:', result);
  } catch (error) {
    console.error('Error resolving laws:', error);
  }
}
```

---

## Method 4: Manual Resolution with Execution

For proposals that have decisive votes but haven't been resolved yet:

### Step 1: Apply the new migration
Run `supabase/migrations/20270207_add_manual_resolve_function.sql` in your Supabase SQL Editor

### Step 2: Call the function
```sql
SELECT * FROM manually_resolve_all_pending_proposals();
```

This will:
- ✅ Check all pending proposals
- ✅ Identify proposals with decisive votes
- ✅ Mark them as passed/rejected
- ✅ Return a list of what was resolved

### Step 3: Execute the laws
After marking proposals as passed, they need to be executed. You can either:

**Option A: Wait for next cron run** (automatic)

**Option B: Manually execute** (immediate):
```typescript
// In your app, for each passed proposal
import { executeLawAction } from '@/app/actions/laws';

// Get passed proposals that need execution
const { data: passedProposals } = await supabase
  .from('community_proposals')
  .select('id, law_type, community_id, metadata')
  .eq('status', 'passed')
  .is('resolved_at', 'not null');

// Execute each one
for (const proposal of passedProposals) {
  await executeLawAction(
    proposal.law_type,
    proposal.id,
    proposal.community_id
  );
}
```

---

## 🔥 One-Click Solution (Copy-Paste in SQL Editor)

```sql
-- First, resolve expired proposals
SELECT * FROM resolve_expired_proposals();

-- Then check what's still pending
SELECT 
  cp.id,
  cp.law_type,
  c.name AS community,
  'NEEDS DECISIVE VOTE' AS status
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.status = 'pending'
  AND cp.expires_at > NOW();

-- If you have pending proposals, apply the manual function migration
-- Then run:
-- SELECT * FROM manually_resolve_all_pending_proposals();
```

---

## 📊 Understanding Resolution Status

| Status | Meaning | Action Needed |
|--------|---------|---------------|
| `EXPIRED - Ready to resolve` | Past expiry date | Run `resolve_expired_proposals()` |
| `DECISIVE VOTE - King has voted` | King voted in monarchy | Run `manually_resolve_all_pending_proposals()` |
| `PENDING` | Waiting for more votes or time | None - let it run naturally |

---

## ⚙️ Automatic Resolution (How It Works)

Your app has **3 automatic resolution triggers**:

1. **Immediate (Decisive Vote)**: When a vote is cast, `maybeResolveProposalEarly()` checks if it's decisive
   - In monarchy: King's vote immediately passes/rejects
   - In democracy: When majority threshold is reached

2. **Cron Job**: Every minute, `resolve_expired_proposals()` runs
   - Resolves all proposals past their `expires_at` date
   - Executes passed laws automatically

3. **On Demand**: You can call `resolveExpiredProposalsAction()` anytime

---

## 🐛 Troubleshooting

**Q: Why didn't my king's vote resolve the law?**
A: The `maybeResolveProposalEarly` function should have been called. Check:
1. Is the error logged in console?
2. Did the migration for MESSAGE_OF_THE_DAY run?
3. Try refreshing the page

**Q: I resolved proposals but laws didn't execute**
A: The SQL function only marks them as passed/rejected. Laws are executed by:
1. The app layer (`executeLawAction`)
2. Run the cron endpoint to trigger execution

**Q: How do I know if decisive votes are working?**
A: Check the logs when voting. You should see:
```
[maybeResolveProposalEarly] ...
```

If this doesn't appear, the function isn't being called after voting.

---

## 🚀 Recommended Approach

For production, use **Method 2** (API endpoint) and set up:
1. A cron job that calls `/api/cron/workflows` every minute
2. An admin button that calls `resolveExpiredProposalsAction()` for manual triggers

For development, use **Method 1** (SQL) for quick testing.

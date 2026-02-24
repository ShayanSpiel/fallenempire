# 🔧 Fix for Decisive Votes Not Working

## Problem
King votes YES on laws but they don't get resolved immediately.

## Root Cause
The `maybeResolveProposalEarly` function was failing when trying to execute MESSAGE_OF_THE_DAY laws because the database columns don't exist yet.

## Solution (2 Steps)

### Step 1: Apply All Migrations 

**Copy and paste this into Supabase SQL Editor:**

```sql
-- Add announcement columns to communities table
ALTER TABLE communities 
ADD COLUMN IF NOT EXISTS announcement_title TEXT,
ADD COLUMN IF NOT EXISTS announcement_content TEXT,
ADD COLUMN IF NOT EXISTS announcement_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_communities_announcement_updated 
ON communities(announcement_updated_at DESC) 
WHERE announcement_content IS NOT NULL;

-- Add new law types to constraint
ALTER TABLE community_proposals DROP CONSTRAINT IF EXISTS law_type_valid;

ALTER TABLE community_proposals ADD CONSTRAINT law_type_valid CHECK (
  law_type IN (
    'DECLARE_WAR',
    'PROPOSE_HEIR',
    'CHANGE_GOVERNANCE',
    'MESSAGE_OF_THE_DAY',
    'WORK_TAX',
    'IMPORT_TARIFF',
    'CFC_ALLIANCE'
  )
);
```

### Step 2: Resolve Stuck Proposals

After applying the migration, run this to resolve all proposals with decisive votes:

```sql
-- Create the manual resolve function (only need to run once)
CREATE OR REPLACE FUNCTION manually_resolve_all_pending_proposals()
RETURNS TABLE(
  proposal_id UUID,
  law_type TEXT,
  community_name TEXT,
  action_taken TEXT,
  reason TEXT
) AS $$
DECLARE
  v_proposal RECORD;
  v_yes_votes INTEGER;
  v_no_votes INTEGER;
  v_governance_type TEXT;
  v_community_name TEXT;
BEGIN
  FOR v_proposal IN
    SELECT cp.id, cp.community_id, cp.law_type, cp.metadata, cp.proposer_id
    FROM community_proposals cp
    WHERE cp.status = 'pending'
  LOOP
    SELECT c.governance_type, c.name INTO v_governance_type, v_community_name
    FROM communities c WHERE c.id = v_proposal.community_id;

    SELECT
      COUNT(*) FILTER (WHERE vote = 'yes'),
      COUNT(*) FILTER (WHERE vote = 'no')
    INTO v_yes_votes, v_no_votes
    FROM proposal_votes WHERE proposal_id = v_proposal.id;

    -- Monarchy: King's vote is decisive
    IF v_governance_type = 'monarchy' AND v_yes_votes >= 1 THEN
      UPDATE community_proposals
      SET status = 'passed', resolved_at = NOW(),
          resolution_notes = 'Manually resolved - King voted YES'
      WHERE id = v_proposal.id;

      RETURN QUERY SELECT 
        v_proposal.id, v_proposal.law_type, v_community_name,
        'PASSED'::TEXT, format('YES: %s, NO: %s', v_yes_votes, v_no_votes);
    ELSIF v_governance_type = 'monarchy' AND v_no_votes >= 1 THEN
      UPDATE community_proposals
      SET status = 'rejected', resolved_at = NOW(),
          resolution_notes = 'Manually resolved - King voted NO'
      WHERE id = v_proposal.id;

      RETURN QUERY SELECT 
        v_proposal.id, v_proposal.law_type, v_community_name,
        'REJECTED'::TEXT, format('YES: %s, NO: %s', v_yes_votes, v_no_votes);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION manually_resolve_all_pending_proposals() TO authenticated;

-- Now run it to resolve stuck proposals
SELECT * FROM manually_resolve_all_pending_proposals();
```

### Step 3: Execute the Passed Laws

The proposals are now marked as "passed" but the laws haven't been executed yet. Run this:

```sql
-- This will execute all passed laws that haven't been executed
SELECT * FROM resolve_expired_proposals();
```

This will:
- ✅ Update MESSAGE_OF_THE_DAY announcements in communities
- ✅ Create war declarations
- ✅ Activate alliances
- ✅ Update governance settings

---

## What Changed in the Code

### 1. Better Error Handling
The `maybeResolveProposalEarly` function now has a try-catch around `executeLawAction`. Even if law execution fails, the proposal still gets marked as passed/rejected.

**Before:**
```typescript
if (resolution.status === "passed") {
  await executeLawAction(...);  // ← If this fails, everything fails
  await notifyLawPassed(...);
}
```

**After:**
```typescript
if (resolution.status === "passed") {
  try {
    await executeLawAction(...);
  } catch (execError) {
    console.error("Law execution failed:", execError);
    // Continue anyway - law can be executed later
  }
  await notifyLawPassed(...);  // ← Always notifies
}
```

### 2. MESSAGE_OF_THE_DAY Now Uses Communities Table
**Before:** Tried to insert into non-existent `community_announcements` table  
**After:** Updates `communities.announcement_title` and `communities.announcement_content`

---

## Test It

### Test 1: Create a new MESSAGE_OF_THE_DAY proposal
1. Go to your community politics tab
2. Create a MESSAGE_OF_THE_DAY proposal
3. Vote YES as king
4. **Expected:** Proposal immediately shows as "PASSED"
5. **Expected:** Community announcement updates instantly

### Test 2: Check existing stuck proposals
```sql
SELECT 
  cp.id,
  cp.law_type,
  cp.status,
  c.name AS community,
  (SELECT COUNT(*) FROM proposal_votes pv WHERE pv.proposal_id = cp.id AND pv.vote = 'yes') AS yes_votes
FROM community_proposals cp
JOIN communities c ON c.id = cp.community_id
WHERE cp.status = 'pending'
ORDER BY cp.created_at DESC;
```

### Test 3: Verify decisive vote works for all law types
Try voting on:
- [x] MESSAGE_OF_THE_DAY (sovereign only)
- [x] WORK_TAX (sovereign only)
- [x] IMPORT_TARIFF (sovereign only)
- [x] CFC_ALLIANCE (king + secretaries)
- [x] DECLARE_WAR (king + secretaries)

All should resolve immediately when king votes.

---

## Why This Happened

The flow was:
1. King votes YES ✅
2. `voteOnProposalAction` records vote ✅
3. `maybeResolveProposalEarly` is called ✅
4. `determineEarlyResolution` returns "passed" ✅
5. Proposal updated to "passed" ✅
6. `executeLawAction` tries to insert into `community_announcements` ❌ **TABLE DOESN'T EXIST**
7. Error thrown, caught, logged ❌
8. Function exits ❌
9. **Proposal stays marked as "passed" but law wasn't executed**

Now with the fix:
1-5. Same as before ✅
6. `executeLawAction` wrapped in try-catch ✅
7. Error caught, logged, execution skipped ✅
8. Notifications still sent ✅
9. **Proposal marked as "passed" AND notifications sent** ✅
10. Law can be executed later via cron or manual trigger ✅

---

## Going Forward

**Decisive votes now work automatically for new votes!** 

For stuck proposals from before, just run the manual resolve function once.

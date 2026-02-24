# Governance System - Integration Checklist

## Pre-Deployment Steps

### Database Migrations
- [ ] Run `20260105_governance_system.sql` in Supabase
  - [ ] `governance_type` column added to communities
  - [ ] `rank_tier` column added to community_members
  - [ ] Trigger `enforce_single_sovereign()` created
  - [ ] Helper functions created
  - [ ] Indexes created
  - [ ] Data backfilled (founders → rank 0, members → rank 10)

- [ ] Run `20260106_update_governance_constraints.sql` in Supabase
  - [ ] RLS policies updated
  - [ ] `declare_war()` function updated
  - [ ] Sovereign lookup index created

### Code Integration
- [ ] `lib/governance.ts` created
  - [ ] GOVERNANCE_TYPES config defined
  - [ ] Helper functions implemented
  - [ ] TypeScript types exported

- [ ] `app/actions/community.ts` updated
  - [ ] Import `validateRankAssignment` from governance
  - [ ] `assignRankAction()` implemented
  - [ ] `claimThroneAction()` implemented
  - [ ] `createCommunityAction()` updated to set rank_tier = 0

- [ ] `components/community/governance-hierarchy.tsx` created
  - [ ] Component renders hierarchy
  - [ ] Sovereign section shows crown icon
  - [ ] Secretary slots display correctly
  - [ ] "Claim the Throne" button appears when needed
  - [ ] Assign rank functionality works

- [ ] `components/community/community-details-client.tsx` updated
  - [ ] Import `GovernanceHierarchy` component
  - [ ] Import `Crown` icon
  - [ ] Add "Governance" tab to TAB_OPTIONS
  - [ ] Add governance-related props to component
  - [ ] Render `GovernanceHierarchy` in Governance tab content

- [ ] `components/community/community-member-sheet.tsx` updated
  - [ ] Member type updated to include `rank_tier` and `user_id`
  - [ ] Optional fields marked correctly

### Documentation
- [ ] `GOVERNANCE_SYSTEM_README.md` created
  - [ ] Architecture explained
  - [ ] Usage examples provided
  - [ ] Query examples included
  - [ ] Security considerations noted
  - [ ] Performance tips documented

- [ ] `GOVERNANCE_QUICK_START.md` created
  - [ ] Quick reference for developers
  - [ ] Configuration explained
  - [ ] Common tasks listed

- [ ] `GOVERNANCE_EXAMPLES.md` created
  - [ ] Real-world implementation examples
  - [ ] Code patterns shown
  - [ ] Database queries demonstrated

- [ ] `GOVERNANCE_IMPLEMENTATION_SUMMARY.md` created
  - [ ] What was implemented
  - [ ] How to extend
  - [ ] Testing recommendations

## Testing Checklist

### Unit Tests
- [ ] `validateRankAssignment()` validates constraints
  - [ ] Returns valid for valid assignments
  - [ ] Returns error when exceeding maxCount
  - [ ] Returns error for invalid rank tiers
  - [ ] Returns error for invalid governance types

- [ ] `getRankLabel()` returns correct labels
  - [ ] Monarchy rank labels correct
  - [ ] Future governance types work

- [ ] `canAssignRanks()` checks permissions
  - [ ] Returns true for authorized ranks
  - [ ] Returns false for unauthorized ranks

### Integration Tests
- [ ] **Community Creation**
  - [ ] Creator gets rank_tier = 0
  - [ ] Creator has role = "founder" (legacy)
  - [ ] Community governance_type = "monarchy"

- [ ] **Governance Hierarchy Display**
  - [ ] Sovereign displays with crown icon
  - [ ] Empty throne shows "Claim the Throne" button
  - [ ] Secretary slots show correctly (3 for monarchy)
  - [ ] Member list shows all rank 10 members
  - [ ] Component respects isUserSovereign prop

- [ ] **Claim Throne**
  - [ ] User can claim throne when community is leaderless
  - [ ] rank_tier set to 0 after claiming
  - [ ] Cannot claim if sovereign already exists
  - [ ] Cannot claim if not a member

- [ ] **Assign Rank**
  - [ ] Sovereign can assign rank 1
  - [ ] Cannot assign more than 3 rank 1 (monarchy)
  - [ ] Non-sovereign cannot assign ranks
  - [ ] Rank updates immediately in UI
  - [ ] Persists after page reload

- [ ] **Backwards Compatibility**
  - [ ] Old "founder" role still works
  - [ ] Old "member" role still works
  - [ ] Existing communities function normally
  - [ ] founder check in declareWarAction works
  - [ ] Founder-only features still protected

### Permission Tests
- [ ] **Declare War**
  - [ ] Only sovereign (rank 0) can declare war
  - [ ] Founder (legacy) can still declare war
  - [ ] Member cannot declare war

- [ ] **Update Settings**
  - [ ] Only founder can update community settings
  - [ ] Sovereign (with founder role) can update

- [ ] **Kick Members**
  - [ ] Only founder/leader can kick members
  - [ ] Rank tier alone doesn't grant kick permission

### Database Tests
- [ ] **Trigger: enforce_single_sovereign**
  - [ ] Cannot create two rank_tier = 0 in same community
  - [ ] Can create multiple rank_tier = 1
  - [ ] Can create unlimited rank_tier = 10

- [ ] **RLS Policies**
  - [ ] Members can view their community
  - [ ] Non-members cannot view community
  - [ ] Founder can update governance

- [ ] **Indexes**
  - [ ] Queries on rank_tier use indexes
  - [ ] Sovereign lookup is fast

### Edge Cases
- [ ] **Two Users Claim Throne**
  - [ ] Second user gets error
  - [ ] Only first gets rank 0

- [ ] **Demote Your Own Sovereign**
  - [ ] Sovereign can change own rank (or prevent?)
  - [ ] Decision on business logic

- [ ] **Delete Community**
  - [ ] All members deleted
  - [ ] Governance structure cleaned up

- [ ] **Empty Secretary Slot**
  - [ ] Can assign any member to any slot
  - [ ] No slot-specific persistence

- [ ] **Massive Community**
  - [ ] 1 sovereign, 3 secretaries, 1000 members
  - [ ] UI still responsive
  - [ ] Queries still fast

## Browser Testing

### Desktop
- [ ] Chrome
  - [ ] Governance tab renders
  - [ ] Assign rank works
  - [ ] Claim throne works

- [ ] Firefox
  - [ ] Same as Chrome

- [ ] Safari
  - [ ] Same as Chrome

### Mobile
- [ ] iOS Safari
  - [ ] Responsive layout
  - [ ] Touch interactions work

- [ ] Android Chrome
  - [ ] Responsive layout
  - [ ] Touch interactions work

## Performance Testing

### Database
- [ ] Query sovereign: < 10ms
- [ ] Query all members: < 100ms
- [ ] Query by rank: < 50ms
- [ ] Assign rank: < 500ms total

### UI
- [ ] GovernanceHierarchy renders: < 100ms
- [ ] Tab switch: < 200ms
- [ ] Claim throne action: < 1s with loading state

### Network
- [ ] Server action payload: < 1KB
- [ ] Component re-renders efficiently
- [ ] No unnecessary API calls

## Deployment

### Pre-Deployment
- [ ] All tests pass
- [ ] Code reviewed
- [ ] Documentation complete
- [ ] Migrations ready
- [ ] Backup created

### Deployment Steps
1. [ ] Deploy database migrations to Supabase
   - [ ] Verify migrations completed
   - [ ] Data backfilled correctly

2. [ ] Deploy code to production
   - [ ] TypeScript compilation succeeds
   - [ ] No runtime errors
   - [ ] Environment variables set

3. [ ] Verify Deployment
   - [ ] Create test community
   - [ ] Check governance hierarchy
   - [ ] Test claim throne
   - [ ] Test assign rank

### Post-Deployment
- [ ] Monitor error logs
  - [ ] No governance-related errors
  - [ ] No database errors

- [ ] Verify data
  - [ ] All communities have governance_type
  - [ ] Founders have rank_tier = 0
  - [ ] Members have rank_tier = 10

- [ ] User feedback
  - [ ] UI feels responsive
  - [ ] No confused users
  - [ ] Clear feedback messages

## Future Enhancements Tracking

- [ ] Permission Matrix per rank
- [ ] Election system for rank assignments
- [ ] Term limits for sovereigns
- [ ] Succession planning
- [ ] Council voting on decisions
- [ ] Custom rank titles
- [ ] Activity tracking
- [ ] Rank history/audit log
- [ ] Batch rank assignments

## Sign-Off

- [ ] Developer tested and verified
- [ ] Code reviewed by team lead
- [ ] QA tested in staging
- [ ] Product approved for release
- [ ] Deployed to production
- [ ] Monitoring in place
- [ ] Documentation published

---

## Quick Troubleshooting

### Error: "Only the Sovereign can assign ranks."
- Check user is rank_tier = 0
- Check community governance_type is set
- Verify database migration ran

### Error: "A community can only have one Sovereign"
- Check enforce_single_sovereign trigger exists
- Verify no two rank_tier = 0 in same community
- Check database integrity

### UI Not Showing Governance Tab
- Check GovernanceHierarchy component imports correctly
- Check governanceType prop passed to component
- Check members data includes rank_tier
- Check tab name is exactly "Governance"

### Claim Throne Button Not Showing
- Check hasNoSovereign calculated correctly
- Check isUserSovereign = false
- Check community has no rank_tier = 0 member
- Check user is a member

### Assignment Not Persisting
- Check assignRankAction returns no error
- Verify revalidatePath in action
- Check user rank_tier in database after action
- Clear browser cache

### Members Not Showing Ranks
- Check members query includes rank_tier
- Check Member type updated with rank_tier
- Check component maps rank_tier correctly
- Verify backfill migration ran

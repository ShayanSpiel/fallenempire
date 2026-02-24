# Migration Troubleshooting Guide

## What Happened

The first migration **did not fully complete**. You saw "FIRST ONE DONE" but the database columns were not actually created. This is why:
- The community page threw an error about `community_group_id` not existing
- The cleanup migration failed with the same error

## Current State ✅ (Fixed)

I've updated the code to **work both before AND after migration**:

1. ✅ **Community page fixed** - No longer crashes if migration hasn't run
2. ✅ **Feed tab works** - Shows a notice if chat not migrated yet
3. ✅ **Graceful fallback** - App works normally, just without unified chat

## Next Steps

### Step 1: Verify Current Database State

Run the verification script:

```bash
psql $DATABASE_URL -f docs/sql/verify-migration-state.sql
```

This will tell you:
- ✅ or ❌ if migration columns exist
- How many messages need migrating
- Current community count
- Sovereign/founder info for each community

### Step 2: Run Main Migration (If Needed)

**If verification shows migration NOT applied**, run:

```bash
# Using Supabase CLI
supabase db push

# OR using psql directly
psql $DATABASE_URL -f supabase/migrations/20260401_unify_community_chat_with_group_messages.sql
```

**Watch for:**
- ✅ Success messages
- ⚠️ Warning messages (review but may be OK)
- ❌ ERROR messages (stop and report)

### Step 3: Test the App

After migration succeeds:

1. **Visit a community page**
   - Should load without errors
   - Home tab should show feed
   - Should see "Open Community Chat" button

2. **Click "Open Community Chat"**
   - Should navigate to `/messages?group={id}`
   - Should see community members in chat
   - Should be able to send messages

3. **Test commands** (if you're Sovereign)
   - Type `/summary` - should show proposals/events
   - Type `/kick <username>` - should work if you have permissions

### Step 4: Run Cleanup (OPTIONAL)

**Only after thorough testing**, run cleanup to remove old table:

```bash
psql $DATABASE_URL -f supabase/migrations/20260402_cleanup_community_messages.sql
```

⚠️ **This is irreversible!** It will drop the old `community_messages` table.

## Common Issues & Solutions

### Issue: "founder_id does not exist"
**Solution**: ✅ Already fixed in migration. Re-run if you saw this.

### Issue: "community_group_id does not exist"
**Solution**: ✅ Frontend now handles this gracefully. Migration hasn't run yet.

### Issue: Migration seems stuck
**Solution**: Check Supabase logs. May need to run in transaction:
```sql
BEGIN;
-- paste migration SQL here
COMMIT; -- or ROLLBACK; if errors
```

### Issue: Some communities have no group chat after migration
**Solution**: Run this to manually create missing ones:
```sql
SELECT create_community_group_chat(id)
FROM communities
WHERE community_group_id IS NULL;
```

## Rollback (If Needed)

If you need to undo the migration **before cleanup**:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS trg_auto_add_to_community_group ON community_members;
DROP TRIGGER IF EXISTS trg_auto_remove_from_community_group ON community_members;

-- Remove functions
DROP FUNCTION IF EXISTS auto_add_member_to_community_group();
DROP FUNCTION IF EXISTS auto_remove_member_from_community_group();
DROP FUNCTION IF EXISTS create_community_group_chat(UUID);

-- Remove columns (will lose data!)
ALTER TABLE communities DROP COLUMN IF EXISTS community_group_id;
ALTER TABLE group_conversations DROP COLUMN IF EXISTS is_community_chat;
ALTER TABLE group_conversations DROP COLUMN IF EXISTS community_id;
ALTER TABLE group_messages DROP COLUMN IF EXISTS role_metadata;

-- Restore old notification function
-- (see original group chat migration)
```

## Testing Checklist

Before running cleanup migration:

- [ ] All communities have `community_group_id` set
- [ ] Community pages load without errors
- [ ] "Open Community Chat" button works
- [ ] Messages send successfully in community chats
- [ ] `/summary` command works
- [ ] Role badges show correctly (Sovereign/Secretary/Member)
- [ ] Notifications link to `/messages?group={id}`
- [ ] Old `community_messages` data visible in new system

## Support

If you're stuck:

1. **Run verification script** - Shows current state
2. **Check Supabase logs** - See actual errors
3. **Share error output** - Paste full error for debugging
4. **Check migration file** - Ensure using latest version

## Files Changed

### Safe to Keep Using (Even Before Migration)
- ✅ `app/community/[slug]/page.tsx` - Auto-detects migration state
- ✅ `components/community/community-feed-tab.tsx` - Graceful fallback
- ✅ `components/community/community-details-client.tsx` - Works both ways

### Migration Files
- `supabase/migrations/20260401_unify_community_chat_with_group_messages.sql` - Main migration
- `supabase/migrations/20260402_cleanup_community_messages.sql` - Cleanup (run last)
- `docs/sql/verify-migration-state.sql` - Verification helper

### Documentation
- `docs/guides/refactoring-complete.md` - Full refactoring details
- `docs/guides/migration-troubleshooting.md` - This file

---

**Current Status**: App works with or without migration. Safe to use in current state.

**Recommended**: Run verification script, then main migration when ready.

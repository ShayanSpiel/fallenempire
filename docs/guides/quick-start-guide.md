# ✅ Migration Quick Start Guide

## Current Status
- ✅ App is **working** (with graceful fallback)
- ❌ Migration **not yet applied**
- 🎯 Ready to run fresh migration

---

## Run The Migration (Simple)

### 1. Copy & Run This File in Supabase SQL Editor:
```
docs/sql/run-this-in-supabase.sql
```

**What it does:**
- Cleans any partial state
- Adds all new columns
- Creates group chats for all communities
- Sets up triggers and notifications
- Shows success summary

**Expected output:**
```
✅ Migration complete!
Total communities: X
Communities with group chats: X
```

---

## Test It Works

### 1. Visit a Community Page
- Should load without errors ✅
- Home tab shows **Feed** (not chat) ✅
- Should see "Open Community Chat" button ✅

### 2. Click "Open Community Chat"
- Opens `/messages?group={id}` ✅
- Shows community members ✅
- Can send messages ✅

### 3. Test Commands (if you're Sovereign)
- Type `/summary` → Shows proposals & events ✅
- Type `/kick <username>` → Removes member ✅

---

## After Testing (Optional Cleanup)

### Run This File in Supabase SQL Editor:
```
docs/sql/cleanup-after-verification.sql
```

**What it does:**
- Verifies migration succeeded
- Drops old `community_messages` table
- Removes old triggers/policies

**⚠️ This is irreversible!** Only run after thorough testing.

---

## Files Reference

### Run These (In Order):
1. ✅ `docs/sql/run-this-in-supabase.sql` - Main migration (run first)
2. ⏳ Test the app thoroughly
3. ⏳ `docs/sql/cleanup-after-verification.sql` - Remove old table (run last)

### Documentation:
- `docs/guides/refactoring-complete.md` - Full technical details
- `docs/guides/migration-troubleshooting.md` - If you have issues
- `docs/guides/quick-start-guide.md` - This file

### Verification (Optional):
- `docs/sql/verify-migration-state.sql` - Check current state
- `docs/sql/reset-before-migration.sql` - Only if you need to reset

---

## What Changed

### Before:
- Community Home tab = Chat
- 3 separate messaging systems
- Duplicate code everywhere

### After:
- Community Home tab = **Feed** (posts with reactions)
- "Open Community Chat" button → `/messages`
- 2 unified systems (Messages + Feed)
- Commands work in community chats (`/summary`, `/kick`)
- ~500 lines of duplicate code removed

---

## If Something Goes Wrong

1. **App still works** - Graceful fallback built in
2. **Can rollback** - Just don't run cleanup
3. **Check troubleshooting** - See `docs/guides/migration-troubleshooting.md`
4. **Fresh start** - Run `docs/sql/reset-before-migration.sql` then main migration

---

## Development Phase Benefits

Since you're in development:
- ✅ Safe to reset community data
- ✅ Can run migration multiple times
- ✅ No production impact
- ✅ Easy to test and iterate

---

## Next Steps

1. **Copy `docs/sql/run-this-in-supabase.sql`**
2. **Paste in Supabase SQL Editor**
3. **Run it**
4. **Test your app**
5. **Celebrate** 🎉

That's it! The entire migration is in one file for easy execution.

# ⚡ Instant Fix: Community Chat RLS Policy

## The Problem
Messages can't be sent because the Row-Level Security (RLS) policy on `community_messages` table is blocking INSERT operations.

## The Solution - 2 Steps

### Step 1: Copy the SQL Script
Open this file: `FIX_COMMUNITY_CHAT_RLS.sql`

### Step 2: Run it in Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **"New Query"**
5. Copy and paste ALL the contents of `FIX_COMMUNITY_CHAT_RLS.sql`
6. Click **"Run"** button (or press Ctrl+Enter)

## That's It! 🎉

Once the SQL runs successfully:
- ✅ All old policies are removed
- ✅ New correct policies are created
- ✅ Chat messages will work immediately

## How to Test

1. Go to any community you're a member of
2. Click on **Home** tab
3. Click on **Chat** sub-tab
4. Type a message in the floating input box
5. Press **Enter** or click **"Transmit"**
6. Message should appear instantly ✨

## What the SQL Does

| Policy | Action | Allows |
|--------|--------|--------|
| `select_community_messages` | SELECT | View messages from your communities |
| `insert_community_messages` | INSERT | Send messages to your communities |
| `delete_community_messages` | DELETE | Delete your own messages |

## If Something Goes Wrong

**Error: "syntax error"**
- Make sure you copied the ENTIRE script
- Check for missing semicolons at the end of statements

**Error: "policy already exists"**
- Run the script again - it will drop old policies first

**Still can't send messages?**
1. Refresh the browser page
2. Check browser console for error messages
3. Make sure you're a member of the community
4. Run the SELECT query at the end to verify policies exist

## Need More Help?

The script includes a verification query at the end that shows all RLS policies on the table. If you see 3 policies listed (select, insert, delete), then everything is correct!

---

**File Location**: `FIX_COMMUNITY_CHAT_RLS.sql` (in project root)

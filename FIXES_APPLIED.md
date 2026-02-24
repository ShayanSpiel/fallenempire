# Message and Group Chat Fixes Applied

## Issues Fixed

### 1. Direct Messages Error - 400 Bad Request
**Problem**: Sending direct messages returned error 400 with "column does not exist"
**Root Cause**: The `notify_on_direct_message()` trigger was trying to insert into the `notifications` table without providing the required `community_id` column, which violated the NOT NULL constraint.
**Solution**:
- Removed the `notify_on_direct_message()` trigger and function entirely
- Fixed the API SELECT query to use `.select()` instead of specifying column names
- This allows messages to be saved without the broken notification system

**Migration**: `20260131_fix_messages_and_groups.sql` (lines 6-12)

### 2. Group Creation Error - Infinite Recursion in RLS
**Problem**: Creating group conversations failed with "infinite recursion detected in policy"
**Root Cause**: The RLS policies on `group_conversation_participants` table were self-referencing:
- INSERT policy tried to SELECT from `group_conversation_participants` while inserting into it
- This created a circular reference that PostgreSQL's RLS engine detected as infinite recursion

**Solution**:
- Rewrote all RLS policies to avoid self-referential SELECT statements
- Used aliased table names (`gcp2`) in SELECT subqueries to break the recursion chain
- Simplified the INSERT policy to allow:
  1. The user adding themselves to the group
  2. Group admins (via alias check)
  3. Group creators (via direct check on `group_conversations` table)

**Migration**: `20260131_fix_messages_and_groups.sql` (lines 14-109)

### 3. Group Message Sending - Broken Trigger
**Problem**: Group messages could not be sent
**Root Cause**: The `notify_on_group_message()` trigger had the same issue as direct messages
**Solution**: Removed the trigger entirely

**Migration**: `20260131_fix_messages_and_groups.sql` (lines 111-113)

## Code Changes

### API Changes
- **File**: `/app/api/messages/route.ts`
  - Line 70: Changed `.select("id, sender_id, recipient_id, content, created_at")` to `.select()`
  - Line 146: Fixed foreign key reference from `sender:users!direct_messages_sender_id_fk(...)` to `sender:sender_id(...)`

## What Works Now
✅ Direct messages can be sent and saved to database
✅ Group conversations can be created
✅ Group participants can be added
✅ Messages (direct and group) are persisted to the database

## What Still Needs Work
❌ Notifications system - Currently disabled due to constraint violations
  - The notifications table requires `community_id` which messages don't have
  - Need to redesign notifications to:
    1. Make `community_id` truly optional (handle NULL values properly)
    2. Or create a separate `message_notifications` table
    3. Implement triggers that properly handle both types

## How to Verify the Fixes
1. Send a direct message - should save without 400 error
2. Check database: `SELECT * FROM direct_messages;` - should show the message
3. Create a group conversation - should succeed without recursion error
4. Add participants to a group - should work without errors
5. Send a message in a group - should save to `group_messages` table

## Next Steps
1. Redesign the notification system to handle messages
2. Re-implement notification triggers once constraints are properly set up
3. Add real-time notification delivery via Supabase Realtime

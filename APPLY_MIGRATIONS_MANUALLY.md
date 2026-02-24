# Manual Migration Guide for Direct Messages System

The Direct Messages system requires several database migrations. Since you're getting 400/403 errors, the RLS policies aren't properly set up.

## Quick Fix: Run These SQL Scripts in Order

Go to **Supabase Dashboard** → **SQL Editor** and run each of these scripts in order:

### 1. Fix Direct Messages RLS (Critical!)
Copy and paste the SQL from:
```
supabase/migrations/20260128_fix_direct_messages_rls.sql
```

Then copy and paste:
```
supabase/migrations/20260121_fix_direct_messages_rls_v2.sql
```

### 2. Add Message Notifications Table
Copy and paste:
```
supabase/migrations/20260129_add_message_notifications.sql
```

### 3. Add Group Chat Tables
Copy and paste:
```
supabase/migrations/20260130_add_group_chat.sql
```

### 4. Add Admin Settings Table
Copy and paste:
```
supabase/migrations/20250121_add_admin_settings.sql
```

## Step-by-Step Instructions:

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy the ENTIRE contents of each migration file
5. Paste into the SQL editor
6. Click **Run** button (or Ctrl+Enter)
7. Wait for success message
8. Repeat for each migration file

## Files to Run (in this order):

1. `supabase/migrations/20260128_fix_direct_messages_rls.sql`
2. `supabase/migrations/20260121_fix_direct_messages_rls_v2.sql`
3. `supabase/migrations/20260129_add_message_notifications.sql`
4. `supabase/migrations/20260130_add_group_chat.sql`
5. `supabase/migrations/20250121_add_admin_settings.sql`

## What Each Migration Does:

- **fix_direct_messages_rls**: Sets up proper RLS policies for sending/receiving messages
- **add_message_notifications**: Creates notifications table and triggers
- **add_group_chat**: Creates group conversation tables with RLS
- **add_admin_settings**: Creates settings table for admin features

## Verifying Migrations Applied:

After running each migration, verify in SQL Editor with:
```sql
-- Check direct_messages table exists
SELECT * FROM pg_tables WHERE tablename = 'direct_messages';

-- Check RLS is enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'direct_messages';

-- Check group_conversations table
SELECT * FROM pg_tables WHERE tablename = 'group_conversations';

-- Check admin_settings table
SELECT * FROM pg_tables WHERE tablename = 'admin_settings';
```

## Troubleshooting:

**If you get "relation does not exist" error:**
- Make sure you're running migrations in order
- Make sure the direct_messages table was created by the initial migration

**If you get "column does not exist" error:**
- Check that all tables have the expected columns
- The 'users' table should have 'auth_id' column
- The 'auth.users' table should exist (Supabase default)

**If messages still don't send after migrations:**
- Check browser console for full error message
- Verify your user is properly authenticated
- Check that your profile exists in the 'users' table

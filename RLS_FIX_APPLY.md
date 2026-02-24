# RLS Fix: Apply Communities Public Read Policy

## Problem
The map was timing out (1353ms latency) because the communities table had a restrictive RLS policy requiring membership to view. When the map tried to join `world_regions` → `communities`, Supabase filtered out all data, returning NULL for every community regardless of ownership.

## Solution
Add a public read policy to communities while keeping write operations restricted.

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended for Testing)

1. Go to https://app.supabase.com/project/YOUR_PROJECT_ID/editor/sql
2. Copy the SQL from `supabase/migrations/20260127_fix_communities_public_read.sql`
3. Paste and execute it
4. Refresh your app - latency should drop to ~100-200ms

### Option 2: Via Migration (if using Supabase CLI)

```bash
supabase db push
```

This will automatically detect and apply the migration.

### Option 3: Manual SQL (Direct Database)

```sql
-- DROP THE RESTRICTIVE MEMBER-ONLY POLICY
DROP POLICY IF EXISTS "Users can view their community" ON public.communities;

-- ADD PUBLIC READ
CREATE POLICY "Public read communities" ON public.communities
FOR SELECT USING (true);

-- KEEP WRITE RESTRICTIONS
CREATE POLICY "Users can manage their own communities" ON public.communities
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND rank_tier <= 1
  )
);

CREATE POLICY "Users can delete their own communities" ON public.communities
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND rank_tier = 0
  )
);
```

## Expected Results
- Map latency: 1353ms → ~100-200ms
- Network requests: No more NULL responses
- All community info displays correctly on map

## Why This is Safe
1. **Communities are public game entities** - meant to be visible globally
2. **Only name + color exposed** - no sensitive data
3. **Write operations remain restricted** - only members can modify
4. **Read permissions don't break gameplay** - seeing community names is required for map

## Verify It Works
After applying:
1. Refresh your map
2. Click a hex
3. Check Ctrl+P performance overlay
4. Latency should drop significantly
5. Console should show successful queries (no null data)

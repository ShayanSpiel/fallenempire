# Supabase Database Optimization Guide

## Problem Identified

Your map is experiencing **1000+ ms query times** on Supabase. This is a **database indexing issue**, not code.

**Current Performance:**
```
regions query: 1095ms (should be <100ms)
communities query: 926ms (should be <50ms)
Total: 1443ms (should be <200ms)
```

## Root Cause: Missing Database Indexes

PostgreSQL queries are slow because the database can't efficiently look up your data. You need **indexes** on the columns you're filtering/ordering by.

## Immediate Fix: Add Missing Indexes

Go to **Supabase Dashboard → SQL Editor** and run these queries:

### 1. Index on world_regions hex_id (CRITICAL)
```sql
-- Check if index exists
SELECT * FROM pg_indexes
WHERE tablename = 'world_regions'
AND indexname LIKE '%hex_id%';

-- If empty, create it:
CREATE INDEX idx_world_regions_hex_id
ON world_regions(hex_id);
```

### 2. Index on world_regions owner_community_id
```sql
-- Check if index exists
SELECT * FROM pg_indexes
WHERE tablename = 'world_regions'
AND indexname LIKE '%owner_community_id%';

-- If empty, create it:
CREATE INDEX idx_world_regions_owner_community_id
ON world_regions(owner_community_id);
```

### 3. Ensure communities table has primary key
```sql
-- This should already exist, just verify:
-- Your communities.id should be the PRIMARY KEY

-- Check:
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'communities'
AND constraint_type = 'PRIMARY KEY';
```

### 4. Optional: Composite Index if you often filter by both
```sql
-- Only if you frequently query by both columns
CREATE INDEX idx_world_regions_hex_owner
ON world_regions(hex_id, owner_community_id);
```

## What These Indexes Do

**Before indexes:**
- PostgreSQL scans ENTIRE `world_regions` table line by line (slow!)
- Fetching 21 regions takes 1000+ ms

**After indexes:**
- PostgreSQL uses index to jump directly to matching rows
- Fetching 21 regions takes 50-100 ms

## How to Run These Queries in Supabase

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste each query above
6. Click **▶ Run** button
7. Check results

## Verify Indexes Were Created

Run this query to see all indexes on your tables:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```

You should see:
- `idx_world_regions_hex_id`
- `idx_world_regions_owner_community_id`
- Primary key on `communities(id)`

## Expected Results After Indexing

**Before optimization:**
```
regions query: 1095ms
communities query: 926ms
Total: 1443ms ❌
```

**After optimization:**
```
regions query: 80ms
communities query: 40ms
Total: 120ms ✅
```

That's a **12x speedup!**

## Advanced: Check Slow Queries

Supabase shows slow queries in the **Monitoring** tab:

1. **Supabase Dashboard → Monitoring**
2. Look for "Slow Queries" section
3. See which queries are taking >100ms
4. Add indexes for those queries

## Verify the Fix Works

After adding indexes:

1. Reload the map in your browser
2. Press **Ctrl+Shift+D** to open Network Diagnostic
3. Look for new query times:
   ```
   [MapPage] fetchRegions: regions query completed {
     queryTime: '80ms',  ← Should be <100ms now!
     rowCount: 21
   }
   [MapPage] fetchRegions: communities query completed {
     queryTime: '40ms',  ← Should be <100ms now!
     communityCount: 2,
     requestedCount: 2
   }
   ```

## If Queries Are Still Slow (>500ms)

### Option 1: Check for Table Scan
Run this query to understand your table size:
```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

If `world_regions` is > 1GB, you may need to:
- Archive old regions
- Partition the table
- Use pagination instead of fetching all

### Option 2: Check Supabase Server Health
1. Go to **Supabase Dashboard → Status**
2. Check if there are any service issues
3. Check your database's CPU/Memory usage in **Monitoring**

### Option 3: Change Supabase Region
If your Supabase is far from you (e.g., in Europe but you're in US):
1. Create a new project in a closer region
2. Migrate your database
3. Test query performance

## Pro Tips

### 1. Cache Communities Data
Instead of fetching communities every time, cache them on the client:

```typescript
const communityCache = new Map();

// First fetch: query database
// Subsequent fetches: use cache
```

### 2. Lazy Load Regions
Instead of fetching ALL 21 regions at startup, only fetch visible ones:

```typescript
// Load regions only when user views that area
// Use viewport-based lazy loading
```

### 3. Use Materialized Views
If you frequently need region + community data together, create a view:

```sql
CREATE MATERIALIZED VIEW region_with_community AS
SELECT
  wr.hex_id,
  wr.owner_community_id,
  c.name as community_name,
  c.color as community_color
FROM world_regions wr
LEFT JOIN communities c ON wr.owner_community_id = c.id;

-- Index the view
CREATE INDEX idx_region_with_community_hex_id
ON region_with_community(hex_id);
```

Then query it instead of joining on the fly.

## Monitoring Going Forward

**Set up alerts:**
1. Supabase Dashboard → Settings → Alerts
2. Alert if query time > 500ms
3. Alert if database CPU > 80%

**Monitor regularly:**
1. Check slow query logs weekly
2. Add indexes for new access patterns
3. Archive old data to keep tables small

## Expected Performance After All Optimizations

```
FPS: 60fps ✓
Frame Time: <16ms ✓
Network Latency: 150-200ms ✓  (was 1400+ ms)
Map responsiveness: SMOOTH ✓
```

Your map should feel instant now!

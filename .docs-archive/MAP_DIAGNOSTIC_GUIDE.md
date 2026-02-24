# Map Latency Diagnostic Guide

## Quick Start: Finding Where the Latency Comes From

You now have **3 tools** to diagnose the exact bottleneck:

### 1. **Performance Overlay** (Ctrl+P)
Shows real-time stats in bottom-right:
- **FPS**: Should be 60
- **Frame Time**: Should be <16.67ms
- **Network Latency**: Shows average request time
- **Memory**: JS heap usage

### 2. **Network Diagnostic** (Ctrl+Shift+D)
Shows detailed request logs in top-right with timestamps:
- When each network request starts
- When it completes
- How long it took
- Query breakdown (regions vs communities)

### 3. **Browser DevTools** (F12)
Use Network tab to see HTTP requests:
- Click on a Supabase API call
- Look at "Timing" tab
- See DNS lookup, connection, wait time (TTFB), download time

---

## Step-by-Step Diagnosis

### Step 1: Check Performance Overlay
Press **Ctrl+P** on the map and look at:

**Example: Good Performance**
```
FPS: 60.0 ✓
Frame: 16.5ms ✓
Network: 0 pending
Avg latency: 180ms
```

**Example: Bad Performance**
```
FPS: 60.0 ✓
Frame: 16.5ms ✓
Network: 0 pending
Avg latency: 5243ms ← PROBLEM HERE
```

If `Avg latency` is HIGH, it's a network issue (Supabase, not rendering).

---

### Step 2: Check Network Diagnostic
Press **Ctrl+Shift+D** to see detailed logs like:

```
[01:47:15] [MapPage] fetchRegions: Starting request
[01:47:15] [MapPage] fetchRegions: Query breakdown
  regionsQueryMs: 450ms
  communitiesQueryMs: 50ms
  totalBreakdown: regions(450ms) + communities(50ms)
[01:47:15] [MapPage] fetchRegions: Completed
  elapsed: 500ms
  rowCount: 4892
```

**Interpret the breakdown:**
- If `regionsQueryMs` is HIGH (>1000ms) → **Database query is slow**
- If `communitiesQueryMs` is HIGH (>500ms) → **Database query is slow**
- If both are LOW but `elapsed` is HIGH → **Network latency or dev server issue**

---

### Step 3: Check Browser Network Tab
Open **F12 → Network tab** and reload the map:

1. Look for **supabase** API calls (GraphQL or REST)
2. Click on each request
3. Look at the **Timing** tab:

```
DNS Lookup:     10ms   ← Should be <50ms
Connection:     20ms   ← Should be <100ms
TLS/SSL:        15ms   ← Should be <100ms
Wait (TTFB):  5000ms   ← ← ← THIS IS THE PROBLEM if high!
Download:       50ms   ← Should be <100ms
```

**What each means:**
- **DNS/Connection high** = Network/ISP issue (not our code)
- **Wait (TTFB) high** = Database query is slow (Supabase problem)
- **Download high** = Too much data being sent (we already fixed this)

---

## Decision Tree: Where's the Bottleneck?

```
Is Avg Latency > 1000ms?
│
├─ YES
│  │
│  └─ Open Network Diagnostic (Ctrl+Shift+D)
│     │
│     ├─ regionsQueryMs HIGH (>500ms)?
│     │  └─ YES → Database is slow (Supabase issue)
│     │           → Check if world_regions table needs index
│     │           → Check if communities join was slow
│     │
│     └─ All queryMs LOW but elapsed HIGH?
│        └─ Open DevTools Network tab (F12)
│           │
│           ├─ Wait (TTFB) > 2000ms?
│           │  └─ YES → Supabase server is overloaded
│           │           → Check Supabase dashboard
│           │
│           └─ Wait (TTFB) < 500ms but Total > 2000ms?
│              └─ DevTools says query is fast but elapsed shows slow?
│                 → Dev server hot-reload lag (not our code)
│
└─ NO (Avg Latency < 500ms)
   └─ Everything is working correctly!
      └─ If map still feels laggy, check:
         - Is FPS staying at 60?
         - Are you on a slow network?
         - Is background data processing blocking?
```

---

## Common Scenarios & Solutions

### Scenario 1: regionsQueryMs = 4500ms
**Problem**: Fetching all regions takes too long
**Causes**:
- Table is huge (millions of rows)
- Missing database index on hex_id
- Supabase server is slow

**Solutions**:
- Check world_regions table size: `SELECT COUNT(*) FROM world_regions`
- Check if there's an index: `SELECT * FROM pg_indexes WHERE tablename='world_regions'`
- Add index if missing: `CREATE INDEX idx_hex_id ON world_regions(hex_id)`
- If >10,000 rows and still slow, paginate instead of fetching all

### Scenario 2: communitiesQueryMs = 2000ms
**Problem**: Fetching communities takes too long
**Causes**:
- Too many unique communities to fetch
- Missing index on communities.id
- Supabase server overloaded

**Solutions**:
- Check how many communities exist
- Make sure communities table has primary key index
- Consider caching communities data on client

### Scenario 3: All queryMs are FINE but overall elapsed is HIGH
**Problem**: Dev server hot-reload lag
**Causes**:
- You modified a file and dev server is recompiling
- Request got queued during rebuild
- Nothing wrong with our code

**Solutions**:
- Wait for Fast Refresh to finish (see console)
- Reload the page (Cmd+R / Ctrl+R)
- Don't make changes while testing performance

### Scenario 4: Wait (TTFB) = 5000ms in DevTools
**Problem**: Supabase server is slow
**Causes**:
- Database query is taking too long
- Supabase is processing a heavy query
- Too many concurrent requests

**Solutions**:
- Check Supabase dashboard for slow queries
- Look at Postgres logs
- Check how many regions/communities you're fetching
- Consider changing your Supabase region to be closer to you

---

## What to Report

If you find an issue, here's what to tell me:

**Good Report:**
```
Issue: Map taking 5+ seconds to load
Evidence:
- Ctrl+P shows Avg latency: 5243ms
- Ctrl+Shift+D shows: regionsQueryMs: 4800ms
- DevTools shows: Wait time 4800ms

Browser: Chrome on Mac
Location: East Coast US
Supabase Region: us-east-1
```

**How to gather this info:**
1. Press Ctrl+P and take a screenshot
2. Press Ctrl+Shift+D and screenshot the logs
3. Open F12 → Network → reload → find Supabase request → screenshot Timing tab
4. Tell me your location and Supabase region

---

## Next Steps Based on Findings

### If it's a Database Query Problem (regionsQueryMs HIGH):
- [ ] Check table sizes
- [ ] Add missing indexes
- [ ] Consider pagination
- [ ] Profile the query in Supabase dashboard

### If it's a Network Problem (TTFB HIGH in DevTools):
- [ ] Check your internet connection speed
- [ ] Change Supabase region if available
- [ ] Check if Supabase is having issues

### If it's a Dev Server Problem (all metrics low but feels slow):
- [ ] Just reload the page
- [ ] The performance is good, dev server is just rebuilding

---

## Pro Tips

**Disable logging to speed up dev server:**
- Comment out the `debug()` calls if they're slowing things down
- Use devtools Performance tab to profile

**Use Browser DevTools Network Tab Effectively:**
- Filter for "supabase" to see just API calls
- Sort by "Time" to see slowest requests
- Click "Timing" tab on individual requests
- Export HAR file for detailed analysis

**Monitor Supabase Dashboard:**
- Go to Supabase Console → Database → Monitoring
- Look for slow queries
- Check CPU/memory usage
- Check active connections

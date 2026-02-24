# Map Performance Debug - Quick Start

## Enabling Performance Monitoring

**Press `Ctrl+P` while on the map to toggle the performance overlay.**

You'll see a debug panel in the bottom-right corner showing:

```
Performance Debug (Ctrl+P to toggle)
FPS: 58.2 ✓
Frame: 17.34ms ✗
Memory: 145.3MB
Network: 2 pending
Avg latency: 230ms
Total requests: 156

Recent latencies (ms):
245  198  312  201  187  220  198  205  198
```

## What Each Metric Means

### FPS (Frames Per Second)
- **Green (>50)**: Perfect, no issues
- **Yellow (30-50)**: Noticeable lag, monitor further
- **Red (<30)**: Significant lag, investigate

### Frame Time
- **Good**: ≤16.67ms (allows 60fps)
- **Warning**: 16.67-33ms (30-60fps)
- **Bad**: >33ms (stuttering, below 30fps)

### Memory
- Monitor for leaks (constantly increasing)
- Healthy range: 100-300MB for the app

### Network Section
- **pending**: How many requests are waiting for response
- **avg latency**: Average response time (should be <300ms)
- **total requests**: Total made since page load

### Recent Latencies
Last 10 network request times. Look for:
- **Consistent timing**: Normal
- **Spikes**: Backend slowness
- **Many high values**: Supabase query optimization needed

## Debugging Scenarios

### Scenario 1: Low FPS + High Frame Time
**Problem**: Rendering/GPU bottleneck
- Check if network latency is normal (it usually is)
- If FPS is low and frame time high, it's the GPU
- **Solution**: Reduce layer complexity, zoom level, or 3D mode

### Scenario 2: High Network Latency
**Problem**: Backend is slow
- Look at "Avg latency" (should be <300ms)
- Check "Recent latencies" - are they spiking?
- **Solution**:
  - Check Supabase query performance
  - Reduce database index usage
  - Check internet connection

### Scenario 3: Many Pending Requests
**Problem**: Requests are piling up
- "pending" should usually be 0-1
- If it's 5+, backend can't keep up
- **Solution**:
  - Check Supabase load
  - Look at server logs
  - Reduce number of concurrent updates

### Scenario 4: Map Feels Sluggish But Metrics Look Good
**Problem**: Likely a React state update issue
- Check browser DevTools Profiler
- Look for unexpected re-renders
- Use React DevTools to profile components

## How To Read The Data

### Network Request Flow Example
1. User clicks on a hex
2. Map fetches region data → latency ~150ms
3. You see a "150" in recent latencies
4. Avg latency updates to include this value

### Healthy Pattern
```
FPS: 60.0 ✓           <- Consistent
Frame: 16.5ms ✓       <- Stable
Memory: 150.2MB       <- Steady
Network: 0 pending    <- No backlog
Avg latency: 180ms    <- Reasonable
Recent: 175 182 179 185 177...  <- Consistent
```

### Problem Pattern
```
FPS: 25.3 ✗           <- Dropping
Frame: 42.1ms ✗       <- High variance
Memory: 520.1MB       <- Growing!
Network: 8 pending    <- Backed up!
Avg latency: 890ms    <- Very slow!
Recent: 340 892 120 1200 450...  <- Spiky!
```

## Testing Checklist

When you notice lag:

- [ ] Press Ctrl+P to enable overlay
- [ ] Look at FPS - is it staying at 60?
- [ ] Look at Frame Time - is it under 16.67ms?
- [ ] Check Network pending - is it 0-1?
- [ ] Check Avg latency - is it under 300ms?
- [ ] Monitor for 10 seconds to see patterns
- [ ] If FPS is good but feels laggy, check DevTools

## Advanced: Understanding Batching

The map now batches multiple region changes:

**Before (bad):**
```
Region A changed → Fetch A → 150ms
Region B changed → Fetch B → 150ms
Region C changed → Fetch C → 150ms
Total: 450ms (sequential)
```

**After (good):**
```
Region A changed → Queue
Region B changed → Queue
Region C changed → Queue
100ms debounce → Fetch A,B,C → 180ms
Total: 180ms (batched)
```

You'll see this as fewer network spikes in the latency display.

## Need More Details?

See `MAP_LAG_FIX_SUMMARY.md` for:
- Full technical explanation
- What was changed and why
- Performance impact metrics
- Troubleshooting guide

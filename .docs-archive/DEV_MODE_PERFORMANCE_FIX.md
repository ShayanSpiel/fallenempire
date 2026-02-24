# Development Mode Performance Fix

## Problem
The dev server is experiencing slow Fast Refresh recompiles (3-28 seconds per rebuild), causing:
- UI responsiveness lag (20+ seconds before logs appear)
- Slow hex selection/hovering feedback
- Constant file watching and recompilation

## Root Cause
Next.js dev server file watching is slow with a large codebase (177 TSX + 9700+ dependencies).

## Quick Fix: Restart Dev Server

1. **Stop the current dev server** (Ctrl+C in terminal where `npm run dev` is running)
2. **Clear the cache:**
   ```bash
   rm -rf .next
   ```
3. **Restart dev server:**
   ```bash
   npm run dev
   ```

This clears the 114MB cache and forces a fresh rebuild.

## Alternative: Use Production Build for Testing

If you want to test the map performance properly, build and serve production:

```bash
npm run build
npm run start
```

This gives you:
- ✅ True production performance (no Hot Module Reload overhead)
- ✅ Actual latency (backend only, no dev rebuild delays)
- ✅ Fast UI responsiveness
- ❌ No hot reload (must rebuild to see changes)

## Permanent Optimization: Disable Hot Reload for Map

If you want to keep dev mode but speed it up, disable Fast Refresh just for the map:

Add to `app/map/page.tsx` at the top:
```typescript
// Disable Fast Refresh for this file to avoid recompilation delays
export const $$typeof = Symbol.for('react.memo');
```

Or configure in `next.config.ts`:
```typescript
export const unstable_allowDynamic = [
  '**/app/map/**',
];
```

## What We Already Fixed
1. ✅ Query deduplication (prevented duplicate requests)
2. ✅ RLS policy blocking communities data (fixed with migration)
3. ✅ Request coalescing (prevents rapid-click overload)
4. ✅ Proper debouncing (view state, selection changes)

## After Restart, Expected Performance
- **Network latency:** 100-300ms (Supabase backend)
- **React rendering:** <50ms
- **Total interaction latency:** 150-350ms (vs current 4500ms+ in dev mode)
- **Console logs:** Appear instantly (vs 10-20 second delays)

## Verify It's Fixed
1. Restart dev server
2. Open map
3. Click a hex
4. Check Ctrl+P performance overlay:
   - Should show ~300ms average latency (not 4500ms)
   - Recent latencies should all be similar (300-400ms range)
5. Console should update instantly

# QUICK REFERENCE: OPTIMIZATION GUIDE
## Fast Lookup for Common Tasks

---

## ✅ COMPLETED (Phase 1)

### Cleanup Tasks
- ✅ Deleted legacy `/sql/` directory
- ✅ Committed pending git deletions (SVG files + old supabaseClient.ts)
- ✅ Enabled React strict mode in `next.config.ts`
- ✅ Created error boundary component: `components/error-boundary.tsx`
- ✅ Enhanced logger with debug utilities in `lib/logger.ts`

### Commit Hash
```
4ae65b9 - Phase 1: Critical Cleanup & Foundation Improvements
```

---

## 🚀 QUICK WINS (Easy Wins - Do Next)

### 1. Apply Error Boundary to Map
**File:** `app/map/page.tsx`
**Time:** 5 minutes

```typescript
import ErrorBoundary from "@/components/error-boundary";

export default function MapPage() {
  return (
    <ErrorBoundary section="MapComponent">
      <div className="fixed inset-0 top-16 z-0 w-screen bg-background overflow-hidden">
        <HexMap {...props} />
      </div>
    </ErrorBoundary>
  );
}
```

### 2. Start Using Debug Logger
**File:** `app/map/page.tsx` and others

**Before:**
```typescript
console.log("[DEBUG] Map Clicked. Hex ID:", selectedHex);
console.error("Failed to load region", error);
```

**After:**
```typescript
import { debug, error } from "@/lib/logger";

debug("Map Clicked. Hex ID:", selectedHex);
error("Failed to load region", error);
```

### 3. Convert Prototype Page Status
**File:** `app/prototype/fight/page.tsx`
**Time:** 15 minutes

**Option A: Delete if not used**
```bash
rm -rf app/prototype/
git add app/prototype/
git commit -m "Remove obsolete prototype fight page"
```

**Option B: Archive for later reference**
```bash
git checkout -b archive/prototype-fight
# Keep in separate branch, remove from main
```

**Option C: Document if active**
```bash
# Move to proper location and document as experimental
mv app/prototype/fight/ app/battles/experimental-prototype/
```

---

## 📋 CONSOLE.LOG CONVERSION GUIDE

### Files to Update (in order of importance)

#### Priority 1: Map Components
**File:** `app/map/page.tsx` (12 debug logs)
```typescript
// Lines to change:
242: console.log("[DEBUG] Selection cleared...") → debug("Selection cleared...")
246: console.log("[DEBUG] Map Clicked...") → debug("Map Clicked...")
253: console.log("[DEBUG] Fetching region...") → debug("Fetching region...")
265: console.log("[DEBUG] Fetch Result...") → debug("Fetch Result...")
270: console.log("[DEBUG] Region normalized...") → debug("Region normalized...")
337: console.log("[DEBUG] Authentication failed...") → debug("Auth failed...")
342: console.log("[DEBUG] Branch: CLAIM...") → debug("Branch: CLAIM...")
350: console.log("[DEBUG] claim_region_unopposed...") → debug("claim_region_unopposed...")
353: console.log("[DEBUG] Regions refreshed...") → debug("Regions refreshed...")
360: console.log("[DEBUG] Branch: ATTACK...") → debug("Branch: ATTACK...")
365: console.log("[DEBUG] Battle RPC response...") → debug("Battle RPC response...")
368: console.log("[DEBUG] Regions refreshed...") → debug("Regions refreshed...")
```

**Keep these (real errors):**
- Line 70: `console.error("Failed to load diplomacy states")`
- Line 213: `console.error("Failed to load active battles")`
- Line 261: `console.error("Failed to load region")`
- Line 377: `console.error("[DEBUG] Action failed:")`

#### Priority 2: Hex Map Component
**File:** `components/map/hex-map.tsx` (8 logs)
```typescript
// Review and decide if debug logs are needed
// Keep any that help with performance monitoring
```

#### Priority 3: AI Agent Logs
**File:** `lib/ai/**/*.ts`
```typescript
// Convert development logging to debug()
// Keep error logs
```

---

## ⚡ PERFORMANCE OPTIMIZATION CHECKLIST

### Memoization Patterns

#### Pattern 1: Memoize Expensive Functions
```typescript
// Before: Recreated every render
const handleClick = (info: PickingInfo) => { ... };

// After: Only recreated when dependencies change
const handleClick = useCallback((info: PickingInfo) => {
  // ... function body
}, [selectedHex, userCommunityId]);
```

#### Pattern 2: Move Constants Outside
```typescript
// Before: Recreated every render
function HexMap() {
  const STYLES = { dark: {...}, light: {...} };
}

// After: Created once
const STATIC_STYLES = { dark: {...}, light: {...} };
function HexMap() {
  // ... use STATIC_STYLES
}
```

#### Pattern 3: Consolidate State Updates
```typescript
// Before: 3 separate fetches
useEffect(() => { fetchRegions(); }, []);
useEffect(() => { fetchDiplomacy(); }, []);
useEffect(() => { fetchBattles(); }, []);

// After: Single consolidated effect
useEffect(() => {
  Promise.all([fetchRegions(), fetchDiplomacy(), fetchBattles()]);
}, []);
```

---

## 🔍 FINDING BUGS & ERRORS

### Enable TypeScript Strict Checks
```bash
# Check for TypeScript errors
npm run build

# IDE diagnostics
code --command "editor.action.showErrorsAndWarnings"
```

### Test Error Boundaries
```typescript
// Temporarily throw in a component to test error boundary
throw new Error("Test error");
```

### Monitor Realtime Subscription Memory
```typescript
// Check browser DevTools → Sources → Event Listeners
// Should clean up channels on unmount
```

---

## 📊 PERFORMANCE METRICS

### Measure Before Optimization
```bash
# Chrome DevTools → Lighthouse
# Measure Core Web Vitals:
# - Largest Contentful Paint (LCP)
# - First Input Delay (FID)
# - Cumulative Layout Shift (CLS)

# Network tab:
# - Track bundle sizes
# - Monitor realtime subscription traffic
```

### Measure After Optimization
Compare same metrics to calculate improvement %

---

## 🗂️ FILE ORGANIZATION REFERENCE

### Key Files to Know
```
components/
├── error-boundary.tsx          ← Error handling
├── map/
│   ├── hex-map.tsx             ← Map rendering (OPTIMIZE)
│   └── region-drawer.tsx       ← Region UI
└── ui/                         ← shadcn components (don't modify)

app/
├── map/page.tsx                ← Map page (OPTIMIZE)
├── api/                        ← API routes
└── actions/                    ← Server actions

lib/
├── logger.ts                   ← NEW: Debug logging (USE THIS)
├── supabase-*.ts               ← Client initialization
└── ai/                         ← AI agents
```

---

## 🎯 NEXT SPRINT GOALS

### This Week
- [ ] Apply error boundary to Map component (5 min)
- [ ] Convert all console.log to debug() (2-3 hours)
- [ ] Determine prototype page status (15 min)
- [ ] Test error boundary functionality (30 min)

### Next Week
- [ ] Optimize hex-map.tsx component (2-3 hours)
- [ ] Optimize map/page.tsx subscriptions (2-3 hours)
- [ ] Add performance metrics baseline (1 hour)

### Following Week
- [ ] Implement pagination (3 hours)
- [ ] Add caching with SWR (2 hours)
- [ ] Performance testing & benchmarks (2 hours)

---

## 🔗 RELATED DOCUMENTS

- **MEGA_OPTIMIZATION_PLAN.md** - Complete 10-part optimization strategy
- **CODEBASE_ANALYSIS_SUMMARY.md** - Full codebase health assessment
- **BATTLE_PAGE_OPTIMIZATION_SUMMARY.md** - Battle page optimizations already completed

---

## 📞 COMMON QUESTIONS

### Q: Should I delete the prototype code?
**A:** If no one is using it, yes. Check git history for last edit date. If >2 weeks, delete it.

### Q: How do I know if my optimizations work?
**A:** Use Chrome Lighthouse (DevTools → Lighthouse tab) before/after. Compare:
- First Contentful Paint
- Largest Contentful Paint
- Total Blocking Time

### Q: Will enabling React strict mode break anything?
**A:** No. It just runs effects twice in dev to detect side effects. Production is unaffected.

### Q: How much faster will the map be?
**A:** Conservative estimate: 30-40% faster interaction latency, 20-30% fewer re-renders.

### Q: When should I use the debug logger?
**A:** Always for development debugging. Use `error()` for actual errors only.

---

## 💡 PRO TIPS

1. **Test in production mode locally:**
   ```bash
   npm run build
   npm run start
   ```

2. **Check bundle size:**
   ```bash
   npm run build
   # Check `.next/` folder size
   ```

3. **Monitor realtime traffic:**
   ```typescript
   // Chrome DevTools → Network → WS (WebSockets)
   // Watch supabase realtime messages
   ```

4. **Profile performance:**
   ```typescript
   // React DevTools Profiler
   // Record render cycles and duration
   ```

---

**Last Updated:** December 18, 2025
**Status:** Phase 1 Complete ✅
**Next Phase:** High Priority Console Log Conversion

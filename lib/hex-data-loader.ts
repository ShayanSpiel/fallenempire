/**
 * Optimized hex data loader
 * Lazy loads large hex data files to avoid blocking initial page load
 * Implements progressive enhancement and caching
 */

type HexData = Record<string, any>;

let hexDataCache: HexData | null = null;
let hexDataPromise: Promise<HexData> | null = null;

/**
 * Load hex data lazily (on-demand, not at module load)
 * Returns cached data if already loaded
 */
export async function getHexData(): Promise<HexData> {
  // Return cached data if available
  if (hexDataCache) {
    return hexDataCache;
  }

  // Return existing promise if load is already in progress
  if (hexDataPromise) {
    return hexDataPromise;
  }

  // Start loading and cache the promise to prevent duplicate requests
  hexDataPromise = loadHexData();
  hexDataCache = await hexDataPromise;

  return hexDataCache;
}

/**
 * Load hex data from JSON file (dynamic import for code splitting)
 */
async function loadHexData(): Promise<HexData> {
  try {
    // Dynamic import - only loaded when needed
    const module = await import('@/public/data/world-hexes-board.json');
    return module.default as HexData;
  } catch (error) {
    console.error('Failed to load hex data:', error);
    // Fallback to empty object to prevent crashes
    return {};
  }
}

/**
 * Get hex data for a specific region (subset loading for better performance)
 * Returns cached full data since region filtering is cheap
 */
export async function getHexDataForRegion(regionBounds: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}): Promise<HexData> {
  const fullData = await getHexData();

  // Filter locally to avoid backend roundtrip
  const filtered: HexData = {};
  for (const [key, hex] of Object.entries(fullData)) {
    const [x, y] = key.split(',').map(Number);
    if (
      x >= regionBounds.minX &&
      x <= regionBounds.maxX &&
      y >= regionBounds.minY &&
      y <= regionBounds.maxY
    ) {
      filtered[key] = hex;
    }
  }

  return filtered;
}

/**
 * Preload hex data in background (call from layout or route)
 * Non-blocking, improves perceived performance
 */
export function preloadHexData(): void {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback to load when browser is idle
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => getHexData().catch(() => {}));
    } else {
      // Fallback: setTimeout with low priority
      setTimeout(() => getHexData().catch(() => {}), 2000);
    }
  }
}

/**
 * Clear hex data cache (useful after significant map changes)
 */
export function clearHexDataCache(): void {
  hexDataCache = null;
  hexDataPromise = null;
}

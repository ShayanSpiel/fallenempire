'use client';

/**
 * Optimized hex data loader
 * Lazy loads large hex data files to avoid blocking initial page load
 */

let hexDataCache: Record<string, any> | null = null;
let hexDataPromise: Promise<Record<string, any>> | null = null;

/**
 * Preload hex data in background (call from layout or route)
 * Non-blocking, improves perceived performance
 */
export function preloadHexData(): void {
  if (typeof window === 'undefined') return;

  // Use requestIdleCallback to load when browser is idle
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      // Preload by fetching from public static files
      fetch('/data/world-hexes-board.json').catch(() => {});
    });
  }
}

/**
 * Get hex data (cached)
 */
export async function getHexData(): Promise<Record<string, any>> {
  if (hexDataCache) {
    return hexDataCache;
  }

  if (hexDataPromise) {
    return hexDataPromise;
  }

  hexDataPromise = fetch('/data/world-hexes-board.json')
    .then(r => r.json())
    .catch(() => ({}));

  hexDataCache = await hexDataPromise;
  return hexDataCache;
}

/**
 * Clear hex data cache
 */
export function clearHexDataCache(): void {
  hexDataCache = null;
  hexDataPromise = null;
}

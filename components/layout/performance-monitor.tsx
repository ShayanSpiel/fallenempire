'use client';

import { useEffect } from 'react';
import { initWebVitalsTracking, initLongTaskTracking } from '@/lib/web-vitals';
import { preloadHexData } from '@/lib/hex-data-loader';

/**
 * Performance Monitoring Component
 * Initializes Web Vitals tracking and preloads data
 * Should be placed near root of app
 */
export function PerformanceMonitor() {
  useEffect(() => {
    // Initialize Web Vitals tracking
    initWebVitalsTracking();

    // Initialize long task tracking (dev only)
    initLongTaskTracking();

    // Preload hex data in background (non-blocking)
    preloadHexData();
  }, []);

  // Invisible component - just initializes tracking
  return null;
}

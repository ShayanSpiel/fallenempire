'use client';

import { useEffect } from 'react';
import { initWebVitalsTracking } from '@/lib/web-vitals';
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

    // Preload hex data in background (non-blocking)
    preloadHexData();
  }, []);

  // Invisible component - just initializes tracking
  return null;
}

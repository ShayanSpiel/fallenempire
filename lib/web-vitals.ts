'use client';

/**
 * Web Vitals Monitoring
 * Tracks Core Web Vitals and sends to analytics
 */

export interface WebVitals {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

/**
 * Report Web Vital metric to analytics/console
 */
export function reportWebVital(metric: WebVitals) {
  // Log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`);
  }

  // Send to analytics endpoint (optional)
  if (typeof window !== 'undefined' && 'navigator' in window) {
    const body = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Use sendBeacon for reliability (won't be blocked by navigations)
    navigator.sendBeacon('/api/analytics/web-vitals', JSON.stringify(body));
  }
}

/**
 * Track Core Web Vitals using native browser APIs
 */
export function initWebVitalsTracking() {
  if (typeof window === 'undefined') return;

  // Track Cumulative Layout Shift (CLS)
  if ('PerformanceObserver' in window) {
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ('hadRecentInput' in entry && !(entry as any).hadRecentInput) {
            const clsValue = (entry as any).value;
            reportWebVital({
              name: 'CLS',
              value: clsValue,
              rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
              delta: clsValue,
              id: `cls-${Date.now()}`,
              navigationType: 'navigation',
            });
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // CLS not supported
    }

    // Track Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          const lastEntry = entries[entries.length - 1];
          const lcpValue = (lastEntry as any).renderTime || (lastEntry as any).loadTime;
          if (lcpValue) {
            reportWebVital({
              name: 'LCP',
              value: lcpValue,
              rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor',
              delta: lcpValue,
              id: `lcp-${Date.now()}`,
              navigationType: 'navigation',
            });
          }
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP not supported
    }

    // Track First Input Delay (FID) / Interaction to Next Paint (INP)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidValue = (entry as any).processingDuration;
          if (fidValue) {
            reportWebVital({
              name: entry.name === 'first-input' ? 'FID' : 'INP',
              value: fidValue,
              rating: fidValue <= 100 ? 'good' : fidValue <= 300 ? 'needs-improvement' : 'poor',
              delta: fidValue,
              id: `${entry.name}-${Date.now()}`,
              navigationType: 'navigation',
            });
          }
        }
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
      fidObserver.observe({ type: 'event', buffered: true });
    } catch (e) {
      // FID/INP not supported
    }
  }
}

/**
 * Measure custom metric
 */
export function measureCustomMetric(name: string, duration: number) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Custom Metric] ${name}: ${duration.toFixed(2)}ms`);
  }
}

/**
 * Performance observer for long tasks
 */
export function initLongTaskTracking() {
  if (typeof window === 'undefined') return;
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Long Task] ${entry.name}: ${entry.duration.toFixed(2)}ms`);
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    // Long task observation not supported
  }
}

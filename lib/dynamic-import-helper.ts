'use client';

/**
 * Helper for optimized dynamic imports with automatic loading states
 * Used for code splitting large components
 */

import dynamic from 'next/dynamic';
import { ComponentType, ReactNode } from 'react';

/**
 * Loading skeleton component
 */
function LoadingFallback() {
  return (
    <div className="animate-pulse bg-muted rounded-lg h-64 w-full" />
  );
}

/**
 * Create a dynamically imported component with loading state
 */
export function createDynamicComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options?: {
    showSkeleton?: boolean;
    timeout?: number;
  }
) {
  return dynamic(importFn, {
    loading: () => options?.showSkeleton ? <LoadingFallback /> : null,
    ssr: true,
  });
}

/**
 * Pre-load a component bundle (useful for anticipated navigation)
 */
export async function preloadComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>
) {
  try {
    await importFn();
  } catch (error) {
    console.error('Preload failed:', error);
  }
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * Custom hook for managing intervals with automatic cleanup
 * Replaces setInterval with proper React lifecycle management
 */
export function useInterval(callback: () => void, delayMs: number | null) {
  const savedCallback = useRef<() => void>();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;

    const id = setInterval(() => savedCallback.current?.(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}

/**
 * Reusable Skeleton Components for Market
 * Provides consistent loading states across all market tabs
 */

import { Skeleton } from "@/components/ui/skeleton";
import { SKELETON_CONFIG, MARKET_TABLE_CONFIG, MARKET_FILTER_CONFIG } from "./market-config";

// ============================================================================
// TABLE SKELETON
// ============================================================================

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({
  rows = SKELETON_CONFIG.table.defaultRows,
  columns = SKELETON_CONFIG.table.columns,
}: TableSkeletonProps) {
  return (
    <div className={MARKET_TABLE_CONFIG.container}>
      <div className={MARKET_TABLE_CONFIG.headerRow + " px-4 py-3"}>
        <div className={`grid grid-cols-${columns} gap-4`}>
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`header-${i}`} className="h-4 w-full" />
          ))}
        </div>
      </div>
      <div className={MARKET_TABLE_CONFIG.divider}>
        {Array.from({ length: rows }).map((_, row) => (
          <div key={`row-${row}`} className={`grid grid-cols-${columns} gap-4 px-4 py-3`}>
            {Array.from({ length: columns }).map((_, col) => (
              <Skeleton key={`cell-${row}-${col}`} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MARKET FILTERS SKELETON
// ============================================================================

export function MarketFiltersSkeleton() {
  return (
    <div className={MARKET_FILTER_CONFIG.container}>
      {/* Resource Type Filter */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: SKELETON_CONFIG.filters.chipCount }).map((_, i) => (
            <Skeleton key={`chip-${i}`} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Quality Filter */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <div className="flex items-center gap-2">
          {Array.from({ length: SKELETON_CONFIG.filters.starCount }).map((_, i) => (
            <Skeleton key={`star-${i}`} className="h-5 w-5 rounded" />
          ))}
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXCHANGE TAB SKELETON
// ============================================================================

export function ExchangeTabSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      {/* Order Book Skeleton */}
      <div className="border border-border/60 rounded-xl h-[600px] flex flex-col">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64 mt-1" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
      {/* Exchange Form Skeleton */}
      <div className="border border-border/60 rounded-xl h-[600px] flex flex-col">
        <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48 mt-1" />
        </div>
        <div className="p-4 space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-10 rounded-full mx-auto" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-2 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// COMPACT LOADING SPINNER
// ============================================================================

export function CompactLoader() {
  return (
    <div className="h-20 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-transparent" />
    </div>
  );
}

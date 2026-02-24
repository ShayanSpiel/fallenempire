"use client";

import React from "react";
import { getUserCommunityId, getUserInventory } from "@/app/actions/economy";
import type { InventoryByCategory } from "@/lib/types/economy";
import { PageSection } from "@/components/layout/page-section";
import { InventoryGrid } from "./inventory-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { H1, P } from "@/components/ui/typography";

interface InventoryPageClientProps {
  userId: string;
}

function InventoryGridSkeleton() {
  return (
    <div className="space-y-8">
      {/* Category 1 skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center p-3 rounded-lg border border-border bg-card"
            >
              {/* Icon skeleton */}
              <Skeleton className="w-16 h-16 mb-2 rounded-lg" />
              {/* Name skeleton */}
              <Skeleton className="h-4 w-20 mb-2" />
              {/* Stars skeleton */}
              <div className="flex items-center gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="w-3 h-3 rounded-full" />
                ))}
              </div>
              {/* Quality name skeleton */}
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Category 2 skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center p-3 rounded-lg border border-border bg-card"
            >
              <Skeleton className="w-16 h-16 mb-2 rounded-lg" />
              <Skeleton className="h-4 w-20 mb-2" />
              <div className="flex items-center gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Skeleton key={j} className="w-3 h-3 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function InventoryPageClient({ userId }: InventoryPageClientProps) {
  const [inventory, setInventory] = React.useState<InventoryByCategory[] | null>(null);
  const [communityId, setCommunityId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function fetchInventory() {
      try {
        setIsLoading(true);
        setError(null);
        const [inventoryResult, communityResult] = await Promise.allSettled([
          getUserInventory(userId),
          getUserCommunityId(),
        ]);

        if (!mounted) return;

        if (inventoryResult.status === "fulfilled") {
          setInventory(inventoryResult.value);
        } else {
          setError("Failed to load inventory. Please try again.");
        }

        if (communityResult.status === "fulfilled") {
          setCommunityId(communityResult.value ?? null);
        }
      } catch (err) {
        console.error("Error fetching inventory:", err);
        if (mounted) {
          setError("Failed to load inventory. Please try again.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchInventory();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <PageSection>
      <div className="space-y-8">
        <div className="space-y-2">
          <H1>Inventory</H1>
          <P className="max-w-2xl font-medium">
            Your personal raw materials and products.
          </P>
        </div>

        {isLoading && <InventoryGridSkeleton />}

        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-semibold text-destructive">{error}</p>
            <Button
              onClick={() => window.location.reload()}
              variant="link"
              size="sm"
              className="mt-4"
            >
              Reload page
            </Button>
          </div>
        )}

        {!isLoading && !error && inventory && (
          <InventoryGrid inventory={inventory} communityId={communityId} />
        )}
      </div>
    </PageSection>
  );
}

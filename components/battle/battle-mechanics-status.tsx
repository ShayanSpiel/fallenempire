"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeading } from "@/components/ui/section-heading";
import { Shield } from "lucide-react";
import { DisarrayLiquidIndicator } from "./disarray-liquid-indicator";
import { ExhaustionLiquidIndicator } from "./exhaustion-liquid-indicator";
import { RageLiquidIndicator } from "./rage-liquid-indicator";
import { cn } from "@/lib/utils";

interface BattleMechanicsStatusProps {
  /**
   * Community ID to fetch battle mechanics for
   */
  communityId: string;

  /**
   * Community name (for context in descriptions)
   */
  communityName?: string;

  /**
   * Average rage of community members (optional, fetched separately)
   */
  averageRage?: number;

  /**
   * Whether to show the section heading
   */
  showHeading?: boolean;

  /**
   * Refresh interval in milliseconds (default: 30 seconds)
   */
  refreshInterval?: number;

  className?: string;
}

interface BattleMechanicsState {
  disarray: {
    active: boolean;
    multiplier: number;
    hoursRemaining: number;
  };
  exhaustion: {
    active: boolean;
    multiplier: number;
    hoursRemaining: number;
  };
  momentum: {
    active: boolean;
    moraleBonus: number;
    hoursRemaining: number;
  };
  rage: {
    average: number;
    memberCount: number;
  };
  conquests: {
    total: number;
    recent: number;
    timestamps: string[];
  };
}

export function BattleMechanicsStatus({
  communityId,
  communityName = "This community",
  averageRage = 0,
  showHeading = true,
  refreshInterval = 30000, // 30 seconds
  className,
}: BattleMechanicsStatusProps) {
  const [mechanicsState, setMechanicsState] = useState<BattleMechanicsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMechanics = async () => {
    try {
      const response = await fetch(
        `/api/battle/mechanics/community?communityId=${communityId}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch battle mechanics");
      }

      const data = await response.json();
      setMechanicsState(data);
      setError(null);
    } catch (err) {
      console.error("Error fetching battle mechanics:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMechanics();

    // Set up auto-refresh
    const interval = setInterval(fetchMechanics, refreshInterval);

    return () => clearInterval(interval);
  }, [communityId, refreshInterval]);

  if (isLoading) {
    return (
      <Card className={cn("rounded-xl border border-border/60 bg-card", className)}>
      <CardContent className="space-y-6">
          {showHeading && (
            <SectionHeading
              title="Battle Readiness"
              icon={Shield}
              tooltip="Current battle mechanics affecting your community"
            />
          )}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex flex-col items-center gap-3">
                <Skeleton className="h-28 w-28 rounded-full" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !mechanicsState) {
    return (
      <Card className={cn("rounded-xl border border-border/60 bg-card", className)}>
      <CardContent className="space-y-4">
          {showHeading && (
            <SectionHeading
              title="Battle Readiness"
              icon={Shield}
              tooltip="Current battle mechanics affecting your community"
            />
          )}
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Shield className="h-8 w-8 mb-2 opacity-30" />
            <span className="text-sm">{error || "Failed to load battle status"}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyActiveStatus =
    mechanicsState.disarray.active ||
    mechanicsState.exhaustion.active ||
    mechanicsState.rage.average > 0;

  return (
    <Card className={cn("rounded-xl border border-border/60 bg-card", className)}>
      <CardContent className="space-y-6">
        {showHeading && (
          <SectionHeading
            title="Battle Readiness"
            icon={Shield}
            tooltip="Live combat modifiers that impact energy costs, regeneration, and critical hit probability"
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Disarray Indicator */}
          <div className="flex justify-center">
            <DisarrayLiquidIndicator
              active={mechanicsState.disarray.active}
              multiplier={mechanicsState.disarray.multiplier}
              hoursRemaining={mechanicsState.disarray.hoursRemaining}
              communityName={communityName}
            />
          </div>

          {/* Exhaustion Indicator */}
          <div className="flex justify-center">
            <ExhaustionLiquidIndicator
              active={mechanicsState.exhaustion.active}
              multiplier={mechanicsState.exhaustion.multiplier}
              hoursRemaining={mechanicsState.exhaustion.hoursRemaining}
              recentConquests={mechanicsState.conquests.recent}
              communityName={communityName}
            />
          </div>

          {/* Rage Indicator */}
          <div className="flex justify-center">
            <RageLiquidIndicator
              rage={mechanicsState.rage.average}
              averageRage={mechanicsState.rage.average}
              communityName={communityName}
            />
          </div>
        </div>

        {/* Additional Context (if any status is active) */}
        {hasAnyActiveStatus && (
          <div className="pt-4 border-t border-border/40">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div className="flex flex-col space-y-1">
                <span className="font-semibold text-foreground">Recent Conquests:</span>
                <span>{mechanicsState.conquests.recent} in last 12 hours (Total: {mechanicsState.conquests.total})</span>
              </div>
              {mechanicsState.momentum.active && (
                <div className="flex flex-col space-y-1">
                  <span className="font-semibold text-foreground">Momentum Active:</span>
                  <span>+{mechanicsState.momentum.moraleBonus} morale for {mechanicsState.momentum.hoursRemaining.toFixed(1)} hours</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

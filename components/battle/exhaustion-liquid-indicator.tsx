"use client";

import React from "react";
import { LiquidProgressBar } from "./liquid-progress-bar";
import { getIndicatorColors } from "@/lib/battle-mechanics-theme";

interface ExhaustionLiquidIndicatorProps {
  /**
   * Whether exhaustion is active
   */
  active: boolean;

  /**
   * Energy regen multiplier (0.5 = half speed)
   */
  multiplier: number;

  /**
   * Hours remaining until exhaustion clears
   */
  hoursRemaining: number;

  /**
   * Number of recent conquests that triggered exhaustion
   */
  recentConquests?: number;

  /**
   * Community name (for context in description)
   */
  communityName?: string;

  className?: string;
}

export function ExhaustionLiquidIndicator({
  active,
  multiplier,
  hoursRemaining,
  recentConquests = 2,
  communityName = "The army",
  className,
}: ExhaustionLiquidIndicatorProps) {
  // Get theme-aware colors
  const colors = getIndicatorColors('exhaustion');

  if (!active) {
    return (
      <LiquidProgressBar
        value={100}
        size={120}
        liquidColor={{
          low: colors.low,
          high: colors.high,
        }}
        backgroundColor={colors.background}
        fillDirection="up"
        label="Exhaustion"
        description="Fully rested"
        status="ready"
        tooltipContent={
          <div className="space-y-2">
            <p className="font-semibold">Exhaustion System</p>
            <p className="text-xs">
              Conquering territories exhausts soldiers physically.
            </p>
            <p className="text-xs">
              <strong>Trigger:</strong> 2+ conquests within 12 hours.
            </p>
            <p className="text-xs">
              <strong>Effect:</strong> Energy regeneration reduced to 0.5x (from 10/h to 5/h).
            </p>
            <p className="text-xs">
              <strong>Recovery:</strong> Clears after 12 hours without new conquests.
            </p>
          </div>
        }
        className={className}
      />
    );
  }

  // Calculate recovery progress (0% = just exhausted, 100% = fully recovered)
  // Recovery is based on time passed, not multiplier (multiplier is constant at 0.5)
  const TOTAL_RECOVERY_HOURS = 12;
  const recoveryProgress = ((TOTAL_RECOVERY_HOURS - hoursRemaining) / TOTAL_RECOVERY_HOURS) * 100;

  // Format energy regen text
  const energyRegenText = `${multiplier.toFixed(1)}x energy regen`;

  // Format time remaining
  const formatTimeRemaining = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m until recovery`;
    }
    const fullHours = Math.floor(hours);
    const minutes = Math.round((hours - fullHours) * 60);
    if (minutes === 0) {
      return `${fullHours}h until recovery`;
    }
    return `${fullHours}h ${minutes}m until recovery`;
  };

  // Determine status
  const getStatus = (): "active" | "recovering" | "ready" | "critical" => {
    if (recoveryProgress < 30) return "critical";
    if (recoveryProgress < 70) return "recovering";
    return "ready";
  };

  return (
    <LiquidProgressBar
      value={recoveryProgress}
      size={120}
      liquidColor={{
        low: colors.low,
        high: colors.high,
      }}
      backgroundColor={colors.background}
      fillDirection="up"
      label="Exhaustion"
      description={energyRegenText}
      timeRemaining={formatTimeRemaining(hoursRemaining)}
      status={getStatus()}
      tooltipContent={
        <div className="space-y-2">
          <p className="font-semibold">Exhaustion System</p>
          <p className="text-xs">
            Conquering territories exhausts soldiers physically.
          </p>
          <p className="text-xs">
            <strong>Trigger:</strong> {recentConquests} conquests within 12 hours.
          </p>
          <p className="text-xs">
            <strong>Effect:</strong> Energy regeneration reduced by {multiplier.toFixed(1)}x (from 10/h to {Math.round(10 * multiplier)}/h).
          </p>
          <p className="text-xs">
            <strong>Recovery:</strong> Currently {recoveryProgress.toFixed(0)}% recovered. Clears after 12 hours without new conquests.
          </p>
        </div>
      }
      className={className}
    />
  );
}

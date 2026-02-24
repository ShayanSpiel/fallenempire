"use client";

import React from "react";
import { LiquidProgressBar } from "./liquid-progress-bar";
import { getIndicatorColors } from "@/lib/battle-mechanics-theme";

interface DisarrayLiquidIndicatorProps {
  /**
   * Whether disarray is active
   */
  active: boolean;

  /**
   * Current energy cost multiplier (1.0 - 3.0)
   */
  multiplier: number;

  /**
   * Hours remaining until full recovery
   */
  hoursRemaining: number;

  /**
   * Community name (for context in description)
   */
  communityName?: string;

  className?: string;
}

export function DisarrayLiquidIndicator({
  active,
  multiplier,
  hoursRemaining,
  communityName = "The army",
  className,
}: DisarrayLiquidIndicatorProps) {
  // Get theme-aware colors
  const colors = getIndicatorColors('disarray');

  if (!active || multiplier <= 1.0) {
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
        label="Disarray"
        description="Fully recovered"
        status="ready"
        tooltipContent={
          <div className="space-y-2">
            <p className="font-semibold">Disarray System</p>
            <p className="text-xs">
              When a community loses a battle, chaos disrupts logistics.
            </p>
            <p className="text-xs">
              <strong>Effect:</strong> Energy cost for FIGHT actions increases up to 3x.
            </p>
            <p className="text-xs">
              <strong>Recovery:</strong> Decays linearly over 12 hours.
            </p>
          </div>
        }
        className={className}
      />
    );
  }

  // Calculate recovery progress (0% = just lost, 100% = fully recovered)
  // Recovery progress = (1 - (multiplier - 1) / (3 - 1)) * 100
  // When multiplier = 3.0 → progress = 0%
  // When multiplier = 1.0 → progress = 100%
  const recoveryProgress = ((3.0 - multiplier) / 2.0) * 100;

  // Format energy cost text
  const energyCostText = `${multiplier.toFixed(1)}x energy cost`;

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
      label="Disarray"
      description={energyCostText}
      timeRemaining={formatTimeRemaining(hoursRemaining)}
      status={getStatus()}
      tooltipContent={
        <div className="space-y-2">
          <p className="font-semibold">Disarray System</p>
          <p className="text-xs">
            When a community loses a battle, chaos disrupts logistics.
          </p>
          <p className="text-xs">
            <strong>Effect:</strong> Energy cost for FIGHT actions multiplied by {multiplier.toFixed(1)}x (normally 10 energy, now {Math.round(10 * multiplier)} energy).
          </p>
          <p className="text-xs">
            <strong>Recovery:</strong> Decays from 3x to 1x over 12 hours. Currently {recoveryProgress.toFixed(0)}% recovered.
          </p>
        </div>
      }
      className={className}
    />
  );
}

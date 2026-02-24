"use client";

import React from "react";
import { LiquidProgressBar } from "./liquid-progress-bar";
import { getIndicatorColors } from "@/lib/battle-mechanics-theme";

interface RageLiquidIndicatorProps {
  /**
   * Current rage level (0-100)
   */
  rage: number;

  /**
   * Average rage of all community members
   */
  averageRage?: number;

  /**
   * Community name (for context in description)
   */
  communityName?: string;

  className?: string;
}

export function RageLiquidIndicator({
  rage,
  averageRage,
  communityName = "The community",
  className,
}: RageLiquidIndicatorProps) {
  const rawRage = Number(rage);
  const normalizedRage =
    Number.isFinite(rawRage) && rawRage > 0 && rawRage <= 1 ? rawRage * 100 : rawRage;
  const percentage = Math.max(0, Math.min(100, normalizedRage || 0));

  // Get contextual description based on rage level
  const getDescription = (): string => {
    if (percentage >= 75) {
      return `${communityName} is enraged and furious`;
    }
    if (percentage >= 50) {
      return `${communityName} is angry and vengeful`;
    }
    if (percentage >= 25) {
      return `${communityName} is frustrated`;
    }
    if (percentage > 0) {
      return `${communityName} is mostly calm`;
    }
    return `${communityName} is completely calm`;
  };

  // Calculate critical hit chance text
  const critChanceText = `${percentage.toFixed(0)}% critical hit chance`;

  // Get rage status label
  const getRageStatus = (): string => {
    if (percentage >= 75) return "Enraged";
    if (percentage >= 50) return "Furious";
    if (percentage >= 25) return "Angry";
    return "Calm";
  };

  // Calculate decay information
  const DECAY_PER_HOUR = 5;
  const hoursToZero = percentage / DECAY_PER_HOUR;
  const decayText = percentage > 0
    ? `Decays to 0% in ${hoursToZero.toFixed(1)}h`
    : "No rage";

  // Determine status
  const getStatus = (): "active" | "recovering" | "ready" | "critical" => {
    if (percentage >= 75) return "critical";
    if (percentage >= 25) return "active";
    return "ready";
  };

  // Get theme-aware colors
  const colors = getIndicatorColors('rage');

  return (
    <LiquidProgressBar
      value={percentage}
      size={120}
      liquidColor={{
        low: colors.low,
        high: colors.high,
      }}
      backgroundColor={colors.background}
      fillDirection="up" // RAGE FILLS FROM BOTTOM TO TOP
      label="Rage"
      description={critChanceText}
      timeRemaining={decayText}
      status={getStatus()}
      tooltipContent={
        <div className="space-y-2">
          <p className="font-semibold">Rage System</p>
          <p className="text-xs">
            Rage accumulates from defeats and injustices, enabling critical hits.
          </p>
          <p className="text-xs">
            <strong>Current Status:</strong> {getRageStatus()} ({percentage.toFixed(0)}% rage)
          </p>
          <p className="text-xs">
            <strong>Effect:</strong> Each attack has a {percentage.toFixed(0)}% chance to deal 3x damage (critical hit).
          </p>
          <p className="text-xs">
            <strong>Accumulation:</strong>
            <br />
            • Battle loss: +10 rage
            <br />
            • Hex captured: +10 rage
            <br />
            • Capital captured: +20 rage
            <br />
            • Ally defeated: +15 rage
          </p>
          <p className="text-xs">
            <strong>Decay:</strong> -5 rage per hour (naturally cools down).
          </p>
          {averageRage !== undefined && (
            <p className="text-xs">
              <strong>Community Average:</strong> {averageRage.toFixed(0)}% rage
            </p>
          )}
        </div>
      }
      className={className}
    />
  );
}

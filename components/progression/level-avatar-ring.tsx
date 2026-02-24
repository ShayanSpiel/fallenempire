"use client";

import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { progressionClasses, levelBadgeSizes, buildProgressbarStyles } from "@/lib/progression-theme";

interface LevelAvatarRingProps {
  children: React.ReactNode;
  level: number;
  progressPercent: number;
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
}

const sizeConfig = {
  sm: { outerSize: 64, pathWidth: 3, badgeSize: 18 },
  md: { outerSize: 92, pathWidth: 4, badgeSize: 22 },
  lg: { outerSize: 140, pathWidth: 5, badgeSize: 28 },
} as const;

/**
 * Circular progress ring around avatar with level badge
 * Used in profile page and potentially other contexts
 * Theme-aware: uses theme colors from progression-theme
 */
export function LevelAvatarRing({
  children,
  level,
  progressPercent,
  size = "md",
  showBadge = true,
}: LevelAvatarRingProps) {
  const config = sizeConfig[size];
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="relative inline-block">
      <div style={{ width: config.outerSize, height: config.outerSize }}>
        <CircularProgressbar
          value={clampedPercent}
          strokeWidth={config.pathWidth}
          styles={buildStyles(buildProgressbarStyles())}
        />
      </div>

      {/* Avatar content inside ring */}
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>

      {/* Level badge with theme-aware styling */}
      {showBadge && (
        <div
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 ${progressionClasses.badgeGradient} ${progressionClasses.badgeText} rounded-full ${progressionClasses.badgeBorder} ${progressionClasses.badgeShadow} flex items-center justify-center`}
          style={{
            width: config.badgeSize,
            height: config.badgeSize,
            fontSize: levelBadgeSizes[size].fontSize,
          }}
        >
          {level}
        </div>
      )}
    </div>
  );
}

export default LevelAvatarRing;

"use client";

import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { progressionClasses, buildProgressbarStyles } from "@/lib/progression-theme";

interface LevelNavBadgeProps {
  children: React.ReactNode;
  level: number;
  progressPercent: number;
}

/**
 * Compact circular progress indicator for navigation bar avatar
 * Shows thin ring around avatar with level number badge overlayed at center
 * Uses same simple structure as profile ring component
 */
export function LevelNavBadge({ children, level, progressPercent }: LevelNavBadgeProps) {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));
  const strokeWidth = 10;
  const avatarDiameter = 40;
  const ringPadding = 0;
  const ringSize = avatarDiameter + ringPadding * 2;
  const avatarOffset = (ringSize - avatarDiameter) / 2;
  const ringStyles = buildStyles({
    ...buildProgressbarStyles(),
    trailColor: "var(--border)",
    strokeLinecap: "round",
  });
  const progressStyles = {
    ...ringStyles,
    root: { width: "100%", height: "100%" },
    path: {
      ...(ringStyles.path ?? {}),
      strokeWidth,
    },
    trail: {
      ...(ringStyles.trail ?? {}),
      strokeWidth,
    },
  };
  const ringScale = 1;
  const ringMargin = ((ringScale - 1) * ringSize) / 2;

  return (
    <div
      className="relative"
      style={{ width: `${ringSize}px`, height: `${ringSize}px` }}
    >
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: `${avatarDiameter}px`,
          height: `${avatarDiameter}px`,
          top: `${avatarOffset}px`,
          left: `${avatarOffset}px`,
          zIndex: 1,
        }}
      >
        {children}
      </div>

      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 2 }}
      >
        <span
          className={progressionClasses.navBadgeBackground}
          aria-hidden
          style={{
            width: `${avatarDiameter}px`,
            height: `${avatarDiameter}px`,
          }}
        />
      </div>

      <div
        className="absolute pointer-events-none"
        style={{
          top: `${-ringMargin}px`,
          left: `${-ringMargin}px`,
          width: `calc(100% + ${ringMargin * 2}px)`,
          height: `calc(100% + ${ringMargin * 2}px)`,
          zIndex: 3,
        }}
      >
        <CircularProgressbar
          className="h-full w-full"
          value={clampedPercent}
          strokeWidth={strokeWidth}
          styles={progressStyles}
        />
      </div>

      {/* Level badge - overlay center */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 4 }}
      >
        <span className={progressionClasses.navBadge}>{level}</span>
      </div>
    </div>
  );
}

export default LevelNavBadge;

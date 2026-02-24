"use client";

import { formatXp } from "@/lib/progression";
import { progressionClasses } from "@/lib/progression-theme";

interface LevelProgressBarProps {
  level: number;
  xpInLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  compact?: boolean;
}

/**
 * Horizontal progress bar displaying XP progression
 * Used in sidebar and profile views
 * Theme-aware: uses theme classes from progression-theme
 */
export function LevelProgressBar({
  level,
  xpInLevel,
  xpForNextLevel,
  progressPercent,
  compact = false,
}: LevelProgressBarProps) {
  const clampedPercent = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="space-y-1.5">
      {/* Level label and XP counter */}
      <div className="flex items-center justify-between">
        <span className={`text-muted-foreground font-medium ${compact ? "text-xs" : "text-sm"}`}>
          Level {level}
        </span>
        <span className={`text-muted-foreground font-mono ${compact ? "text-xs" : "text-xs"}`}>
          {formatXp(xpInLevel)}/{formatXp(xpForNextLevel)}
        </span>
      </div>

      {/* Progress bar container */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        {/* Progress fill with theme-aware gradient and shadow */}
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${progressionClasses.barGradient} ${progressionClasses.barShadow}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}

export default LevelProgressBar;

"use client";

import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { useTheme } from "next-themes";
import { moralEmojiBadgeSizes } from "@/lib/progression-theme";

interface MoraleAvatarRingProps {
  children: React.ReactNode;
  morale: number;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { outerSize: 64, pathWidth: 3 },
  md: { outerSize: 92, pathWidth: 4 },
  lg: { outerSize: 140, pathWidth: 5 },
} as const;

/**
 * Get morale mood icon based on morale level
 */
function getMoraleIcon(morale: number) {
  if (morale >= 80) return "🤩"; // Star-eyed/Excited
  if (morale >= 60) return "😊"; // Happy/Smiling
  if (morale >= 40) return "😐"; // Neutral/Poker face
  if (morale >= 20) return "😞"; // Sad/Disappointed
  return "😡"; // Angry
}

/**
 * Get morale color based on morale value (red -> golden amber -> green spectrum)
 * Uses brighter yellows and ambers for better contrast
 */
function getMoraleColor(morale: number): string {
  if (morale <= 20) {
    // Red spectrum (0-20) - bright red
    return `hsl(0, 100%, ${55 - (20 - morale) * 0.5}%)`;
  } else if (morale <= 50) {
    // Red to Golden Amber transition (20-50)
    // Transition from red (0°) to golden amber (40°)
    const progress = (morale - 20) / 30;
    const hue = progress * 40; // 0 to 40 degrees (red to golden amber)
    const saturation = 100 - progress * 10; // 100% to 90% (more golden)
    const lightness = 45 + progress * 5; // 45% to 50% (brighter)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else if (morale <= 80) {
    // Golden Amber to Green transition (50-80)
    const progress = (morale - 50) / 30;
    const hue = 40 + progress * 80; // 40 to 120 degrees (golden amber to green)
    const saturation = 90 - progress * 30; // 90% to 60% (less saturated as it greens)
    const lightness = 50 - progress * 5; // 50% to 45% (slightly darker green)
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  } else {
    // Deep vibrant green (80-100)
    return `hsl(120, 70%, ${50 - (100 - morale) * 0.3}%)`;
  }
}

/**
 * Get morale label
 */
function getMoraleLabel(morale: number): string {
  if (morale >= 80) return "Ecstatic";
  if (morale >= 60) return "Happy";
  if (morale >= 40) return "Content";
  if (morale >= 20) return "Discouraged";
  return "Rebellious";
}

/**
 * Circular morale ring around avatar with mood icon and spectrum colors
 * AI Users only - shows morale instead of level
 */
export function MoraleAvatarRing({
  children,
  morale,
  size = "md",
}: MoraleAvatarRingProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const config = sizeConfig[size];
  const clampedMorale = Math.min(100, Math.max(0, morale));
  const ringColor = getMoraleColor(clampedMorale);
  const moodIcon = getMoraleIcon(clampedMorale);
  const moraleLabel = getMoraleLabel(clampedMorale);

  // Get trail color based on theme
  // Avoid hydration mismatch: next-themes may resolve theme on the client before first paint,
  // but the server render can only use the default theme.
  const trailColor =
    mounted && resolvedTheme === "dark" ? "hsl(0, 0%, 20%)" : "hsl(40, 30%, 90%)";
  const emojiSize = moralEmojiBadgeSizes[size];

  return (
    <div className="relative inline-block">
      <div style={{ width: config.outerSize, height: config.outerSize }}>
        <CircularProgressbar
          value={clampedMorale}
          strokeWidth={config.pathWidth}
          styles={buildStyles({
            rotation: 0,
            strokeLinecap: "round",
            pathTransitionDuration: 0.5,
            pathColor: ringColor,
            trailColor: trailColor,
          })}
        />
      </div>

      {/* Avatar content inside ring */}
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>

      {/* Mood icon badge - just emoji, no background */}
      <div
        className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none"
        style={{
          transform: "translateY(50%)",
        }}
        aria-hidden
      >
        <span
          className="transition-transform duration-200"
          style={{
            fontSize: emojiSize.fontSize,
            lineHeight: 1,
          }}
          title={`Morale: ${Math.round(clampedMorale)}% - ${moraleLabel}`}
        >
          {moodIcon}
        </span>
      </div>

      {/* Morale label badge */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-[10px] font-bold text-white shadow-md flex items-center gap-2"
        style={{
          backgroundColor: ringColor,
        }}
      >
        <span>Morale:</span>
        <span>{Math.round(clampedMorale)}%</span>
      </div>
    </div>
  );
}

export default MoraleAvatarRing;

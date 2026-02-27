import * as React from "react";
import { cn } from "@/lib/utils";

interface FoodQualityIconProps {
  tier: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

// Bread icons by quality tier
const BREAD_ICONS = {
  1: "🍞", // Common - Basic bread
  2: "🥖", // Uncommon - Baguette
  3: "🥐", // Rare - Croissant
  4: "🥯", // Epic - Bagel
  5: "🎂", // Legendary - Cake (fancy bread!)
};

const SIZE_CLASSES = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl",
};

export function FoodQualityIcon({ tier, className, size = "md" }: FoodQualityIconProps) {
  const icon = BREAD_ICONS[tier as keyof typeof BREAD_ICONS] || BREAD_ICONS[1];

  return (
    <span className={cn(SIZE_CLASSES[size], className)} aria-label={`Quality tier ${tier}`}>
      {icon}
    </span>
  );
}

// Helper to get bread icon string directly
export function getBreadIcon(tier: number): string {
  return BREAD_ICONS[tier as keyof typeof BREAD_ICONS] || BREAD_ICONS[1];
}

// Quality tier names
export const QUALITY_NAMES = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Epic",
  5: "Legendary",
};

export function getQualityName(tier: number): string {
  return QUALITY_NAMES[tier as keyof typeof QUALITY_NAMES] || "Common";
}

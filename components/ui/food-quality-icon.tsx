import * as React from "react";
import { cn } from "@/lib/utils";
import { getQualityIcon, getQualityName, FOOD_SIZE_CLASSES } from "@/lib/design-system";

// Re-export from design-system for backward compatibility
export { getQualityName } from "@/lib/design-system";

interface FoodQualityIconProps {
  tier: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function FoodQualityIcon({ tier, className, size = "md" }: FoodQualityIconProps) {
  const icon = getQualityIcon(tier, "food");

  return (
    <span className={cn(FOOD_SIZE_CLASSES[size], className)} aria-label={`Quality tier ${tier}`}>
      {icon}
    </span>
  );
}

// Helper to get bread icon string directly
export function getBreadIcon(tier: number): string {
  return getQualityIcon(tier, "food");
}

import React from "react";
import { cn } from "@/lib/utils";
import {
  getQualityIcon,
  getQualityName,
  getQualityColor,
  getQualityBgColor,
  getQualityBorderColor,
  getWeaponDamageBonus,
  getWeaponDamageBonusPercent,
  SIZE_CLASSES,
} from "@/lib/design-system";

// Re-export from design-system for backward compatibility
export { getQualityName, getQualityColor, getQualityBgColor, getQualityBorderColor } from "@/lib/design-system";

export function getWeaponIcon(tier: number): string {
  return getQualityIcon(tier, "weapon");
}

type WeaponQualityIconSize = keyof typeof SIZE_CLASSES;

interface WeaponQualityIconProps {
  tier: number;
  size?: WeaponQualityIconSize;
  className?: string;
}

export function WeaponQualityIcon({ tier, size = "md", className }: WeaponQualityIconProps) {
  return (
    <span className={cn(SIZE_CLASSES[size], className)} aria-label={`Quality tier ${tier} weapon`}>
      {getWeaponIcon(tier)}
    </span>
  );
}

// Re-export damage bonus functions from design-system
export { getWeaponDamageBonus, getWeaponDamageBonusPercent } from "@/lib/design-system";

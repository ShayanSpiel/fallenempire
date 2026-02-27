import React from "react";
import { cn } from "@/lib/utils";

// Weapon icons by quality tier - Modern Warfare Theme
// Ground weapons progressing from basic to advanced military hardware
const WEAPON_ICONS = {
  1: "🔫", // Common - Pistol
  2: "🔫", // Uncommon - Rifle (using same emoji but different context)
  3: "💥", // Rare - Heavy Weapon/Explosion
  4: "💣", // Epic - Artillery/Bomb
  5: "🚁", // Legendary - Military Helicopter
} as const;

export function getWeaponIcon(tier: number): string {
  return WEAPON_ICONS[tier as keyof typeof WEAPON_ICONS] || WEAPON_ICONS[1];
}

// Quality tier names (shared with food system)
export const QUALITY_NAMES = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Epic",
  5: "Legendary",
} as const;

// Quality tier colors (for UI consistency)
export const QUALITY_COLORS = {
  1: "text-gray-400",
  2: "text-green-500",
  3: "text-blue-500",
  4: "text-purple-500",
  5: "text-orange-500",
} as const;

export const QUALITY_BG_COLORS = {
  1: "bg-gray-500/10",
  2: "bg-green-500/10",
  3: "bg-blue-500/10",
  4: "bg-purple-500/10",
  5: "bg-orange-500/10",
} as const;

export const QUALITY_BORDER_COLORS = {
  1: "border-gray-500/20",
  2: "border-green-500/20",
  3: "border-blue-500/20",
  4: "border-purple-500/20",
  5: "border-orange-500/20",
} as const;

export function getQualityName(tier: number): string {
  return QUALITY_NAMES[tier as keyof typeof QUALITY_NAMES] || QUALITY_NAMES[1];
}

export function getQualityColor(tier: number): string {
  return QUALITY_COLORS[tier as keyof typeof QUALITY_COLORS] || QUALITY_COLORS[1];
}

export function getQualityBgColor(tier: number): string {
  return QUALITY_BG_COLORS[tier as keyof typeof QUALITY_BG_COLORS] || QUALITY_BG_COLORS[1];
}

export function getQualityBorderColor(tier: number): string {
  return QUALITY_BORDER_COLORS[tier as keyof typeof QUALITY_BORDER_COLORS] || QUALITY_BORDER_COLORS[1];
}

// Size classes for consistent sizing
const SIZE_CLASSES = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
} as const;

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

// Damage bonus percentages for each weapon quality
export const WEAPON_DAMAGE_BONUS = {
  1: 0.20, // +20%
  2: 0.30, // +30%
  3: 0.40, // +40%
  4: 0.50, // +50%
  5: 0.60, // +60%
} as const;

export function getWeaponDamageBonus(tier: number): number {
  return WEAPON_DAMAGE_BONUS[tier as keyof typeof WEAPON_DAMAGE_BONUS] || 0;
}

export function getWeaponDamageBonusPercent(tier: number): string {
  return `+${Math.round(getWeaponDamageBonus(tier) * 100)}%`;
}

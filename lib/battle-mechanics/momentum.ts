// Battle Mechanics System: Momentum (Victory Morale Buff) Module
// Version: 1.0
// Date: December 29, 2025

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BattleMechanicsConfig } from "./types";

/**
 * Apply momentum buff to a community
 * Calls database function to handle member morale updates
 *
 * @param communityId - Community ID
 */
export async function applyMomentum(communityId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.rpc("apply_momentum", {
      p_community_id: communityId,
    });

    if (error) {
      console.error("Failed to apply momentum:", error);
    }
  } catch (err) {
    console.error("Error applying momentum:", err);
  }
}

/**
 * Check if momentum is active for a community
 * Calls database function
 *
 * @param communityId - Community ID
 * @returns Whether momentum is active
 */
export async function isMomentumActive(
  communityId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc("is_momentum_active", {
      p_community_id: communityId,
    });

    if (error) {
      console.error("Failed to check momentum:", error);
      return false;
    }

    return (data as boolean) || false;
  } catch (err) {
    console.error("Error checking momentum:", err);
    return false;
  }
}

/**
 * Calculate hours remaining until momentum expires
 *
 * @param momentumExpiresAt - When momentum expires (ISO string)
 * @returns Hours remaining (0 if expired)
 */
export function getMomentumHoursRemaining(
  momentumExpiresAt: string | null
): number {
  if (!momentumExpiresAt) return 0;

  const expiryTime = new Date(momentumExpiresAt).getTime();
  const now = Date.now();
  const hoursRemaining = (expiryTime - now) / (1000 * 60 * 60);

  return Math.max(0, hoursRemaining);
}

/**
 * Get momentum status for UI display
 *
 * @param active - Whether momentum is active
 * @param hoursRemaining - Hours until expiry
 * @param moraleBonus - Morale bonus amount
 * @returns Status object
 */
export function getMomentumStatus(
  active: boolean,
  hoursRemaining: number,
  moraleBonus: number
): {
  level: "none" | "fading" | "active" | "strong";
  color: "gray" | "yellow" | "green" | "blue";
  description: string;
  icon: string;
} {
  if (!active || hoursRemaining <= 0) {
    return {
      level: "none",
      color: "gray",
      description: "No momentum",
      icon: "",
    };
  } else if (hoursRemaining <= 2) {
    return {
      level: "fading",
      color: "yellow",
      description: `Momentum fading (+${moraleBonus} morale, ${hoursRemaining.toFixed(1)}h left)`,
      icon: "✨",
    };
  } else if (hoursRemaining <= 6) {
    return {
      level: "active",
      color: "green",
      description: `Victory momentum (+${moraleBonus} morale, ${hoursRemaining.toFixed(1)}h left)`,
      icon: "⚡",
    };
  } else {
    return {
      level: "strong",
      color: "blue",
      description: `Strong momentum (+${moraleBonus} morale, ${hoursRemaining.toFixed(1)}h left)`,
      icon: "⚡⚡",
    };
  }
}

/**
 * Calculate effective morale with momentum bonus
 *
 * @param baseMorale - User's base morale
 * @param momentumActive - Whether momentum is active
 * @param config - Battle mechanics configuration
 * @returns Effective morale
 */
export function getEffectiveMoraleWithMomentum(
  baseMorale: number,
  momentumActive: boolean,
  config: BattleMechanicsConfig
): number {
  if (!config.momentum_enabled || !momentumActive) {
    return baseMorale;
  }

  const effectiveMorale = baseMorale + config.momentum_morale_bonus;
  return Math.min(100, effectiveMorale);
}

/**
 * Get momentum expiry timestamp
 *
 * @param config - Battle mechanics configuration
 * @returns Expiry timestamp (ISO string)
 */
export function getMomentumExpiryTime(
  config: BattleMechanicsConfig
): string {
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() + config.momentum_duration_hours);
  return expiryTime.toISOString();
}

/**
 * Check if a community should get momentum refreshed
 * (On consecutive wins)
 *
 * @param currentWinStreak - Current win streak
 * @returns Whether to refresh momentum
 */
export function shouldRefreshMomentum(currentWinStreak: number): boolean {
  // Always refresh on any win
  return currentWinStreak > 0;
}

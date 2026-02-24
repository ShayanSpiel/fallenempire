// Battle Mechanics System: Exhaustion (Energy Regen Penalty) Module
// Version: 1.0
// Date: December 29, 2025

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BattleMechanicsConfig } from "./types";

/**
 * Check exhaustion status for a community
 * Calls database function which updates state
 *
 * @param communityId - Community ID
 * @returns Whether community is exhausted
 */
export async function checkExhaustionStatus(
  communityId: string
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc("check_exhaustion_status", {
      p_community_id: communityId,
    });

    if (error) {
      console.error("Failed to check exhaustion:", error);
      return false;
    }

    return (data as boolean) || false;
  } catch (err) {
    console.error("Error checking exhaustion:", err);
    return false;
  }
}

/**
 * Track a conquest for exhaustion calculation
 * Calls database function
 *
 * @param communityId - Community ID
 * @param hexId - Conquered hex ID
 */
export async function trackConquest(
  communityId: string,
  hexId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.rpc("track_conquest", {
      p_community_id: communityId,
      p_hex_id: hexId,
    });

    if (error) {
      console.error("Failed to track conquest:", error);
    }
  } catch (err) {
    console.error("Error tracking conquest:", err);
  }
}

/**
 * Get energy regeneration rate for a user
 * Calls database function which checks exhaustion
 *
 * @param userId - User ID
 * @returns Energy regen rate (per hour)
 */
export async function getEnergyRegenRate(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc("get_energy_regen_rate", {
      p_user_id: userId,
    });

    if (error) {
      console.error("Failed to get energy regen rate:", error);
      return 10; // Default
    }

    return (data as number) || 10;
  } catch (err) {
    console.error("Error getting energy regen rate:", err);
    return 10; // Default
  }
}

/**
 * Calculate energy regen multiplier based on exhaustion
 *
 * @param exhausted - Whether community is exhausted
 * @param config - Battle mechanics configuration
 * @returns Energy regen multiplier
 */
export function getEnergyRegenMultiplier(
  exhausted: boolean,
  config: BattleMechanicsConfig
): number {
  if (!config.exhaustion_enabled || !exhausted) {
    return 1.0;
  }

  return config.exhaustion_energy_regen_multiplier;
}

/**
 * Calculate effective energy regen rate
 *
 * @param baseRegenRate - Base energy regen (typically 10/hour)
 * @param exhausted - Whether community is exhausted
 * @param config - Battle mechanics configuration
 * @returns Effective regen rate
 */
export function calculateEnergyRegenRate(
  baseRegenRate: number,
  exhausted: boolean,
  config: BattleMechanicsConfig
): number {
  const multiplier = getEnergyRegenMultiplier(exhausted, config);
  return baseRegenRate * multiplier;
}

/**
 * Count recent conquests within time window
 *
 * @param conquestTimestamps - Array of conquest timestamps (ISO strings)
 * @param resetHours - Time window in hours
 * @returns Number of recent conquests
 */
export function countRecentConquests(
  conquestTimestamps: string[],
  resetHours: number
): number {
  const cutoffTime = Date.now() - resetHours * 60 * 60 * 1000;

  return conquestTimestamps.filter((timestamp) => {
    const conquestTime = new Date(timestamp).getTime();
    return conquestTime > cutoffTime;
  }).length;
}

/**
 * Check if community should be exhausted based on conquests
 *
 * @param conquestTimestamps - Array of conquest timestamps
 * @param config - Battle mechanics configuration
 * @returns Whether should be exhausted
 */
export function shouldBeExhausted(
  conquestTimestamps: string[],
  config: BattleMechanicsConfig
): boolean {
  const recentConquests = countRecentConquests(
    conquestTimestamps,
    config.exhaustion_reset_hours
  );

  return recentConquests >= config.exhaustion_conquest_threshold;
}

/**
 * Get hours until exhaustion clears
 *
 * @param lastConquestAt - Last conquest timestamp (ISO string)
 * @param config - Battle mechanics configuration
 * @returns Hours until clear (0 if already clear)
 */
export function getHoursUntilExhaustionClear(
  lastConquestAt: string | null,
  config: BattleMechanicsConfig
): number {
  if (!lastConquestAt) return 0;

  const lastConquest = new Date(lastConquestAt).getTime();
  const now = Date.now();
  const hoursSince = (now - lastConquest) / (1000 * 60 * 60);

  const remaining = config.exhaustion_reset_hours - hoursSince;
  return Math.max(0, remaining);
}

/**
 * Get exhaustion status for UI display
 *
 * @param exhausted - Whether exhausted
 * @param recentConquests - Number of recent conquests
 * @param hoursUntilClear - Hours until exhaustion clears
 * @param regenMultiplier - Energy regen multiplier
 * @returns Status object
 */
export function getExhaustionStatus(
  exhausted: boolean,
  recentConquests: number,
  hoursUntilClear: number,
  regenMultiplier: number
): {
  level: "none" | "approaching" | "exhausted" | "severe";
  color: "gray" | "yellow" | "orange" | "red";
  description: string;
  regenPenalty: number; // Percentage (0-50%)
} {
  const regenPenalty = Math.round((1.0 - regenMultiplier) * 100);

  if (!exhausted) {
    if (recentConquests >= 1) {
      return {
        level: "approaching",
        color: "yellow",
        description: `${recentConquests} recent conquest(s) - rest soon`,
        regenPenalty: 0,
      };
    }
    return {
      level: "none",
      color: "gray",
      description: "Well rested",
      regenPenalty: 0,
    };
  } else if (regenMultiplier >= 0.7) {
    return {
      level: "exhausted",
      color: "orange",
      description: `Tired (${hoursUntilClear.toFixed(1)}h until recovery)`,
      regenPenalty,
    };
  } else {
    return {
      level: "severe",
      color: "red",
      description: `Exhausted (${hoursUntilClear.toFixed(1)}h until recovery)`,
      regenPenalty,
    };
  }
}

/**
 * Calculate time to fully regenerate energy
 *
 * @param currentEnergy - Current energy
 * @param maxEnergy - Maximum energy (typically 100)
 * @param regenRate - Energy regen rate per hour
 * @returns Hours to full energy
 */
export function getTimeToFullEnergy(
  currentEnergy: number,
  maxEnergy: number,
  regenRate: number
): number {
  if (currentEnergy >= maxEnergy) return 0;
  if (regenRate <= 0) return Infinity;

  const energyNeeded = maxEnergy - currentEnergy;
  return energyNeeded / regenRate;
}

/**
 * Estimate fights possible per hour
 *
 * @param baseEnergyCost - Base energy cost per fight
 * @param regenRate - Energy regen rate per hour
 * @returns Fights possible per hour (sustainable rate)
 */
export function getFightsPerHour(
  baseEnergyCost: number,
  regenRate: number
): number {
  if (baseEnergyCost <= 0) return 0;
  return Math.floor(regenRate / baseEnergyCost);
}

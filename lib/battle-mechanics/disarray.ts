// Battle Mechanics System: Disarray (Energy Cost Multiplier) Module
// Version: 1.0
// Date: December 29, 2025

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BattleMechanicsConfig } from "./types";

/**
 * Calculate disarray energy cost multiplier
 * Linear decay from max_multiplier to 1.0 over duration_hours
 *
 * @param disarrayStartedAt - When disarray began (ISO string)
 * @param config - Battle mechanics configuration
 * @returns Energy cost multiplier (1.0-3.0)
 */
export function calculateDisarrayMultiplier(
  disarrayStartedAt: string | null,
  config: BattleMechanicsConfig
): number {
  if (!config.disarray_enabled || !disarrayStartedAt) {
    return 1.0;
  }

  const startTime = new Date(disarrayStartedAt).getTime();
  const now = Date.now();
  const hoursSince = (now - startTime) / (1000 * 60 * 60);

  // Check if expired
  if (hoursSince >= config.disarray_duration_hours) {
    return 1.0;
  }

  // Linear decay: max_multiplier → 1.0 over duration
  const multiplier =
    config.disarray_max_multiplier -
    (hoursSince / config.disarray_duration_hours) *
      (config.disarray_max_multiplier - 1.0);

  return Math.max(1.0, multiplier);
}

/**
 * Get disarray multiplier for a community
 * Calls database function for accuracy
 *
 * @param communityId - Community ID
 * @returns Energy cost multiplier
 */
export async function getDisarrayMultiplier(
  communityId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc("get_disarray_multiplier", {
      p_community_id: communityId,
    });

    if (error) {
      console.error("Failed to get disarray multiplier:", error);
      return 1.0;
    }

    return (data as number) || 1.0;
  } catch (err) {
    console.error("Error getting disarray multiplier:", err);
    return 1.0;
  }
}

/**
 * Calculate energy cost with disarray multiplier
 *
 * @param baseEnergyCost - Base energy cost
 * @param disarrayMultiplier - Disarray multiplier
 * @returns Final energy cost
 */
export function calculateEnergyCost(
  baseEnergyCost: number,
  disarrayMultiplier: number
): number {
  return Math.ceil(baseEnergyCost * disarrayMultiplier);
}

/**
 * Get hours remaining until disarray clears
 *
 * @param disarrayStartedAt - When disarray began (ISO string)
 * @param config - Battle mechanics configuration
 * @returns Hours remaining (0 if cleared)
 */
export function getDisarrayHoursRemaining(
  disarrayStartedAt: string | null,
  config: BattleMechanicsConfig
): number {
  if (!disarrayStartedAt) return 0;

  const startTime = new Date(disarrayStartedAt).getTime();
  const now = Date.now();
  const hoursSince = (now - startTime) / (1000 * 60 * 60);

  const remaining = config.disarray_duration_hours - hoursSince;
  return Math.max(0, remaining);
}

/**
 * Get disarray status for UI display
 *
 * @param multiplier - Current multiplier (1.0-3.0)
 * @param hoursRemaining - Hours until cleared
 * @returns Status object
 */
export function getDisarrayStatus(
  multiplier: number,
  hoursRemaining: number
): {
  level: "none" | "recovering" | "moderate" | "severe";
  color: "gray" | "yellow" | "orange" | "red";
  description: string;
  percentage: number; // Energy cost increase (0-200%)
} {
  const percentage = Math.round((multiplier - 1.0) * 100);

  if (multiplier <= 1.1) {
    return {
      level: "none",
      color: "gray",
      description: "Fully organized",
      percentage: 0,
    };
  } else if (multiplier <= 1.5) {
    return {
      level: "recovering",
      color: "yellow",
      description: `Reorganizing (${hoursRemaining.toFixed(1)}h remaining)`,
      percentage,
    };
  } else if (multiplier <= 2.0) {
    return {
      level: "moderate",
      color: "orange",
      description: `Disorganized (${hoursRemaining.toFixed(1)}h remaining)`,
      percentage,
    };
  } else {
    return {
      level: "severe",
      color: "red",
      description: `Scattered (${hoursRemaining.toFixed(1)}h remaining)`,
      percentage,
    };
  }
}

/**
 * Calculate attacks possible with current energy and disarray
 *
 * @param currentEnergy - User's current energy
 * @param baseEnergyCost - Base energy cost per attack
 * @param disarrayMultiplier - Disarray multiplier
 * @returns Number of attacks possible
 */
export function getAttacksPossible(
  currentEnergy: number,
  baseEnergyCost: number,
  disarrayMultiplier: number
): number {
  const costPerAttack = calculateEnergyCost(baseEnergyCost, disarrayMultiplier);
  return Math.floor(currentEnergy / costPerAttack);
}

/**
 * Apply disarray to a community
 * Calls database function
 *
 * @param communityId - Community ID
 */
export async function applyDisarray(communityId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase.rpc("apply_disarray", {
      p_community_id: communityId,
    });

    if (error) {
      console.error("Failed to apply disarray:", error);
    }
  } catch (err) {
    console.error("Error applying disarray:", err);
  }
}

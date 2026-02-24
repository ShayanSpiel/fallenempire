// Battle Mechanics System: Rage (Critical Hits) Module
// Version: 1.0
// Date: December 29, 2025

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BattleMechanicsConfig, RageTriggerType } from "./types";

/**
 * Calculate rage gain from an event with morale scaling
 *
 * @param triggerType - Type of rage trigger
 * @param morale - User's current morale (0-100)
 * @param config - Battle mechanics configuration
 * @returns Rage gain amount
 */
export function calculateRageGain(
  triggerType: RageTriggerType,
  morale: number,
  config: BattleMechanicsConfig
): number {
  if (!config.rage_enabled) {
    return 0;
  }

  // Get base rage for trigger type
  let baseRage = 0;
  switch (triggerType) {
    case "hex_captured":
      baseRage = config.rage_trigger_hex_captured;
      break;
    case "capital_captured":
      baseRage = config.rage_trigger_capital_captured;
      break;
    case "ally_defeated":
      baseRage = config.rage_trigger_ally_defeated;
      break;
    case "battle_loss":
      baseRage = config.rage_trigger_battle_loss;
      break;
    case "enemy_attacks":
      baseRage = config.rage_trigger_enemy_attacks;
      break;
    case "dislike":
      baseRage = config.rage_trigger_dislike;
      break;
  }

  // Apply morale scaling if enabled
  if (config.rage_morale_scaling_enabled) {
    const scalingFactor = 1.0 + (100 - morale) / 100;
    return baseRage * scalingFactor;
  }

  return baseRage;
}

/**
 * Add rage to a user
 * Calls database function to handle persistence
 *
 * @param userId - User ID
 * @param triggerType - Type of rage trigger
 * @param metadata - Additional metadata
 * @returns New rage value
 */
export async function addRage(
  userId: string,
  triggerType: RageTriggerType,
  metadata: Record<string, any> = {}
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc("add_rage", {
      p_user_id: userId,
      p_trigger_type: triggerType,
      p_metadata: metadata,
    });

    if (error) {
      console.error("Failed to add rage:", error);
      return 0;
    }

    return data as number;
  } catch (err) {
    console.error("Error adding rage:", err);
    return 0;
  }
}

/**
 * Check if an attack is a critical hit based on rage
 * Uses random number generation (0-100)
 *
 * @param rage - Rage percentage (0-100)
 * @returns Whether attack is critical
 */
export function checkRageCritical(rage: number): boolean {
  const rawRage = Number(rage);
  if (!Number.isFinite(rawRage) || rawRage <= 0) return false;

  const normalizedRage = rawRage <= 1 ? rawRage * 100 : rawRage;
  const roll = Math.random() * 100;
  return roll < Math.min(100, normalizedRage);
}

/**
 * Calculate critical hit damage
 *
 * @param baseDamage - Base damage amount
 * @param config - Battle mechanics configuration
 * @returns Critical damage amount
 */
export function calculateCriticalDamage(
  baseDamage: number,
  config: BattleMechanicsConfig
): number {
  const rawMultiplier = Number(config.rage_crit_multiplier);
  const multiplier = rawMultiplier === 2 || rawMultiplier === 3 ? rawMultiplier : 3;
  return baseDamage * multiplier;
}

/**
 * Calculate expected damage per hit including crit chance
 *
 * @param baseDamage - Base damage amount
 * @param rage - Rage percentage (0-100)
 * @param config - Battle mechanics configuration
 * @returns Expected damage per hit
 */
export function getExpectedDamagePerHit(
  baseDamage: number,
  rage: number,
  config: BattleMechanicsConfig
): number {
  if (!config.rage_enabled) {
    return baseDamage;
  }

  const critChance = rage / 100;
  const normalChance = 1 - critChance;
  const critDamage = baseDamage * config.rage_crit_multiplier;

  return critChance * critDamage + normalChance * baseDamage;
}

/**
 * Calculate total expected damage including focus (accuracy)
 *
 * @param baseDamage - Base damage amount
 * @param focus - Focus percentage (0-100)
 * @param rage - Rage percentage (0-100)
 * @param config - Battle mechanics configuration
 * @returns Expected damage per action
 */
export function getExpectedDamagePerAction(
  baseDamage: number,
  focus: number,
  rage: number,
  config: BattleMechanicsConfig
): number {
  const hitChance = focus / 100;
  const damagePerHit = getExpectedDamagePerHit(baseDamage, rage, config);

  return hitChance * damagePerHit;
}

/**
 * Get rage status for UI display
 *
 * @param rage - Rage percentage (0-100)
 * @returns Status object
 */
export function getRageStatus(rage: number): {
  level: "none" | "low" | "medium" | "high" | "furious";
  color: "gray" | "yellow" | "orange" | "red" | "crimson";
  description: string;
  icon: string;
} {
  if (rage >= 80) {
    return {
      level: "furious",
      color: "crimson",
      description: "Furious rage - devastating crits",
      icon: "🔥🔥🔥",
    };
  } else if (rage >= 60) {
    return {
      level: "high",
      color: "red",
      description: "High rage - frequent crits",
      icon: "🔥🔥",
    };
  } else if (rage >= 40) {
    return {
      level: "medium",
      color: "orange",
      description: "Moderate rage - occasional crits",
      icon: "🔥",
    };
  } else if (rage >= 20) {
    return {
      level: "low",
      color: "yellow",
      description: "Low rage - rare crits",
      icon: "✨",
    };
  } else {
    return {
      level: "none",
      color: "gray",
      description: "Calm - no crit chance",
      icon: "",
    };
  }
}

/**
 * Get rage decay amount per hour
 *
 * @param config - Battle mechanics configuration
 * @returns Decay amount
 */
export function getRageDecayPerHour(config: BattleMechanicsConfig): number {
  return config.rage_decay_per_hour;
}

/**
 * Estimate time until rage decays to zero
 *
 * @param currentRage - Current rage amount
 * @param config - Battle mechanics configuration
 * @returns Hours until zero rage
 */
export function getTimeUntilRageZero(
  currentRage: number,
  config: BattleMechanicsConfig
): number {
  if (currentRage <= 0) return 0;

  const decayPerHour = getRageDecayPerHour(config);
  if (decayPerHour <= 0) return Infinity;

  return Math.ceil(currentRage / decayPerHour);
}

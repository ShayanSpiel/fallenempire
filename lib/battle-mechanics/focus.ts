// Battle Mechanics System: Focus (Accuracy) Module
// Version: 1.0
// Date: December 29, 2025

import { BattleMechanicsConfig } from "./types";

/**
 * Calculate focus (accuracy) from morale
 * Focus = Morale × Ratio (default 1:1)
 *
 * @param morale - User's current morale (0-100)
 * @param config - Battle mechanics configuration
 * @returns Focus percentage (0-100)
 */
export function calculateFocus(
  morale: number,
  config: BattleMechanicsConfig
): number {
  if (!config.focus_enabled) {
    return 100; // Always hit if focus disabled
  }

  const ratio = config.focus_morale_ratio;
  const focus = morale * ratio;

  return Math.max(0, Math.min(100, focus));
}

/**
 * Check if an attack hits based on focus
 * Uses random number generation (0-100)
 *
 * @param focus - Focus percentage (0-100)
 * @returns Whether attack hits
 */
export function checkFocusHit(focus: number): boolean {
  const roll = Math.random() * 100;
  return roll < focus;
}

/**
 * Calculate expected hit rate from morale
 * Useful for UI display and strategic planning
 *
 * @param morale - User's current morale (0-100)
 * @param config - Battle mechanics configuration
 * @returns Expected hit rate percentage (0-100)
 */
export function getExpectedHitRate(
  morale: number,
  config: BattleMechanicsConfig
): number {
  return calculateFocus(morale, config);
}

/**
 * Get focus status for UI display
 *
 * @param focus - Focus percentage (0-100)
 * @returns Status object
 */
export function getFocusStatus(focus: number): {
  level: "critical" | "low" | "medium" | "high" | "excellent";
  color: "red" | "orange" | "yellow" | "green" | "blue";
  description: string;
} {
  if (focus >= 90) {
    return {
      level: "excellent",
      color: "blue",
      description: "Nearly perfect accuracy",
    };
  } else if (focus >= 70) {
    return {
      level: "high",
      color: "green",
      description: "High accuracy",
    };
  } else if (focus >= 50) {
    return {
      level: "medium",
      color: "yellow",
      description: "Moderate accuracy",
    };
  } else if (focus >= 30) {
    return {
      level: "low",
      color: "orange",
      description: "Low accuracy, many misses",
    };
  } else {
    return {
      level: "critical",
      color: "red",
      description: "Critical accuracy, most attacks miss",
    };
  }
}

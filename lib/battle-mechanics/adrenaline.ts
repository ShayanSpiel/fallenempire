// Battle Mechanics System: Adrenaline Rule (Final Stand)
// Version: 1.0
// Date: January 3, 2027
// Description: Dynamic adrenaline bonus for defenders in final 33% of battle

import type {
  AdrenalineConfig,
  AdrenalineState,
  AdrenalineInput,
} from "./types";

/**
 * Check if battle is in the final stand window
 * @param started_at - Battle start timestamp
 * @param ends_at - Battle end timestamp
 * @param final_stand_window_percent - Percentage of battle time (from end) when adrenaline activates
 * @param currentTimeMs - Current time in milliseconds (defaults to Date.now())
 * @returns True if we're in the final stand window
 */
export function isInFinalStandWindow(
  started_at: string,
  ends_at: string,
  final_stand_window_percent: number,
  currentTimeMs: number = Date.now()
): boolean {
  const startMs = new Date(started_at).getTime();
  const endMs = new Date(ends_at).getTime();
  const totalDuration = endMs - startMs;
  const elapsed = currentTimeMs - startMs;
  const percentElapsed = (elapsed / totalDuration) * 100;

  // We're in final stand window if we've elapsed (100 - final_stand_window_percent)%
  // E.g., if final_stand_window_percent = 33, we activate at 67% elapsed
  const threshold = 100 - final_stand_window_percent;

  return percentElapsed >= threshold && percentElapsed <= 100;
}

/**
 * Check if damage difference condition is met
 * @param attacker_score - Total damage dealt by attackers
 * @param defender_score - Total damage dealt by defenders
 * @param damage_threshold_ratio - Required ratio (attacker/defender)
 * @returns True if attacker damage exceeds defender damage by threshold
 */
export function checkDamageDifferenceCondition(
  attacker_score: number,
  defender_score: number,
  damage_threshold_ratio: number
): boolean {
  // If defender has done no damage, condition is automatically met
  if (defender_score === 0 && attacker_score > 0) {
    return true;
  }

  // If attacker has done no damage, condition is not met
  if (attacker_score === 0) {
    return false;
  }

  const ratio = attacker_score / Math.max(1, defender_score);
  return ratio >= damage_threshold_ratio;
}

/**
 * Calculate damage ratio (for UI display)
 * @param attacker_score - Total damage dealt by attackers
 * @param defender_score - Total damage dealt by defenders
 * @returns Damage ratio (attacker/defender), capped at 999
 */
export function calculateDamageRatio(
  attacker_score: number,
  defender_score: number
): number {
  if (defender_score === 0 && attacker_score > 0) {
    return 999; // Effectively infinite
  }

  if (attacker_score === 0) {
    return 0;
  }

  const ratio = attacker_score / Math.max(1, defender_score);
  return Math.min(999, ratio);
}

/**
 * Calculate percent of final stand window elapsed
 * @param started_at - Battle start timestamp
 * @param ends_at - Battle end timestamp
 * @param final_stand_window_percent - Percentage of battle time (from end)
 * @param currentTimeMs - Current time in milliseconds
 * @returns Percent of final stand window elapsed (0-100)
 */
export function calculateFinalStandProgress(
  started_at: string,
  ends_at: string,
  final_stand_window_percent: number,
  currentTimeMs: number = Date.now()
): number {
  const startMs = new Date(started_at).getTime();
  const endMs = new Date(ends_at).getTime();
  const totalDuration = endMs - startMs;
  const elapsed = currentTimeMs - startMs;
  const percentElapsed = (elapsed / totalDuration) * 100;

  const threshold = 100 - final_stand_window_percent;

  // If before window, return 0
  if (percentElapsed < threshold) {
    return 0;
  }

  // If after window (battle ended), return 100
  if (percentElapsed > 100) {
    return 100;
  }

  // Calculate progress within the final stand window
  const windowProgress = ((percentElapsed - threshold) / final_stand_window_percent) * 100;

  return Math.min(100, Math.max(0, windowProgress));
}

/**
 * Calculate bonus rage from cumulative time
 * @param cumulativeTimeMs - Total milliseconds condition has been met
 * @param totalBattleDurationMs - Total battle duration in milliseconds
 * @param rage_per_percent_time - Rage granted per 1% of battle time
 * @param max_rage - Maximum rage bonus
 * @returns Bonus rage (0 to max_rage)
 */
export function calculateBonusRage(
  cumulativeTimeMs: number,
  totalBattleDurationMs: number,
  rage_per_percent_time: number,
  max_rage: number
): number {
  if (totalBattleDurationMs === 0 || cumulativeTimeMs === 0) {
    return 0;
  }

  const percentOfBattle = (cumulativeTimeMs / totalBattleDurationMs) * 100;
  const bonusRage = percentOfBattle * rage_per_percent_time;

  return Math.min(max_rage, Math.max(0, Math.floor(bonusRage)));
}

/**
 * Calculate complete adrenaline state
 * @param input - Adrenaline calculation input
 * @returns Complete adrenaline state
 */
export function calculateAdrenalineState(
  input: AdrenalineInput
): AdrenalineState {
  const { battle, config, currentTimeMs = Date.now(), previousState } = input;

  // Default disabled state
  const disabledState: AdrenalineState = {
    isInWindow: false,
    conditionMet: false,
    cumulativeTimeMs: 0,
    bonusRage: 0,
    percentElapsed: 0,
    damageRatio: 0,
  };

  // Check if adrenaline is enabled
  if (!config.enabled) {
    return disabledState;
  }

  // Check if battle is active
  if (battle.status !== "active") {
    return disabledState;
  }

  // Check if we're in the final stand window
  const isInWindow = isInFinalStandWindow(
    battle.started_at,
    battle.ends_at,
    config.final_stand_window_percent,
    currentTimeMs
  );

  if (!isInWindow) {
    return {
      ...disabledState,
      damageRatio: calculateDamageRatio(
        battle.attacker_score,
        battle.defender_score
      ),
    };
  }

  // Check if damage difference condition is met
  const conditionMet = checkDamageDifferenceCondition(
    battle.attacker_score,
    battle.defender_score,
    config.damage_threshold_ratio
  );

  // Calculate damage ratio for UI
  const damageRatio = calculateDamageRatio(
    battle.attacker_score,
    battle.defender_score
  );

  // Use previous cumulative time as base
  const baseCumulativeTimeMs = previousState?.cumulativeTimeMs ?? 0;

  // Calculate total battle duration
  const totalBattleDurationMs =
    new Date(battle.ends_at).getTime() - new Date(battle.started_at).getTime();

  // Calculate bonus rage
  const bonusRage = calculateBonusRage(
    baseCumulativeTimeMs,
    totalBattleDurationMs,
    config.rage_per_percent_time,
    config.max_rage
  );

  // Calculate percent of final stand window elapsed
  const percentElapsed = calculateFinalStandProgress(
    battle.started_at,
    battle.ends_at,
    config.final_stand_window_percent,
    currentTimeMs
  );

  return {
    isInWindow,
    conditionMet,
    cumulativeTimeMs: baseCumulativeTimeMs,
    bonusRage,
    percentElapsed,
    damageRatio,
  };
}

/**
 * Update adrenaline state with time delta
 * Call this every interval to increment cumulative time when condition is met
 * @param currentState - Current adrenaline state
 * @param deltaMs - Milliseconds elapsed since last update
 * @returns Updated adrenaline state
 */
export function updateAdrenalineState(
  currentState: AdrenalineState,
  deltaMs: number
): AdrenalineState {
  // Only accumulate time if condition is currently met and we're in window
  if (!currentState.isInWindow || !currentState.conditionMet) {
    return currentState;
  }

  const newCumulativeTimeMs = currentState.cumulativeTimeMs + deltaMs;

  return {
    ...currentState,
    cumulativeTimeMs: newCumulativeTimeMs,
  };
}

/**
 * Get adrenaline config from battle mechanics config
 * @param fullConfig - Full battle mechanics config
 * @returns Adrenaline config
 */
export function extractAdrenalineConfig(fullConfig: any): AdrenalineConfig {
  return {
    enabled: fullConfig.adrenaline_enabled ?? true,
    final_stand_window_percent:
      fullConfig.adrenaline_final_stand_window_percent ?? 33,
    damage_threshold_ratio: fullConfig.adrenaline_damage_threshold_ratio ?? 2.0,
    rage_per_percent_time: fullConfig.adrenaline_rage_per_percent_time ?? 1,
    max_rage: fullConfig.adrenaline_max_rage ?? 33,
    check_interval_seconds:
      fullConfig.adrenaline_check_interval_seconds ?? 10,
  };
}

/**
 * Format adrenaline state for display
 * @param state - Adrenaline state
 * @returns Formatted display data
 */
export function formatAdrenalineDisplay(state: AdrenalineState): {
  isActive: boolean;
  bonusRage: number;
  progressPercent: number;
  damageRatioText: string;
} {
  return {
    isActive: state.isInWindow && state.conditionMet,
    bonusRage: state.bonusRage,
    progressPercent: state.percentElapsed,
    damageRatioText:
      state.damageRatio >= 999
        ? "∞"
        : state.damageRatio.toFixed(1) + "x",
  };
}

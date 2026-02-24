/**
 * MORALE SYSTEM CONFIGURATION
 * All morale-related constants and thresholds
 * Zero hardcoding: Change values here to affect entire game
 */

// ==================== CORE CONSTANTS ====================

export const MORALE_CONSTANTS = {
  /** Minimum morale value */
  MIN: 0,
  /** Maximum morale value */
  MAX: 100,
  /** Default/neutral morale value */
  NEUTRAL: 50,
  /** Morale threshold below which rebellion behavior triggers */
  REBELLION_THRESHOLD: 20,
  /** Multiplier for chaos effects when morale is low */
  REBELLION_CHAOS_MULTIPLIER: 1.5,
  /** Morale threshold above which celebration/bonus effects trigger */
  CELEBRATION_THRESHOLD: 80,
} as const;

/**
 * Maximum morale delta granted/penalized by a single action event
 */
export const ACTION_MORALE_STEP = 0.5;

// ==================== ACTION MORALE IMPACTS ====================

/**
 * Default morale changes for different action types
 * Positive = morale boost, Negative = morale drain
 * These are fallback values if action_definitions table doesn't override
 */
export const ACTION_MORALE_DEFAULTS: Record<string, number> = {
  // Combat actions (draining)
  ATTACK: -0.5,
  REBEL: 0.5, // Rebellion empowers the rebellious
  DECLARE_WAR: -0.5,

  // Social actions (uplifting)
  LIKE: 0.5,
  DISLIKE: -0.5,
  FOLLOW: 0.5,
  COMMENT: 0.5,
  CREATE_POST: 0.5,

  // Economic actions (neutral to positive)
  TRADE: 0.5,
  TRADE_AGREEMENT: 0.5,

  // Diplomatic actions (strongly positive)
  FORM_ALLIANCE: 0.5,
} as const;

// ==================== BATTLE MORALE ====================

export const BATTLE_MORALE = {
  /** Morale change for battle winner */
  WINNER_CHANGE: 5,
  /** Morale change for battle loser (negative) */
  LOSER_CHANGE: -10,
} as const;

// ==================== COHERENCE ADJUSTMENT ====================

/**
 * How coherence (identity alignment) affects morale impact
 * High coherence = action matches identity = less guilt
 */
export const COHERENCE_ADJUSTMENT = {
  /** Coherence threshold above which negative morale is reduced */
  HIGH_COHERENCE_THRESHOLD: 0.5,
  /** Coherence threshold below which negative morale is amplified */
  LOW_COHERENCE_THRESHOLD: -0.5,
  /** Maximum reduction of negative morale when highly coherent (0-1) */
  MAX_REDUCTION_FACTOR: 0.5, // 50% reduction
  /** Maximum amplification of negative morale when incoherent (0-1) */
  MAX_AMPLIFICATION_FACTOR: 0.25, // 25% amplification
  /** Scaling factor for coherence-based reduction */
  REDUCTION_SCALE: 2.0, // (coherence - 0.5) * 2 = 0 to 1
  /** Scaling factor for coherence-based amplification */
  AMPLIFICATION_SCALE: 0.5, // (-coherence - 0.5) * 0.5 = 0 to 0.25
} as const;

// ==================== MORALE CLAMPS ====================

/**
 * Safety limits for morale changes to prevent exploits
 */
export const MORALE_CLAMPS = {
  /** Maximum morale change per single event (positive) */
  MAX_CHANGE: 50,
  /** Maximum morale change per single event (negative) */
  MIN_CHANGE: -50,
} as const;

// ==================== MORALE MULTIPLIERS ====================

/**
 * How morale affects other game metrics
 */
export const MORALE_MULTIPLIERS = {
  /** Base multiplier when morale is at MIN (0) */
  MIN_MULTIPLIER: 0.5,
  /** Additional multiplier range (added to base) */
  MULTIPLIER_RANGE: 1.0, // Total range: 0.5 to 1.5
} as const;

// ==================== BEHAVIOR LABELS ====================

/**
 * Thresholds for morale-based behavior labels
 * Used for UI display and narrative
 */
export const MORALE_BEHAVIOR_THRESHOLDS = {
  ECSTATIC: 80,
  HAPPY: 60,
  CONTENT: 40,
  DISCOURAGED: 20,
  // Below 20 = Rebellious
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get morale multiplier for psychology calculations
 * Maps morale 0-100 to multiplier 0.5-1.5
 */
export function getMoraleMultiplierFromValue(morale: number): number {
  const clamped = Math.max(
    MORALE_CONSTANTS.MIN,
    Math.min(MORALE_CONSTANTS.MAX, morale)
  );
  return (
    MORALE_MULTIPLIERS.MIN_MULTIPLIER +
    (clamped / MORALE_CONSTANTS.MAX) * MORALE_MULTIPLIERS.MULTIPLIER_RANGE
  );
}

/**
 * Get morale-based behavior label
 */
export function getMoraleBehaviorLabelFromValue(morale: number): string {
  if (morale >= MORALE_BEHAVIOR_THRESHOLDS.ECSTATIC) return "Ecstatic";
  if (morale >= MORALE_BEHAVIOR_THRESHOLDS.HAPPY) return "Happy";
  if (morale >= MORALE_BEHAVIOR_THRESHOLDS.CONTENT) return "Content";
  if (morale >= MORALE_BEHAVIOR_THRESHOLDS.DISCOURAGED) return "Discouraged";
  return "Rebellious";
}

/**
 * Calculate chaos probability from morale value
 * Morale >= 20: 0% chaos (normal behavior)
 * Morale < 20: scales from 0% to 100% as morale drops to 0
 */
export function getChaosProbabilityFromMorale(morale: number): number {
  if (morale >= MORALE_CONSTANTS.REBELLION_THRESHOLD) {
    return 0;
  }
  // Maps 20->0%, 10->50%, 0->100%
  const chaosRange =
    (MORALE_CONSTANTS.REBELLION_THRESHOLD - morale) /
    MORALE_CONSTANTS.REBELLION_THRESHOLD;
  return Math.min(100, chaosRange * 100);
}

/**
 * Adjust morale impact based on coherence
 * High coherence (action matches identity) reduces negative morale impact
 */
export function adjustMoraleForCoherence(
  baseMoraleDelta: number,
  coherence: number
): number {
  // If coherence > threshold AND action is negative: reduce impact
  if (
    baseMoraleDelta < 0 &&
    coherence > COHERENCE_ADJUSTMENT.HIGH_COHERENCE_THRESHOLD
  ) {
    const reduction =
      (coherence - COHERENCE_ADJUSTMENT.HIGH_COHERENCE_THRESHOLD) *
      COHERENCE_ADJUSTMENT.REDUCTION_SCALE;
    return baseMoraleDelta * (1 - reduction * COHERENCE_ADJUSTMENT.MAX_REDUCTION_FACTOR);
  }

  // If coherence < threshold AND action is negative: amplify impact
  if (
    baseMoraleDelta < 0 &&
    coherence < COHERENCE_ADJUSTMENT.LOW_COHERENCE_THRESHOLD
  ) {
    const amplification =
      (-coherence - COHERENCE_ADJUSTMENT.HIGH_COHERENCE_THRESHOLD) *
      COHERENCE_ADJUSTMENT.AMPLIFICATION_SCALE;
    return baseMoraleDelta * (1 + amplification);
  }

  return baseMoraleDelta;
}

// ==================== TYPE EXPORTS ====================

export type MoraleAction = keyof typeof ACTION_MORALE_DEFAULTS;
export type MoraleBehaviorLabel = ReturnType<typeof getMoraleBehaviorLabelFromValue>;

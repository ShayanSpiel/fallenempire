/**
 * PSYCHOLOGY SYSTEM CONFIGURATION
 * All psychology-related constants, archetypes, and formulas
 * Zero hardcoding: Change values here to affect entire game
 */

import type { IdentityVector } from "./psychology";

// ==================== JUNG ARCHETYPES ====================

/**
 * 12 classic Jungian archetypes with 5D personality vectors
 * Used for identity label generation via cosine similarity matching
 */
export const JUNG_ARCHETYPES: Record<string, IdentityVector> = {
  Warrior: {
    order_chaos: 0.7,
    self_community: 0.5,
    logic_emotion: 0.4,
    power_harmony: 0.9,
    tradition_innovation: 0.2,
  },
  Rebel: {
    order_chaos: -0.9,
    self_community: 0.7,
    logic_emotion: 0.3,
    power_harmony: 0.8,
    tradition_innovation: 0.9,
  },
  Caregiver: {
    order_chaos: 0.4,
    self_community: -0.7,
    logic_emotion: -0.5,
    power_harmony: -0.8,
    tradition_innovation: 0.3,
  },
  Sage: {
    order_chaos: 0.5,
    self_community: -0.2,
    logic_emotion: 0.9,
    power_harmony: -0.2,
    tradition_innovation: 0.5,
  },
  Magician: {
    order_chaos: 0,
    self_community: 0.3,
    logic_emotion: 0.8,
    power_harmony: 0.6,
    tradition_innovation: 0.8,
  },
  Lover: {
    order_chaos: 0,
    self_community: -0.6,
    logic_emotion: -0.7,
    power_harmony: 0.8,
    tradition_innovation: 0,
  },
  Jester: {
    order_chaos: -0.8,
    self_community: 0.1,
    logic_emotion: -0.2,
    power_harmony: -0.4,
    tradition_innovation: 0.8,
  },
  Ruler: {
    order_chaos: 0.8,
    self_community: 0.7,
    logic_emotion: 0.5,
    power_harmony: 0.9,
    tradition_innovation: 0.7,
  },
  Innocent: {
    order_chaos: 0.6,
    self_community: -0.5,
    logic_emotion: -0.4,
    power_harmony: -0.7,
    tradition_innovation: -0.6,
  },
  Explorer: {
    order_chaos: -0.3,
    self_community: 0.6,
    logic_emotion: 0.2,
    power_harmony: 0.3,
    tradition_innovation: 0.7,
  },
  Creator: {
    order_chaos: -0.4,
    self_community: 0.4,
    logic_emotion: 0.6,
    power_harmony: 0.2,
    tradition_innovation: 0.9,
  },
  Hero: {
    order_chaos: 0.8,
    self_community: -0.3,
    logic_emotion: 0.5,
    power_harmony: 0.7,
    tradition_innovation: 0.4,
  },
} as const;

// ==================== ACTION VECTORS ====================

/**
 * Personality vectors associated with different action types
 * Used for coherence calculation (does action match identity?)
 */
export const ACTION_VECTORS: Record<string, Partial<IdentityVector>> = {
  ATTACK: {
    power_harmony: 0.8,
    order_chaos: 0.5,
  },
  TRADE: {
    power_harmony: -0.5,
    logic_emotion: 0.6,
    self_community: -0.4,
  },
  LIKE: {
    power_harmony: -0.2,
  },
  DISLIKE: {
    power_harmony: 0.2,
  },
  FOLLOW: {
    self_community: -0.6,
  },
  CHAT: {
    self_community: -0.3, // Slightly social/community-oriented
    logic_emotion: -0.2,  // Slightly emotional/conversational
  },
  COMMENT: {
    self_community: -0.4, // Social engagement
    logic_emotion: -0.1,
  },
  CREATE_POST: {
    self_community: -0.2,
    tradition_innovation: 0.1, // Slight creative bias
  },
} as const;

// ==================== COHERENCE CALCULATION ====================

/**
 * Weights for coherence formula: C = (w1 × R) + (w2 × A)
 * Where R = message-identity similarity, A = action-identity similarity
 */
export const COHERENCE_WEIGHTS = {
  /** Weight for rhetoric/message alignment */
  MESSAGE_WEIGHT: 0.5,
  /** Weight for action alignment */
  ACTION_WEIGHT: 0.5,
} as const;

// ==================== FREEWILL CALCULATION ====================

/**
 * Freewill formula constants
 * F = (Aq × MoraleMultiplier) + HumanBonus + (CoherenceWeight × C)
 */
export const FREEWILL_CONSTANTS = {
  /** Bonus freewill for human players (bots get 0) */
  HUMAN_BONUS: 50,
  /** Weight multiplier for coherence contribution */
  COHERENCE_WEIGHT: 30,
  /** Minimum freewill value */
  MIN: 1,
  /** Maximum freewill value */
  MAX: 100,
} as const;

// ==================== MORALE MULTIPLIER ====================

/**
 * How morale affects freewill calculation
 * MoraleMultiplier = BASE + (morale / DIVISOR)
 * Maps morale 0-100 to multiplier 0.5-1.5
 */
export const MORALE_MULTIPLIER_FORMULA = {
  /** Base multiplier (at morale=0) */
  BASE: 0.5,
  /** Divisor for morale scaling */
  DIVISOR: 100.0,
  /** Range: 0.5 (depressed) to 1.5 (ecstatic) */
} as const;

// ==================== PHYSICAL POWER ====================

/**
 * Physical power formula constants
 * PP = BasePower × MoraleMultiplier × CoherenceMultiplier
 */
export const PHYSICAL_POWER_FORMULA = {
  /** Default base power if not specified */
  DEFAULT_BASE: 50,
  /** Morale divisor: (1 + morale / MORALE_DIVISOR) */
  MORALE_DIVISOR: 200,
  /** Coherence divisor: (1 + coherence / COHERENCE_DIVISOR) */
  COHERENCE_DIVISOR: 2,
  /** Minimum physical power */
  MIN: 0,
  /** Maximum physical power */
  MAX: 150,
} as const;

// ==================== MENTAL POWER (Moving Average) ====================

/**
 * Mental Power calculation from coherence history
 * MP = BASELINE + (AvgCoherence × SCALE)
 * Converts coherence -1..1 to MP 0..100
 */
export const MENTAL_POWER_FORMULA = {
  /** Baseline (neutral) mental power */
  BASELINE: 50,
  /** Scale factor for coherence contribution */
  SCALE: 50,
  /** Default if no history */
  DEFAULT: 50,
  /** Minimum mental power */
  MIN: 0,
  /** Maximum mental power */
  MAX: 100,
} as const;

// ==================== HEAT SYSTEM (Spam Protection) ====================

/**
 * Heat-based spam protection
 * Heat accumulates with actions, decays over time
 */
export const HEAT_SYSTEM = {
  /** Heat added per action */
  HEAT_PER_ACTION: 10,
  /** Heat decay per minute */
  DECAY_PER_MINUTE: 5,
  /** Maximum heat value (hard cap) */
  MAX_HEAT: 200,
  /** Threshold above which actions are blocked */
  BLOCK_THRESHOLD: 100,
} as const;

// ==================== ACTIVITY SCORE ====================

/**
 * Activity score calculation (diversity metrics)
 * Rewards varied gameplay, punishes spam
 */
export const ACTIVITY_SCORE_FORMULA = {
  /** Number of unique action types assumed in game */
  TOTAL_ACTION_TYPES: 10,
  /** Penalty multiplier for spamming same action */
  SPAM_PENALTY: 0.5,
  /** Number of recent actions to check for spam pattern */
  SPAM_CHECK_COUNT: 3,
  /** Minimum activity score */
  MIN: 0,
  /** Maximum activity score */
  MAX: 100,
  /** Default activity score for new users */
  DEFAULT: 10,
} as const;

// ==================== IDENTITY BOUNDS ====================

/**
 * Valid ranges for identity vector values
 */
export const IDENTITY_BOUNDS = {
  MIN: -1.0,
  MAX: 1.0,
  NEUTRAL: 0.0,
} as const;

// ==================== PRECISION ====================

/**
 * Decimal precision for calculations
 */
export const PRECISION = {
  /** Decimal places for coherence/similarity values */
  SIMILARITY: 3,
  /** Decimal places for morale multiplier */
  MULTIPLIER: 2,
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get morale multiplier for freewill calculation
 * Maps morale 0-100 to multiplier 0.5-1.5
 */
export function getMoraleMultiplierValue(morale: number): number {
  const clamped = Math.max(0, Math.min(100, morale));
  return MORALE_MULTIPLIER_FORMULA.BASE + clamped / MORALE_MULTIPLIER_FORMULA.DIVISOR;
}

/**
 * Calculate mental power from average coherence
 * Converts coherence -1..1 to MP 0..100
 */
export function calculateMentalPowerFromCoherence(avgCoherence: number): number {
  const mp = MENTAL_POWER_FORMULA.BASELINE + avgCoherence * MENTAL_POWER_FORMULA.SCALE;
  return Math.max(
    MENTAL_POWER_FORMULA.MIN,
    Math.min(MENTAL_POWER_FORMULA.MAX, Math.round(mp))
  );
}

/**
 * Calculate physical power multipliers
 * Returns { morale, coherence } multipliers
 */
export function getPhysicalPowerMultipliers(morale: number, coherence: number): {
  morale: number;
  coherence: number;
} {
  return {
    morale: 1 + morale / PHYSICAL_POWER_FORMULA.MORALE_DIVISOR,
    coherence: 1 + coherence / PHYSICAL_POWER_FORMULA.COHERENCE_DIVISOR,
  };
}

/**
 * Calculate heat decay based on time elapsed
 */
export function calculateHeatDecayAmount(minutesElapsed: number): number {
  return minutesElapsed * HEAT_SYSTEM.DECAY_PER_MINUTE;
}

/**
 * Check if action is allowed based on current heat
 */
export function isHeatUnderThreshold(currentHeat: number): boolean {
  return currentHeat <= HEAT_SYSTEM.BLOCK_THRESHOLD;
}

/**
 * Add heat for new action
 */
export function addActionHeat(currentHeat: number): number {
  return Math.min(HEAT_SYSTEM.MAX_HEAT, currentHeat + HEAT_SYSTEM.HEAT_PER_ACTION);
}

// ==================== TYPE EXPORTS ====================

export type ArchetypeName = keyof typeof JUNG_ARCHETYPES;
export type ActionType = keyof typeof ACTION_VECTORS;

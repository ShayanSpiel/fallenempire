import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  JUNG_ARCHETYPES,
  ACTION_VECTORS,
  COHERENCE_WEIGHTS,
  FREEWILL_CONSTANTS,
  MORALE_MULTIPLIER_FORMULA,
  PHYSICAL_POWER_FORMULA,
  MENTAL_POWER_FORMULA,
  HEAT_SYSTEM,
  ACTIVITY_SCORE_FORMULA,
  IDENTITY_BOUNDS,
  getMoraleMultiplierValue,
  calculateMentalPowerFromCoherence as calcMPFromCoherence,
  getPhysicalPowerMultipliers,
  calculateHeatDecayAmount,
  isHeatUnderThreshold,
  addActionHeat as addHeat,
} from "./psychology-config";

// AgentResources type (migrated from deleted ai/core/types.ts)
export type AgentResources = {
  mental?: number;
  physical?: number;
  social?: number;
};

// --- 1. TYPES & CONSTANTS ---

export type TraitKey =
  | "order_chaos"
  | "self_community"
  | "logic_emotion"
  | "power_harmony"
  | "tradition_innovation";

// Range: -1.0 to 1.0
export type IdentityVector = Record<TraitKey, number>;

export const DEFAULT_IDENTITY_VECTOR: IdentityVector = {
  order_chaos: IDENTITY_BOUNDS.NEUTRAL,
  self_community: IDENTITY_BOUNDS.NEUTRAL,
  logic_emotion: IDENTITY_BOUNDS.NEUTRAL,
  power_harmony: IDENTITY_BOUNDS.NEUTRAL,
  tradition_innovation: IDENTITY_BOUNDS.NEUTRAL,
};

// JUNG_ARCHETYPES is now imported from psychology-config.ts
export { JUNG_ARCHETYPES };

// --- 2. VECTOR MATH ---

export function dotProduct(a: IdentityVector, b: IdentityVector): number {
  let sum = 0;
  for (const k in a) {
    const key = k as TraitKey;
    sum += (a[key] || 0) * (b[key] || 0);
  }
  return parseFloat((sum / 5).toFixed(3));
}

/**
 * TRUE COSINE SIMILARITY - Properly normalized
 * Returns -1.0 (complete opposition) to +1.0 (perfect alignment)
 */
export function cosineSimilarity(a: IdentityVector, b: IdentityVector): number {
  let dotProd = 0;
  let magA = 0;
  let magB = 0;

  for (const k in a) {
    const key = k as TraitKey;
    const aVal = a[key] || 0;
    const bVal = b[key] || 0;
    dotProd += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) return 0;
  return parseFloat((dotProd / (magA * magB)).toFixed(3));
}

export function getActionVector(action: string): IdentityVector {
  const base = { ...DEFAULT_IDENTITY_VECTOR };
  const actionConfig = ACTION_VECTORS[action as keyof typeof ACTION_VECTORS];

  if (!actionConfig) {
    return base;
  }

  return { ...base, ...actionConfig };
}

// --- 3. FORMULAS ---

type CalculationInput = {
  identity: IdentityVector;
  message: IdentityVector;
  action: IdentityVector;
  isHuman: boolean;
  activityScore?: number;
  morale?: number; // NEW: morale 0-100, affects willpower multiplier
};

export type PsychologyResult = {
  coherence: number;
  freewill: number;
  mentalPower: number;
  reasoning: number;
  moraleMultiplier?: number; // NEW: debug info
};

/**
 * Get morale multiplier for free will calculation
 * Maps morale 0-100 to multiplier 0.5-1.5
 * At morale=50, multiplier is 1.0 (neutral)
 * At morale=100, multiplier is 1.5 (happy, stronger will)
 * At morale=0, multiplier is 0.5 (depressed, weaker will)
 * Now imported from psychology-config.ts
 */
function getMoraleMultiplier(morale: number = 50): number {
  return getMoraleMultiplierValue(morale);
}

export function calculateFreewillFromSignals(input: {
  activityScore: number;
  coherence: number;
  morale?: number;
  isHuman?: boolean;
}): number {
  const moraleMultiplier = getMoraleMultiplier(input.morale ?? 50);
  const humanBonus = input.isHuman === false ? 0 : FREEWILL_CONSTANTS.HUMAN_BONUS;

  let freewill =
    input.activityScore * moraleMultiplier +
    humanBonus +
    FREEWILL_CONSTANTS.COHERENCE_WEIGHT * input.coherence;

  freewill = Math.max(
    FREEWILL_CONSTANTS.MIN,
    Math.min(FREEWILL_CONSTANTS.MAX, Math.round(freewill))
  );

  return freewill;
}

export function calculatePsychometrics(input: CalculationInput): PsychologyResult {
  // Use TRUE cosine similarity (normalized -1 to +1)
  const R = cosineSimilarity(input.message, input.identity);
  const actionAlignment = cosineSimilarity(input.action, input.identity);
  // Balance actions and messages using config weights
  const C =
    COHERENCE_WEIGHTS.MESSAGE_WEIGHT * R +
    COHERENCE_WEIGHTS.ACTION_WEIGHT * actionAlignment;
  const H = input.isHuman ? FREEWILL_CONSTANTS.HUMAN_BONUS : 0;
  const Aq = input.activityScore ?? ACTIVITY_SCORE_FORMULA.DEFAULT;

  // Apply morale multiplier to activity score
  // High morale amplifies activity, low morale dampens it
  const moraleMultiplier = getMoraleMultiplier(input.morale);

  const F = calculateFreewillFromSignals({
    activityScore: Aq,
    coherence: C,
    morale: input.morale,
    isHuman: input.isHuman,
  });
  let MP = F * Math.max(0, C);
  MP = Math.max(
    MENTAL_POWER_FORMULA.MIN,
    Math.min(MENTAL_POWER_FORMULA.MAX, Math.round(MP))
  );
  return {
    coherence: C,
    freewill: F,
    mentalPower: MP,
    reasoning: R,
    moraleMultiplier: parseFloat(moraleMultiplier.toFixed(2)),
  };
}

// REMOVED: calculateDecisionWeight (unused - voting has proper role-based structure)

type CoherenceInput = {
  identity: IdentityVector;
  message: IdentityVector;
  isHuman: boolean;
  activityScore?: number;
  action?: IdentityVector;
};

export type CoherenceMetrics = {
  R: number;
  C: number;
  F: number;
  MP: number;
};

export type CoherenceOptions = {
  action?: string | IdentityVector;
  message?: IdentityVector;
  isHuman?: boolean;
  activityScore?: number;
  morale?: number;
  communityIdeology?: Record<string, number>;
};

function normalizeIdentityVector(input?: Record<string, number> | IdentityVector): IdentityVector {
  return {
    order_chaos: input?.order_chaos ?? 0,
    self_community: input?.self_community ?? 0,
    logic_emotion: input?.logic_emotion ?? 0,
    power_harmony: input?.power_harmony ?? 0,
    tradition_innovation: input?.tradition_innovation ?? 0,
  };
}

export function calculateCoherence(identity: IdentityVector, options: CoherenceOptions = {}): number {
  const actionVector =
    typeof options.action === "string"
      ? getActionVector(options.action)
      : options.action ?? DEFAULT_IDENTITY_VECTOR;

  const messageVector =
    options.message ??
    (options.communityIdeology
      ? normalizeIdentityVector(options.communityIdeology)
      : identity);

  const stats = calculatePsychometrics({
    identity,
    message: messageVector,
    action: actionVector,
    isHuman: options.isHuman ?? false,
    activityScore: options.activityScore,
    morale: options.morale,
  });

  return stats.coherence;
}

export function calculateCoherenceMetrics(input: CoherenceInput): CoherenceMetrics {
  const stats = calculatePsychometrics({
    identity: input.identity,
    message: input.message,
    action: input.action ?? DEFAULT_IDENTITY_VECTOR,
    isHuman: input.isHuman,
    activityScore: input.activityScore,
  });
  return {
    R: stats.reasoning,
    C: stats.coherence,
    F: stats.freewill,
    MP: stats.mentalPower,
  };
}

export function generateIdentityLabel(identity: IdentityVector): string {
  let best: { label: string; score: number } = { label: "Neutral", score: -Infinity };
  for (const [label, vector] of Object.entries(JUNG_ARCHETYPES)) {
    const score = cosineSimilarity(identity, vector);
    if (score > best.score) {
      best = { label, score };
    }
  }
  return best.label;
}

export function alignResourcesWithStats(
  resources: AgentResources,
  stats: PsychologyResult
): AgentResources {
  return {
    ...resources,
    mental: Math.max(0, Math.min(100, stats.mentalPower)),
  };
}

// ==================== HEAT SYSTEM (Spam Protection) ====================

/**
 * Calculate action heat decay
 * Heat decreases per minute based on config
 * @param lastActionTime Timestamp of last action
 * @param currentHeat Current heat value
 * @returns New heat after decay
 */
export function calculateHeatDecay(lastActionTime: Date | null, currentHeat: number): number {
  if (!lastActionTime) return 0;

  const now = new Date();
  const minutesElapsed = (now.getTime() - lastActionTime.getTime()) / (1000 * 60);
  const decayAmount = calculateHeatDecayAmount(minutesElapsed);

  return Math.max(0, currentHeat - decayAmount);
}

/**
 * Add heat to action queue
 * Each action adds heat based on config
 * Heat is capped to prevent overflow
 */
export function addActionHeat(currentHeat: number): number {
  return addHeat(currentHeat);
}

/**
 * Check if action is allowed based on heat
 * @param currentHeat Current heat value
 * @returns true if action allowed, false if blocked (spam)
 */
export function isActionAllowed(currentHeat: number): boolean {
  return isHeatUnderThreshold(currentHeat);
}

// ==================== ACTIVITY SCORE (Diversity Tracking) ====================

export interface ActionRecord {
  type: string;
  targetId: string;
  createdAt: Date;
}

/**
 * Calculate real Activity Score based on action diversity
 * Rewards varied gameplay, punishes spam
 * @param recentActions Last N actions
 * @returns Activity score 0-100
 */
export function calculateActivityScore(recentActions: ActionRecord[]): number {
  if (recentActions.length === 0) return ACTIVITY_SCORE_FORMULA.MAX;

  // Type diversity: how many different action types
  const actionTypes = new Set(recentActions.map((a) => a.type));
  const typeDiversity =
    (actionTypes.size / ACTIVITY_SCORE_FORMULA.TOTAL_ACTION_TYPES) * 100;

  // Target diversity: how many different targets
  const targets = new Set(recentActions.map((a) => a.targetId));
  const targetDiversity = (targets.size / recentActions.length) * 100;

  // Average diversity
  const baseDiversity = (typeDiversity + targetDiversity) / 2;

  // Penalty for immediate repetition (spam detection)
  let repetitionPenalty = 1.0;
  if (recentActions.length >= ACTIVITY_SCORE_FORMULA.SPAM_CHECK_COUNT) {
    const lastN = recentActions.slice(-ACTIVITY_SCORE_FORMULA.SPAM_CHECK_COUNT);
    if (
      lastN.every((a) => a.type === lastN[0].type && a.targetId === lastN[0].targetId)
    ) {
      repetitionPenalty = ACTIVITY_SCORE_FORMULA.SPAM_PENALTY;
    }
  }

  const finalScore = baseDiversity * repetitionPenalty;
  return Math.max(
    ACTIVITY_SCORE_FORMULA.MIN,
    Math.min(ACTIVITY_SCORE_FORMULA.MAX, Math.round(finalScore))
  );
}

// ==================== MOVING AVERAGE MENTAL POWER ====================

export interface CoherenceRecord {
  coherence: number;
  createdAt: Date;
}

/**
 * Calculate Mental Power using Moving Average of recent coherence
 * Stays between 0-100, reflects recent consistency
 * @param recentCoherence Last N coherence values
 * @returns Mental Power 0-100
 */
export function calculateMentalPowerMovingAverage(
  recentCoherence: CoherenceRecord[]
): number {
  if (recentCoherence.length === 0) return MENTAL_POWER_FORMULA.DEFAULT;

  // Calculate average coherence
  const avgCoherence =
    recentCoherence.reduce((sum, r) => sum + r.coherence, 0) /
    recentCoherence.length;

  // Convert -1..1 range to 0..100 using config formula
  return calcMPFromCoherence(avgCoherence);
}

/**
 * Get activity score from database for a user
 * Uses the get_activity_score() database function
 */
export async function getActivityScore(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("get_activity_score", {
    p_user_id: userId,
  });

  if (error) {
    console.error("Error getting activity score:", error);
    return ACTIVITY_SCORE_FORMULA.DEFAULT;
  }

  return data ?? ACTIVITY_SCORE_FORMULA.DEFAULT;
}

/**
 * Get user morale from database
 */
export async function getUserMorale(userId: string): Promise<number> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("morale")
    .eq("id", userId)
    .single();

  return user?.morale ?? 50; // Default to neutral morale
}

/**
 * Get psychology context for coherence calculation
 * Fetches activity score and morale from database
 */
export async function getPsychologyContext(userId: string): Promise<{
  activityScore: number;
  morale: number;
}> {
  const [activityScore, morale] = await Promise.all([
    getActivityScore(userId),
    getUserMorale(userId),
  ]);

  return { activityScore, morale };
}

// ==================== PHYSICAL POWER (Efficiency Model) ====================

/**
 * Calculate Physical Power
 * Uses mental state as a multiplier on physical output
 * PP = BasePower × MoraleMultiplier × CoherenceMultiplier
 *
 * Multipliers from config:
 * - Morale: (1 + morale / MORALE_DIVISOR)
 * - Coherence: (1 + coherence / COHERENCE_DIVISOR)
 */
export function calculatePhysicalPower(
  basePower: number = PHYSICAL_POWER_FORMULA.DEFAULT_BASE,
  morale: number,
  coherence: number
): number {
  const multipliers = getPhysicalPowerMultipliers(morale, coherence);
  const pp = basePower * multipliers.morale * multipliers.coherence;

  return Math.max(
    PHYSICAL_POWER_FORMULA.MIN,
    Math.min(PHYSICAL_POWER_FORMULA.MAX, Math.round(pp))
  );
}

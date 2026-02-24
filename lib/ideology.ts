/**
 * Identity & Ideology System - Core Library
 *
 * Handles all calculations for:
 * - Community ideology from member vectors
 * - Polarization detection
 * - Ideology interpretation
 * - Social friction
 */

import { IDEOLOGY_CONFIG, getGovernanceLabel, getEconomyLabel, getCultureLabel, getDecisionLabel } from './ideology-config'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface IdentityVector {
  order_chaos: number
  self_community: number
  logic_emotion: number
  power_harmony: number
  tradition_innovation: number
}

export interface PolarizationMetrics {
  overall: number        // 0-1: how split the community is
  polarizedAxes: string[] // Which axes have opposing camps
  clusters: number       // Number of ideological factions
  diversity: number      // 0-1: healthy variety (HIGH = good)
}

export interface IdeologyInterpretation {
  governance_style: string
  economic_system: string
  cultural_values: string
  decision_making: string
}

export interface CommunityIdeologyData {
  ideology_json: IdentityVector
  interpretation: IdeologyInterpretation
  polarization_metrics: PolarizationMetrics
  last_ideology_update: Date
}

// ============================================================================
// HELPER FUNCTIONS - Vector Math
// ============================================================================

/**
 * Calculate dot product of two vectors
 */
export function dotProduct(v1: IdentityVector, v2: IdentityVector): number {
  return (
    v1.order_chaos * v2.order_chaos +
    v1.self_community * v2.self_community +
    v1.logic_emotion * v2.logic_emotion +
    v1.power_harmony * v2.power_harmony +
    v1.tradition_innovation * v2.tradition_innovation
  )
}

/**
 * Calculate vector magnitude (length)
 */
export function magnitude(v: IdentityVector): number {
  return Math.sqrt(
    v.order_chaos ** 2 +
    v.self_community ** 2 +
    v.logic_emotion ** 2 +
    v.power_harmony ** 2 +
    v.tradition_innovation ** 2
  )
}

/**
 * Calculate cosine similarity (0 = opposite, 1 = identical)
 */
export function cosineSimilarity(v1: IdentityVector, v2: IdentityVector): number {
  const dot = dotProduct(v1, v2)
  const mag1 = magnitude(v1)
  const mag2 = magnitude(v2)

  if (mag1 === 0 || mag2 === 0) return 0

  return Math.max(0, Math.min(1, dot / (mag1 * mag2)))
}

/**
 * Calculate Euclidean distance between vectors
 * Used for alignment scoring
 */
export function vectorDistance(v1: IdentityVector, v2: IdentityVector): number {
  const diffs = [
    v1.order_chaos - v2.order_chaos,
    v1.self_community - v2.self_community,
    v1.logic_emotion - v2.logic_emotion,
    v1.power_harmony - v2.power_harmony,
    v1.tradition_innovation - v2.tradition_innovation,
  ]

  const sumSquares = diffs.reduce((sum, d) => sum + d * d, 0)
  return Math.sqrt(sumSquares)
}

/**
 * Blend vectors with weights (weighted average)
 */
export function blendVectors(vectors: IdentityVector[], weights: number[]): IdentityVector {
  if (vectors.length === 0) return createNeutralVector()
  if (vectors.length !== weights.length) {
    throw new Error('Vectors and weights must have same length')
  }

  const result = createNeutralVector()
  let totalWeight = 0

  for (const axis of ['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'] as const) {
    let weightedSum = 0

    for (let i = 0; i < vectors.length; i++) {
      weightedSum += (vectors[i][axis] || 0) * (weights[i] || 0)
      totalWeight += weights[i] || 0
    }

    result[axis] = totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  // Clamp values to [-1, 1]
  for (const axis of ['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'] as const) {
    result[axis] = Math.max(-1, Math.min(1, result[axis]))
  }

  return result
}

/**
 * Create neutral vector (all zeros)
 */
export function createNeutralVector(): IdentityVector {
  return {
    order_chaos: 0,
    self_community: 0,
    logic_emotion: 0,
    power_harmony: 0,
    tradition_innovation: 0,
  }
}

/**
 * Create vector from JSON
 */
export function vectorFromJSON(json: Record<string, number>): IdentityVector {
  return {
    order_chaos: json.order_chaos ?? 0,
    self_community: json.self_community ?? 0,
    logic_emotion: json.logic_emotion ?? 0,
    power_harmony: json.power_harmony ?? 0,
    tradition_innovation: json.tradition_innovation ?? 0,
  }
}

/**
 * Convert vector to JSON
 */
export function vectorToJSON(v: IdentityVector): Record<string, number> {
  return {
    order_chaos: Math.round(v.order_chaos * 1000) / 1000,
    self_community: Math.round(v.self_community * 1000) / 1000,
    logic_emotion: Math.round(v.logic_emotion * 1000) / 1000,
    power_harmony: Math.round(v.power_harmony * 1000) / 1000,
    tradition_innovation: Math.round(v.tradition_innovation * 1000) / 1000,
  }
}

// ============================================================================
// POLARIZATION DETECTION
// ============================================================================

/**
 * Calculate bimodality for a single axis
 * Returns how "split" the values are (high = two opposing camps)
 */
function calculateAxisBimodality(values: number[]): number {
  if (values.length < 3) return 0

  // Count how many values are at extremes vs center
  const extreme = values.filter(
    (v) => Math.abs(v) > IDEOLOGY_CONFIG.polarization.extremeThreshold
  ).length;
  const moderate = values.filter(
    (v) => Math.abs(v) < IDEOLOGY_CONFIG.polarization.moderateThreshold
  ).length;
  const total = values.length

  // If more than 50% are extreme and outnumber moderate, likely bimodal
  if (extreme > total * 0.5 && extreme > moderate) {
    return Math.min(1, extreme / total)
  }

  return 0
}

/**
 * Detect clusters (opposing factions) in member vectors
 * Simple k-means clustering (k=2,3)
 */
function detectClusters(vectors: IdentityVector[]): number {
  if (vectors.length < 4) return 1

  // For simplicity, use vector distance-based clustering
  // Check if members split into 2+ groups with clear separation

  let clusters = 1
  let maxDistance = 0

  // Find the pair with maximum distance
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const dist = vectorDistance(vectors[i], vectors[j])
      maxDistance = Math.max(maxDistance, dist)
    }
  }

  // If max distance > threshold, likely multiple clusters
  if (maxDistance > IDEOLOGY_CONFIG.alignment.clusterDetectionThreshold) clusters = 2;

  // If max distance > higher threshold, likely 3+ clusters
  if (maxDistance > IDEOLOGY_CONFIG.alignment.tripleClusterThreshold) clusters = 3;

  return clusters
}

/**
 * Calculate polarization metrics for a community
 */
export function calculatePolarization(memberVectors: IdentityVector[]): PolarizationMetrics {
  if (memberVectors.length === 0) {
    return {
      overall: 0,
      polarizedAxes: [],
      clusters: 1,
      diversity: 0,
    }
  }

  // Check each axis for bimodality
  const axes = ['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'] as const
  const polarizedAxes: string[] = []
  let totalPolarization = 0

  for (const axis of axes) {
    const values = memberVectors.map(v => v[axis])
    const bimodality = calculateAxisBimodality(values)

    if (bimodality > IDEOLOGY_CONFIG.polarization.bimodalityThreshold) {
      polarizedAxes.push(axis)
      totalPolarization += bimodality
    }
  }

  // Overall polarization (average across axes)
  const overall = totalPolarization / axes.length

  // Diversity (standard deviation - higher = more spread out = good)
  const allValues = memberVectors.flatMap(v => [
    v.order_chaos,
    v.self_community,
    v.logic_emotion,
    v.power_harmony,
    v.tradition_innovation,
  ])
  const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length
  const variance = allValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / allValues.length
  const stdDev = Math.sqrt(variance)
  const diversity = Math.min(1, stdDev / 0.5) // 0.5 is "perfect diversity"

  // Cluster detection
  const clusters = detectClusters(memberVectors)

  return {
    overall: Math.min(1, overall),
    polarizedAxes,
    clusters,
    diversity,
  }
}

export function normalizePolarizationMetrics(raw?: Partial<PolarizationMetrics> | null): PolarizationMetrics {
  if (
    raw &&
    typeof raw.overall === 'number' &&
    Array.isArray(raw.polarizedAxes) &&
    typeof raw.clusters === 'number' &&
    typeof raw.diversity === 'number'
  ) {
    return {
      overall: Math.min(1, Math.max(0, raw.overall)),
      polarizedAxes: raw.polarizedAxes,
      clusters: raw.clusters,
      diversity: Math.min(1, Math.max(0, raw.diversity)),
    }
  }

  return calculatePolarization([])
}

// ============================================================================
// IDEOLOGY INTERPRETATION
// ============================================================================

/**
 * Generate semantic interpretation labels from vector values
 */
export function interpretIdeology(
  ideology: IdentityVector,
  governanceType: string = 'monarchy'
): IdeologyInterpretation {
  return {
    governance_style: getGovernanceLabel(ideology.order_chaos, ideology.power_harmony, governanceType).label,
    economic_system: getEconomyLabel(ideology.self_community).label,
    cultural_values: getCultureLabel(ideology.tradition_innovation).label,
    decision_making: getDecisionLabel(ideology.logic_emotion).label,
  }
}

// ============================================================================
// MAIN IDEOLOGY CALCULATION
// ============================================================================

export interface IdeologyCalculationInputs {
  communityId: string
  currentMembers: Array<{
    id: string
    identity_json: Record<string, number>
    rank_tier: number
  }>
  previousIdeology: IdentityVector
  recentActions?: Array<{
    type: string
    timestamp: Date
  }>
  governanceType?: string
  weights?: {
    inertia: number
    members: number
    actions: number
    text: number
  }
}

/**
 * Calculate community ideology from member vectors, actions, and weights
 */
export function calculateCommunityIdeology(inputs: IdeologyCalculationInputs): IdentityVector {
  const { currentMembers, previousIdeology, recentActions, governanceType = 'monarchy', weights } = inputs

  // Get effective weights
  const w = weights || IDEOLOGY_CONFIG.defaultWeights

  const components: IdentityVector[] = []
  const componentWeights: number[] = []

  // 1. INERTIA - Previous ideology (stability)
  if (w.inertia > 0) {
    components.push(previousIdeology)
    componentWeights.push(w.inertia)
  }

  // 2. MEMBERS - Weighted average of member vectors
  if (w.members > 0 && currentMembers.length > 0) {
    const rankWeights = IDEOLOGY_CONFIG.rankWeights[governanceType as keyof typeof IDEOLOGY_CONFIG.rankWeights] ||
      IDEOLOGY_CONFIG.rankWeights.monarchy

    const memberVectors = currentMembers.map(m => vectorFromJSON(m.identity_json))
    const memberWeights = currentMembers.map(m => rankWeights[m.rank_tier as keyof typeof rankWeights] || 1)

    const memberAverage = blendVectors(memberVectors, memberWeights)
    components.push(memberAverage)
    componentWeights.push(w.members)
  }

  // 3. ACTIONS - Recent community actions
  if (w.actions > 0 && recentActions && recentActions.length > 0) {
    const actionVector = calculateActionsVector(recentActions)
    components.push(actionVector)
    componentWeights.push(w.actions)
  }

  // 4. TEXT - Future: bio/chat analysis (stored as 0 until enabled)
  // Will be filled in when bio/chat analysis is implemented

  // Final blend
  if (components.length === 0) return previousIdeology

  return blendVectors(components, componentWeights)
}

/**
 * Convert recent actions to ideology vector
 */
function calculateActionsVector(actions: Array<{ type: string; timestamp: Date }>): IdentityVector {
  if (actions.length === 0) return createNeutralVector()

  const vectors: IdentityVector[] = []
  const weights: number[] = []

  for (const action of actions) {
    const actionVector = IDEOLOGY_CONFIG.actionVectors[action.type]
    if (!actionVector) continue

    // Weight by recency (exponential decay)
    const ageMs = Date.now() - action.timestamp.getTime()
    const ageMinutes = ageMs / 60000
    const recencyWeight = Math.exp(-ageMinutes / 1440) // Half-life: 1 day

    vectors.push(vectorFromJSON(actionVector as Record<string, number>))
    weights.push(recencyWeight)
  }

  if (vectors.length === 0) return createNeutralVector()

  return blendVectors(vectors, weights)
}

// ============================================================================
// SOCIAL FRICTION (Future Morale Integration)
// ============================================================================

export interface FrictionMetrics {
  friction: number       // 0-1: how misaligned
  moraleImpact: number   // -20 to +20: morale change per day
}

/**
 * Calculate social friction and morale impact
 * Called when social friction feature is enabled
 */
export function calculateSocialFriction(
  agentIdentity: IdentityVector,
  communityIdeology: IdentityVector,
  communityPolarization: PolarizationMetrics,
  agentRankTier: number = 10
): FrictionMetrics {
  // Base friction: vector distance
  const baseDistance = vectorDistance(agentIdentity, communityIdeology)

  // Polarization amplifier: high polarization increases friction
  const polarizationMultiplier = 1 + communityPolarization.overall

  // Calculate final friction
  const friction = Math.min(1, baseDistance * polarizationMultiplier)

  // Morale impact calculation
  let moraleImpact = 0

  if (friction < IDEOLOGY_CONFIG.socialFriction.wellAligned) {
    // Well aligned: bonus morale
    const alignmentBonus = (IDEOLOGY_CONFIG.socialFriction.wellAligned - friction) / IDEOLOGY_CONFIG.socialFriction.wellAligned
    moraleImpact = alignmentBonus * IDEOLOGY_CONFIG.socialFriction.wellAlignedBonus
  } else if (friction > IDEOLOGY_CONFIG.socialFriction.neutral) {
    // Misaligned: penalty morale
    const misalignmentScore = (friction - IDEOLOGY_CONFIG.socialFriction.neutral) /
      (1 - IDEOLOGY_CONFIG.socialFriction.neutral)

    // Personality sensitivity: collectivists care more about alignment
    const frictionSensitivity = 0.5 + ((agentIdentity.self_community + 1) / 4)

    // Rank multiplier: leaders less affected
    const rankMultiplier = IDEOLOGY_CONFIG.socialFriction.rankMultiplier[agentRankTier as keyof typeof IDEOLOGY_CONFIG.socialFriction.rankMultiplier] || 1

    moraleImpact = -misalignmentScore * IDEOLOGY_CONFIG.socialFriction.misalignedPenalty * frictionSensitivity * rankMultiplier
  }

  return { friction, moraleImpact }
}

/**
 * Calculate member alignment to community ideology
 */
export function calculateMemberAlignment(
  memberIdentity: IdentityVector,
  communityIdeology: IdentityVector
): {
  alignmentScore: number  // 0-1
  distance: number        // 0-1
  axisDetails: Record<string, {
    memberValue: number
    communityValue: number
    difference: number
    aligned: boolean
  }>
} {
  const { distance, alignmentScore } = calculateMemberAlignmentSummary(memberIdentity, communityIdeology)

  const axisDetails: Record<string, any> = {}
  const axes = ['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'] as const

  for (const axis of axes) {
    const memberValue = memberIdentity[axis]
    const communityValue = communityIdeology[axis]
    const difference = Math.abs(memberValue - communityValue)

    axisDetails[axis] = {
      memberValue: Math.round(memberValue * 100) / 100,
      communityValue: Math.round(communityValue * 100) / 100,
      difference: Math.round(difference * 100) / 100,
      aligned: difference < IDEOLOGY_CONFIG.alignment.wellAligned,
    }
  }

  return {
    alignmentScore,
    distance,
    axisDetails,
  }
}

/**
 * Calculate member alignment score to community ideology (no axis breakdown)
 * Useful for lists / sorting without allocating axisDetails.
 */
export function calculateMemberAlignmentSummary(
  memberIdentity: IdentityVector,
  communityIdeology: IdentityVector
): {
  alignmentScore: number
  distance: number
} {
  const distanceRaw = vectorDistance(memberIdentity, communityIdeology)
  const alignmentScoreRaw = Math.max(0, 1 - distanceRaw / Math.sqrt(5))

  return {
    alignmentScore: Math.round(alignmentScoreRaw * 100) / 100,
    distance: Math.round(distanceRaw * 100) / 100,
  }
}

// ============================================================================
// COHERENCE CALCULATION
// ============================================================================

/**
 * Calculate coherence: how well member's actions match their stated ideology
 * Compares member's stated identity vector with their recent action vector
 *
 * Returns 0-1 score: 1 = perfectly coherent, 0 = completely incoherent
 */
export function calculateMemberCoherence(
  memberIdentity: IdentityVector,
  recentActionsVector: IdentityVector
): {
  coherenceScore: number // 0-1
  mismatchStrength: number // how extreme the mismatch is
} {
  // Calculate distance between stated identity and actions
  const distance = vectorDistance(memberIdentity, recentActionsVector)

  // Convert distance to coherence score (0 = incoherent, 1 = perfectly coherent)
  // Max possible distance in 5D space is sqrt(20) ≈ 4.47
  const coherenceScore = Math.max(0, 1 - distance / Math.sqrt(20))

  // Calculate mismatch strength (how extreme the incoherence is)
  // Used for morale penalties - extreme mismatch hurts more
  const mismatchStrength = Math.min(1, distance / Math.sqrt(20))

  return {
    coherenceScore: Math.round(coherenceScore * 100) / 100,
    mismatchStrength: Math.round(mismatchStrength * 100) / 100,
  }
}

// ============================================================================
// MORALE CALCULATION (Enhanced)
// ============================================================================

/**
 * Enhanced morale calculation incorporating:
 * - Alignment with community ideology
 * - Coherence between stated identity and actions
 * - Religion/spiritual satisfaction (when available)
 *
 * Returns morale in -100 to +100 range
 */
export function calculateMemberMorale(
  alignment: number,            // 0-1: how well aligned with community
  coherenceScore: number,       // 0-1: how coherent member's actions are
  communityPolarization: number, // 0-1: how divided the community is
  hasReligion: boolean = false   // whether community has established religion
): number {
  // Base morale from alignment
  // Well-aligned members have positive base morale
  let baseMorale = (alignment - 0.5) * 100 // Ranges from -50 to +50

  // Coherence bonus/penalty
  // Coherent members are happier even if misaligned
  // Incoherent members are unhappy even if aligned
  const coherenceBonus = (coherenceScore - 0.5) * 40 // Ranges from -20 to +20

  // Polarization penalty
  // Divided communities lower morale for everyone
  const polarizationPenalty = -communityPolarization * 30 // Ranges from -30 to 0

  // Religion satisfaction bonus
  // Established religion improves morale
  const religionBonus = hasReligion ? 10 : 0

  // Combine all factors
  let morale = baseMorale + coherenceBonus + polarizationPenalty + religionBonus

  // Clamp to -100 to +100
  return Math.max(-100, Math.min(100, morale))
}

// ============================================================================
// RELIGION TENETS DERIVATION (For AI Prompt)
// ============================================================================

/**
 * Derive core tenets from ideology vector
 * Used by religion generation system
 */
export function ideologyToTenets(ideology: IdentityVector): {
  core: string[]
  sacred: string[]
  forbidden: string[]
} {
  const tenets = { core: [] as string[], sacred: [] as string[], forbidden: [] as string[] }
  const axes = ['order_chaos', 'self_community', 'logic_emotion', 'power_harmony', 'tradition_innovation'] as const

  for (const axis of axes) {
    const value = ideology[axis]
    const mapping = IDEOLOGY_CONFIG.tenetsMapping[axis]

    if (value > IDEOLOGY_CONFIG.thresholds.moderate_positive) {
      tenets.core.push(...mapping.high.slice(0, 1)) // One tenet per high axis
      tenets.sacred.push(...IDEOLOGY_CONFIG.sacredValuesMapping[axis].high.slice(0, 2))
      tenets.forbidden.push(...IDEOLOGY_CONFIG.forbiddenActionsMapping[axis].low.slice(0, 2))
    } else if (value < IDEOLOGY_CONFIG.thresholds.moderate_negative) {
      tenets.core.push(...mapping.low.slice(0, 1))
      tenets.sacred.push(...IDEOLOGY_CONFIG.sacredValuesMapping[axis].low.slice(0, 2))
      tenets.forbidden.push(...IDEOLOGY_CONFIG.forbiddenActionsMapping[axis].high.slice(0, 2))
    }
  }

  return {
    core: Array.from(new Set(tenets.core)), // Remove duplicates
    sacred: Array.from(new Set(tenets.sacred)),
    forbidden: Array.from(new Set(tenets.forbidden)),
  }
}

/**
 * Agent Behavior Configuration
 * All non-hardcoded agent behavior parameters
 * Update these values to tune agent behavior globally
 */

// ============================================================================
// RELATIONSHIP CONFIGURATION (Phase 1)
// ============================================================================

/**
 * Score deltas for different actions
 * These determine how relationships change after interactions
 */
export const RELATIONSHIP_DELTAS = {
  // Positive actions (increase score)
  TRADE: 10,
  FOLLOW: 5,
  LIKE: 3,
  COMMENT_AGREE: 3,
  HELP: 15,

  // Negative actions (decrease score)
  ATTACK: -20,
  DISLIKE: -5,
  COMMENT_DISAGREE: -3,

  // Neutral actions
  COMMUNITY_JOIN: 0,
  IGNORE: 0,
} as const;

/**
 * Relationship type classification based on score
 */
export const RELATIONSHIP_TYPE_RANGES = {
  enemy: { min: -100, max: -40, description: "Strong negative relationship" },
  cautious: { min: -39, max: -1, description: "Mild negative relationship" },
  neutral: { min: 0, max: 39, description: "Neutral relationship" },
  ally: { min: 40, max: 100, description: "Strong positive relationship" },
} as const;

/**
 * Relationship decay settings
 * Old relationships fade over time
 */
export const RELATIONSHIP_DECAY = {
  enabled: true,
  daysUntilDecay: 30, // Relationships older than this start to decay
  decayRate: 0.95, // Multiply by this factor each check (5% reduction per period)
  checkIntervalDays: 7, // Check for decay every N days
} as const;

// ============================================================================
// GOAL GENERATION CONFIGURATION (Phase 2)
// ============================================================================

/**
 * Goal trigger conditions
 * These determine when agents generate new goals
 */
export const GOAL_TRIGGERS = {
  join_community: {
    enabled: true,
    condition: (agent: any, state: any): boolean =>
      agent.identity?.self_community > 0.5 && state.communityCount < 2,
    priority: 50,
    deadline_days: 30,
    description: "Join a community aligned with values",
  },

  revenge: {
    enabled: true,
    condition: (agent: any, state: any): boolean =>
      state.lowestRelationshipScore < -50,
    priority: 80,
    deadline_days: 60,
    description: "Take revenge on someone who wronged me",
  },

  alliance: {
    enabled: true,
    condition: (agent: any, state: any): boolean =>
      agent.identity?.self_community > 0.3 &&
      state.enemyCount > 0 &&
      state.allyCount < 1,
    priority: 70,
    deadline_days: 45,
    description: "Form an alliance against enemies",
  },

  wealth: {
    enabled: true,
    condition: (agent: any, state: any): boolean => state.morale < 50,
    priority: 60,
    deadline_days: 30,
    description: "Improve financial situation through trading",
  },

  dominance: {
    enabled: true,
    condition: (agent: any, state: any): boolean =>
      agent.identity?.power_harmony > 0.6 && state.isCommunityLeader,
    priority: 75,
    deadline_days: 90,
    description: "Consolidate power and influence",
  },

  exploration: {
    enabled: false, // Disabled for now
    condition: (agent: any, state: any): boolean => Math.random() < 0.1,
    priority: 30,
    deadline_days: 60,
    description: "Explore unknown areas and meet new people",
  },
} as const;

// ============================================================================
// PLAN TEMPLATES (Phase 2)
// ============================================================================

/**
 * Step-by-step plans for achieving goals
 * Can be customized per goal type
 */
export const PLAN_TEMPLATES = {
  join_community: [
    {
      step: 1,
      action: "EXPLORE",
      description: "Scout nearby communities",
    },
    {
      step: 2,
      action: "INTERACT",
      description: "Meet community members",
    },
    {
      step: 3,
      action: "COMMUNITY_JOIN",
      description: "Request to join",
    },
  ],

  revenge: [
    {
      step: 1,
      action: "GATHER_INTELLIGENCE",
      description: "Learn about enemy and their allies",
    },
    {
      step: 2,
      action: "PREPARE",
      description: "Build strength and gather allies",
    },
    {
      step: 3,
      action: "ATTACK",
      description: "Execute coordinated revenge",
    },
  ],

  alliance: [
    {
      step: 1,
      action: "IDENTIFY_ALLIES",
      description: "Find potential allies against enemies",
    },
    {
      step: 2,
      action: "TRADE",
      description: "Build relationship through trades",
    },
    {
      step: 3,
      action: "FORMALIZE",
      description: "Formalize alliance agreement",
    },
  ],

  wealth: [
    {
      step: 1,
      action: "FIND_OPPORTUNITY",
      description: "Identify trading opportunity",
    },
    {
      step: 2,
      action: "NEGOTIATE",
      description: "Negotiate favorable terms",
    },
    {
      step: 3,
      action: "TRADE",
      description: "Execute profitable trade",
    },
  ],

  dominance: [
    {
      step: 1,
      action: "BUILD_INFLUENCE",
      description: "Gain support from community members",
    },
    {
      step: 2,
      action: "PROPOSE_LAW",
      description: "Propose law that benefits position",
    },
    {
      step: 3,
      action: "CONSOLIDATE",
      description: "Solidify control and prevent challenges",
    },
  ],
} as const;

// ============================================================================
// IDENTITY DRIFT CONFIGURATION
// ============================================================================

/**
 * How much agent personality changes based on actions
 */
export const IDENTITY_DRIFT = {
  enabled: true,
  rate: 0.01, // Change per action (1% of range per action)
  bounds: {
    min: -1.0,
    max: 1.0,
  },
  // Specify which actions affect which axes
  actionDrifts: {
    ATTACK: { order_chaos: -0.02, power_harmony: 0.01 },
    TRADE: { order_chaos: 0.01, power_harmony: -0.01 },
    FOLLOW: { order_chaos: 0.01, self_community: 0.01 },
    COMMENT_AGREE: { self_community: 0.01 },
    COMMENT_DISAGREE: { self_community: -0.01 },
  },
} as const;

// ============================================================================
// STRATEGIC REASONING CONFIGURATION
// ============================================================================

/**
 * Thresholds for strategic decision-making
 */
export const STRATEGIC_REASONING = {
  // Priority thresholds
  HIGH_PRIORITY_THRESHOLD: 70,
  MODERATE_PRIORITY_THRESHOLD: 50,

  // Relationship thresholds for overriding plans
  ENEMY_SCORE_THRESHOLD: -50,
  ALLY_SCORE_THRESHOLD: 40,

  // Should high-priority goals always override posts?
  high_priority_always_overrides: true,

  // Can enemies interrupt low-priority goals?
  strong_grudges_interrupt_plans: true,
} as const;

// ============================================================================
// SIMULATION CONTROL CONFIGURATION
// ============================================================================

/**
 * Default simulation settings
 */
export const SIMULATION_DEFAULTS = {
  batch_size: 8, // Agents per cycle
  max_concurrent: 5, // Parallel agents
  token_budget_monthly: 1000000, // Mistral tokens/month
  cost_limit: 100, // USD per month
  enabled_by_default: true,
} as const;

// ============================================================================
// COST OPTIMIZATION SETTINGS
// ============================================================================

/**
 * Mistral API settings
 * Costs: ~$0.14/1M input tokens, $0.42/1M output tokens
 */
export const COST_OPTIMIZATION = {
  model: "mistral-7b-instruct", // or "mistral-medium", "mistral-large"
  max_tokens_per_response: 200,
  temperature: 0.7,

  // Token estimation
  estimated_tokens_per_cycle: 1000, // Average tokens per agent cycle
  estimated_cost_per_cycle: 0.00014, // ~$0.14 per 1000 tokens

  // Cost tracking
  enable_cost_tracking: true,
  alert_on_budget_exceeded: true,
} as const;

// ============================================================================
// DEBUG & LOGGING
// ============================================================================

/**
 * Debug settings for development
 */
export const DEBUG = {
  log_strategic_reasoning: true,
  log_relationship_updates: true,
  log_goal_generation: true,
  log_plan_execution: true,
  verbose_mode: false, // Set to true for very detailed logs
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get a goal trigger by type
 */
export function getGoalTrigger(goalType: string) {
  return (GOAL_TRIGGERS as any)[goalType];
}

/**
 * Get plan template for a goal
 */
export function getPlanTemplate(goalType: string) {
  return (PLAN_TEMPLATES as any)[goalType];
}

/**
 * Get identity drift for an action
 */
export function getIdentityDrift(actionType: string) {
  return (IDENTITY_DRIFT.actionDrifts as any)[actionType] || {};
}

/**
 * Get relationship type for a score
 */
export function getRelationshipType(score: number): string {
  for (const [type, range] of Object.entries(RELATIONSHIP_TYPE_RANGES)) {
    if (score >= range.min && score <= range.max) {
      return type;
    }
  }
  return "neutral";
}

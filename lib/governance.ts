/**
 * UNIFIED ROLE SYSTEM - SINGLE SOURCE OF TRUTH
 *
 * RANK_TIER is the primary role/permission system across the entire application.
 *
 * RANK TIERS (COMMUNITY GOVERNANCE):
 * - 0: Sovereign (King/Queen/Leader) - Full authority
 * - 1: Advisor (Secretary/Minister) - Limited authority
 * - 10: Regular Member - No special authority
 *
 * DEPRECATED: The "role" column (founder/leader/member) exists in the database for legacy
 * compatibility but should NOT be used for any authorization or permission checks.
 * All new code must use rank_tier exclusively.
 *
 * MESSAGE ROLE (Different context, for community_messages table):
 * - 'user': Regular member message
 * - 'leader': Message from a rank 0 or 1 member
 * - 'ai': Message from an AI agent
 * This is determined FROM the member's rank_tier, not stored separately.
 *
 * MIGRATION STATUS:
 * ✓ Database schema: rank_tier column exists and is populated
 * ✓ Server actions: Using rank_tier for all new features (laws, governance)
 * ⚠ Components: Still using legacy role checks in some places (chat, authorization)
 * TODO: Complete migration by removing all "role" checks
 */

/**
 * Scalable Governance System Configuration
 *
 * This file defines all governance types and their associated ranks.
 * Adding a new governance type is as simple as adding a new object.
 * The UI components reference this config to render dynamically.
 */

export interface GovernanceRank {
  rank: number;
  label: string;
  maxCount: number | null; // null = unlimited
  icon: string;
}

export interface GovernanceType {
  label: string;
  description: string;
  roles: GovernanceRank[];
  canAssignRanks: number[]; // Which rank tiers can assign others
}

export const GOVERNANCE_TYPES: Record<string, GovernanceType> = {
  monarchy: {
    label: "Kingdom",
    description: "Ruled by a single sovereign with appointed advisors",
    roles: [
      { rank: 0, label: "King/Queen", maxCount: 1, icon: "crown" },
      { rank: 1, label: "Secretary", maxCount: 3, icon: "user-cog" },
      { rank: 10, label: "Member", maxCount: null, icon: "users" },
    ],
    canAssignRanks: [0], // Only rank 0 can assign
  },
  // Future governance types can be added here
  // democracy: { ... },
  // dictatorship: { ... },
};

/**
 * Get governance type config or throw if invalid
 */
export function getGovernanceType(
  governanceType: string
): GovernanceType {
  const config = GOVERNANCE_TYPES[governanceType];
  if (!config) {
    throw new Error(`Unknown governance type: ${governanceType}`);
  }
  return config;
}

/**
 * Get rank label for a specific governance type and rank tier
 */
export function getRankLabel(
  governanceType: string,
  rankTier: number
): string {
  const config = getGovernanceType(governanceType);
  const rankConfig = config.roles.find((r) => r.rank === rankTier);
  return rankConfig?.label || `Rank ${rankTier}`;
}

/**
 * Check if a rank tier can assign other ranks
 */
export function canAssignRanks(governanceType: string, rankTier: number): boolean {
  const config = getGovernanceType(governanceType);
  return config.canAssignRanks.includes(rankTier);
}

/**
 * Get all assignable ranks for a governance type (ranks that can be assigned to members)
 */
export function getAssignableRanks(governanceType: string): GovernanceRank[] {
  const config = getGovernanceType(governanceType);
  // Usually all non-base ranks can be assigned
  return config.roles.filter((r) => r.rank !== 10);
}

/**
 * Validate if a rank assignment is allowed
 */
export function validateRankAssignment(
  governanceType: string,
  rankTier: number,
  currentCount: number
): { valid: boolean; error?: string } {
  const config = getGovernanceType(governanceType);
  const rankConfig = config.roles.find((r) => r.rank === rankTier);

  if (!rankConfig) {
    return { valid: false, error: `Invalid rank tier: ${rankTier}` };
  }

  if (rankConfig.maxCount !== null && currentCount >= rankConfig.maxCount) {
    return {
      valid: false,
      error: `Cannot assign more than ${rankConfig.maxCount} ${rankConfig.label}(s)`,
    };
  }

  return { valid: true };
}

/**
 * UNIFIED ROLE CHECKING FUNCTIONS
 * Use these functions for ALL permission checks. Never use the legacy "role" field.
 */

/**
 * Check if a member is a sovereign (rank 0)
 * This is the primary authority in a community
 */
export function isSovereign(rankTier?: number | null): boolean {
  return rankTier === 0;
}

/**
 * Check if a member is an advisor/secretary (rank 1)
 * Has limited governance authority
 */
export function isAdvisor(rankTier?: number | null): boolean {
  return rankTier === 1;
}

/**
 * Check if a member has governance authority (rank 0 or 1)
 * Used for features like proposing laws, assigning ranks, etc.
 */
export function hasGovernanceAuthority(rankTier?: number | null): boolean {
  return rankTier === 0 || rankTier === 1;
}

/**
 * Check if a member has FULL governance authority (rank 0 only)
 * Used for critical decisions like throne claims, law enactment
 */
export function hasFullGovernanceAuthority(rankTier?: number | null): boolean {
  return rankTier === 0;
}

/**
 * Get the message role based on a member's rank_tier
 * This determines what type of message badge/styling they get in chat
 */
export function getMemberMessageRole(rankTier?: number | null): "user" | "leader" | "ai" {
  if (rankTier === 0 || rankTier === 1) {
    return "leader";
  }
  return "user";
}

/**
 * Check if a member can propose a law (depends on governance type and rank)
 * This is used by the law system to check voting eligibility
 */
export function canProposeLaw(
  lawType: string,
  governanceType: string,
  rankTier?: number | null
): boolean {
  // For now, only sovereign can propose (can expand based on lawType)
  return rankTier === 0;
}

/**
 * Check if a member can vote on a law (depends on governance type and rank)
 */
export function canVoteOnLaw(
  lawType: string,
  governanceType: string,
  rankTier?: number | null
): boolean {
  // For now, rank 0 and 1 can vote (can expand based on lawType)
  return rankTier === 0 || rankTier === 1;
}

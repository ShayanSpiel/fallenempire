/**
 * Scalable Law System Configuration
 *
 * This registry defines all laws that can be proposed in communities.
 * Each law has governance-specific rules that determine who can propose,
 * who votes, how long it takes, and what conditions cause it to pass.
 *
 * Adding a new law:
 * 1. Add entry to LAW_REGISTRY with law_type key
 * 2. Add governance rules for each governance type
 * 3. The UI and execution automatically adapt
 */

export type LawType = "DECLARE_WAR" | "PROPOSE_HEIR" | "CHANGE_GOVERNANCE" | "MESSAGE_OF_THE_DAY" | "WORK_TAX" | "IMPORT_TARIFF" | "CFC_ALLIANCE" | "ISSUE_CURRENCY";
export type PassingCondition = "sovereign_only" | "majority_vote" | "supermajority_vote" | "unanimous";
export type VoteAccessType = "all_members" | "council_only" | "sovereign_only";

export interface GovernanceRules {
  proposeRank: number | number[]; // Rank(s) that can propose this law
  voteAccessRanks: number[]; // Ranks that can vote
  voteAccessType: VoteAccessType; // Helper description of who votes
  timeToPass: string; // e.g., "24h", "48h", "12h"
  canFastTrack: boolean; // Can sovereign override timer
  passingCondition: PassingCondition;
  description: string;
}

export interface LawDefinition {
  label: string;
  description: string;
  icon: string;
  requiresMetadata?: string[]; // Required metadata fields (e.g., ["target_community_id"])
  governanceRules: Record<string, GovernanceRules>;
}

/**
 * Law Registry - Define all laws here
 */
const DEFAULT_GOVERNANCE_TYPE = "monarchy";

function normalizeGovernanceType(governanceType: string | undefined | null) {
  if (!governanceType) return DEFAULT_GOVERNANCE_TYPE;
  return governanceType.toLowerCase();
}

export const LAW_REGISTRY: Record<LawType, LawDefinition> = {
  DECLARE_WAR: {
    label: "Declare War",
    description: "Initiate hostilities with another community.",
    icon: "swords",
    requiresMetadata: ["target_community_id"],
    governanceRules: {
      monarchy: {
        proposeRank: 0, // Only king can propose
        voteAccessRanks: [0, 1], // King and secretaries
        voteAccessType: "council_only",
        timeToPass: "24h",
        canFastTrack: true,
        passingCondition: "sovereign_only",
        description: "Only the sovereign can declare war. Secretaries provide counsel.",
      },
      democracy: {
        proposeRank: [0, 1, 10], // Anyone in leadership can propose
        voteAccessRanks: [0, 1, 10], // Everyone votes
        voteAccessType: "all_members",
        timeToPass: "48h",
        canFastTrack: false,
        passingCondition: "majority_vote",
        description: "Any member can propose war. Majority vote decides the fate of conflict.",
      },
    },
  },

  PROPOSE_HEIR: {
    label: "Propose Heir",
    description: "Designate the future ruler of your dynasty.",
    icon: "crown",
    requiresMetadata: ["target_user_id"],
    governanceRules: {
      monarchy: {
        proposeRank: 0,
        voteAccessRanks: [0, 1],
        voteAccessType: "council_only",
        timeToPass: "12h",
        canFastTrack: true,
        passingCondition: "sovereign_only",
        description: "Only the sovereign can choose their heir. Succession awaits their decree.",
      },
    },
  },

  CHANGE_GOVERNANCE: {
    label: "Change Governance Type",
    description: "Reshape how your community makes decisions.",
    icon: "gavel",
    requiresMetadata: ["new_governance_type"],
    governanceRules: {
      monarchy: {
        proposeRank: 0,
        voteAccessRanks: [0, 1],
        voteAccessType: "council_only",
        timeToPass: "48h",
        canFastTrack: true,
        passingCondition: "sovereign_only",
        description: "Sovereign must decree the shift. Secretaries counsel on the change.",
      },
    },
  },

  MESSAGE_OF_THE_DAY: {
    label: "Broadcast Announcement",
    description: "Post a battle order, strategy, or command to your community.",
    icon: "megaphone",
    requiresMetadata: ["title", "content"],
    governanceRules: {
      monarchy: {
        proposeRank: 0,
        voteAccessRanks: [0],
        voteAccessType: "sovereign_only",
        timeToPass: "0h",
        canFastTrack: false,
        passingCondition: "sovereign_only",
        description: "Sovereign broadcasts instantly. Members see it immediately on the community banner.",
      },
    },
  },

  WORK_TAX: {
    label: "Work Tax Rate",
    description: "Set the tax rate on all work actions. Tax is deducted from wages and sent to community treasury.",
    icon: "coins",
    requiresMetadata: ["tax_rate"],
    governanceRules: {
      monarchy: {
        proposeRank: 0, // Only king can propose
        voteAccessRanks: [0], // Only king votes (secretaries can view but not vote)
        voteAccessType: "sovereign_only",
        timeToPass: "0h", // Instant when king votes
        canFastTrack: false, // Already instant
        passingCondition: "sovereign_only",
        description: "Sovereign sets the work tax rate. Takes effect immediately upon approval.",
      },
    },
  },

  IMPORT_TARIFF: {
    label: "Import Tariff (Tax)",
    description: "Set tariff rate on goods sold by merchants from other communities in your market. Revenue goes to community treasury.",
    icon: "package",
    requiresMetadata: ["tariff_rate"],
    governanceRules: {
      monarchy: {
        proposeRank: 0, // Only king can propose
        voteAccessRanks: [0], // Only king votes
        voteAccessType: "sovereign_only",
        timeToPass: "0h", // Instant when king votes
        canFastTrack: false, // Already instant
        passingCondition: "sovereign_only",
        description: "Sovereign sets the import tariff rate. Takes effect immediately on cross-community market trades.",
      },
    },
  },

  CFC_ALLIANCE: {
    label: "Combined Front Contract (Alliance)",
    description: "Propose an alliance with another community. Both communities must approve. Allies can fight in each other's battles from home.",
    icon: "handshake",
    requiresMetadata: ["target_community_id"],
    governanceRules: {
      monarchy: {
        proposeRank: 0, // Only king can propose
        voteAccessRanks: [0, 1], // King and secretaries
        voteAccessType: "council_only",
        timeToPass: "24h",
        canFastTrack: true,
        passingCondition: "sovereign_only",
        description: "Sovereign proposes alliance. Target community must also approve to activate. Maximum 5 active alliances.",
      },
    },
  },

  ISSUE_CURRENCY: {
    label: "Issue Currency",
    description: "Convert gold from treasury into community currency at a specified exchange rate. Gold is burned permanently and currency is minted to treasury.",
    icon: "coins",
    requiresMetadata: ["gold_amount", "conversion_rate"],
    governanceRules: {
      monarchy: {
        proposeRank: 0, // Only king can propose
        voteAccessRanks: [0], // Only king votes
        voteAccessType: "sovereign_only",
        timeToPass: "0h", // Instant when king votes
        canFastTrack: false, // Already instant
        passingCondition: "sovereign_only",
        description: "Sovereign issues currency by burning treasury gold. Can be done multiple times to increase money supply.",
      },
      democracy: {
        proposeRank: [0, 1], // Leadership can propose
        voteAccessRanks: [0, 1, 10], // All members vote
        voteAccessType: "all_members",
        timeToPass: "48h",
        canFastTrack: false,
        passingCondition: "majority_vote",
        description: "Leadership proposes currency issuance. All members vote on monetary policy.",
      },
    },
  },
};

/**
 * Get a law definition by type
 */
export function getLawDefinition(lawType: LawType): LawDefinition {
  const law = LAW_REGISTRY[lawType];
  if (!law) {
    throw new Error(`Unknown law type: ${lawType}`);
  }
  return law;
}

/**
 * Get governance rules for a specific law and governance type
 */
export function getGovernanceRules(
  lawType: LawType,
  governanceType: string
): GovernanceRules {
  const law = getLawDefinition(lawType);
  const normalizedType = normalizeGovernanceType(governanceType);
  const rules = law.governanceRules[normalizedType];
  if (!rules) {
    throw new Error(
      `Law "${lawType}" not available in governance type "${normalizedType}"`
    );
  }
  return rules;
}

/**
 * Check if a user can propose a law
 */
export function canProposeLaw(
  lawType: LawType,
  governanceType: string,
  userRank: number
): boolean {
  const rules = getGovernanceRules(lawType, governanceType);
  const allowedRanks = Array.isArray(rules.proposeRank)
    ? rules.proposeRank
    : [rules.proposeRank];
  return allowedRanks.includes(userRank);
}

/**
 * Check if a user can vote on a law
 */
export function canVoteOnLaw(
  lawType: LawType,
  governanceType: string,
  userRank: number
): boolean {
  const rules = getGovernanceRules(lawType, governanceType);
  return rules.voteAccessRanks.includes(userRank);
}

/**
 * Parse time string (e.g., "24h", "48h") into milliseconds
 */
export function parseTimeToMilliseconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([hdms])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const [, amount, unit] = match;
  const num = parseInt(amount, 10);

  const multipliers: Record<string, number> = {
    h: 3600000, // hours
    d: 86400000, // days
    m: 60000, // minutes
    s: 1000, // seconds
  };

  return num * (multipliers[unit] || 1);
}

/**
 * Calculate expiration timestamp based on timeToPass
 */
export function calculateExpiresAt(timeToPass: string): Date {
  const milliseconds = parseTimeToMilliseconds(timeToPass);
  return new Date(Date.now() + milliseconds);
}

/**
 * Determine if a proposal should pass based on vote counts and passing condition
 */
export function shouldProposalPass(
  yesVotes: number,
  noVotes: number,
  totalEligibleVoters: number,
  passingCondition: PassingCondition
): boolean {
  const totalVotes = yesVotes + noVotes;

  switch (passingCondition) {
    case "sovereign_only":
      // Sovereign vote is the only vote that matters
      return yesVotes >= 1;

    case "majority_vote":
      // More yes than no (simple majority)
      return yesVotes > noVotes;

    case "supermajority_vote":
      // At least 2/3 of votes must be yes
      return totalVotes > 0 && yesVotes >= Math.ceil((totalVotes * 2) / 3);

    case "unanimous":
      // All votes must be yes
      return totalVotes > 0 && noVotes === 0 && yesVotes === totalEligibleVoters;

    default:
      return false;
  }
}

/**
 * Get all laws available for a specific governance type
 */
export function getAvailableLawsForGovernance(
  governanceType: string
): Array<{ type: LawType; definition: LawDefinition }> {
  const normalizedType = normalizeGovernanceType(governanceType);
  return (Object.entries(LAW_REGISTRY) as [LawType, LawDefinition][])
    .filter(([_, definition]) => definition.governanceRules[normalizedType])
    .map(([type, definition]) => ({ type, definition }));
}

/**
 * Governance Configuration
 * Non-hardcoded law types and voting rules
 */

/**
 * Law type definitions
 * Agents can propose any of these law types
 */
export const LAW_TYPES = {
  declare_war: {
    name: "Declare War",
    description: "Declare war on another community",
    canPropose: [0, 1], // Sovereign, Council
    canVote: [0, 1, 10], // All ranks
    timeToPass: "24h",
    passingCondition: "majority_vote", // needs 50%+
    requiresImplementation: true,
    metadata_required: ["target_community_id"],
  },

  propose_heir: {
    name: "Propose Heir",
    description: "Propose a successor to the throne",
    canPropose: [0], // Only sovereign
    canVote: [0, 1], // Sovereign and council
    timeToPass: "12h",
    passingCondition: "sovereign_only", // Sovereign decides
    requiresImplementation: true,
    metadata_required: ["heir_id"],
  },

  change_governance: {
    name: "Change Governance Type",
    description: "Change community governance system",
    canPropose: [0],
    canVote: [0, 1],
    timeToPass: "48h",
    passingCondition: "supermajority_vote", // needs 67%+
    requiresImplementation: true,
    metadata_required: ["new_governance_type"],
  },

  message_of_day: {
    name: "Message of the Day",
    description: "Broadcast a message to the community",
    canPropose: [0, 1],
    canVote: [0], // Only sovereign implements
    timeToPass: "0h",
    passingCondition: "sovereign_only",
    requiresImplementation: false,
    metadata_required: ["message"],
  },

  economic_policy: {
    name: "Economic Policy",
    description: "Set resource distribution policy",
    canPropose: [0, 1],
    canVote: [0, 1, 10],
    timeToPass: "36h",
    passingCondition: "majority_vote",
    requiresImplementation: true,
    metadata_required: ["policy_type"],
  },

  military_action: {
    name: "Military Action",
    description: "Authorize military operations",
    canPropose: [0, 1],
    canVote: [0, 1, 10],
    timeToPass: "12h",
    passingCondition: "majority_vote",
    requiresImplementation: true,
    metadata_required: ["action_type"],
  },

  taxation: {
    name: "Taxation",
    description: "Set tax rates on members",
    canPropose: [0, 1],
    canVote: [0, 1],
    timeToPass: "24h",
    passingCondition: "majority_vote",
    requiresImplementation: true,
    metadata_required: ["tax_rate"],
  },

  alliance: {
    name: "Alliance Formation",
    description: "Form alliance with another community",
    canPropose: [0, 1],
    canVote: [0, 1, 10],
    timeToPass: "48h",
    passingCondition: "supermajority_vote",
    requiresImplementation: true,
    metadata_required: ["ally_community_id"],
  },

  cultural_initiative: {
    name: "Cultural Initiative",
    description: "Launch cultural or scientific initiative",
    canPropose: [0, 1],
    canVote: [0, 1, 10],
    timeToPass: "36h",
    passingCondition: "majority_vote",
    requiresImplementation: true,
    metadata_required: ["initiative_type"],
  },

  trade_agreement: {
    name: "Trade Agreement",
    description: "Establish trade terms with another community",
    canPropose: [0, 1],
    canVote: [0, 1],
    timeToPass: "24h",
    passingCondition: "majority_vote",
    requiresImplementation: true,
    metadata_required: ["trade_partner_id", "terms"],
  },
} as const;

/**
 * Law proposal triggers for agents
 * When agents should consider proposing laws
 */
export const LAW_PROPOSAL_TRIGGERS = {
  declare_war: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.communityEnemy > 0 &&
      agentState.isCommunityLeader &&
      agentState.militaryPower > 50,
    priority: 80,
    description: "Propose war when agent is leader with military advantage",
  },

  military_action: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.enemyCount > 0 &&
      agentState.rank_tier <= 1 &&
      agentState.morale < 40,
    priority: 70,
    description: "Propose military action when morale is low and enemies exist",
  },

  economic_policy: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.communityWealth < 100 &&
      agentState.rank_tier === 0 &&
      agentState.order_chaos > 0.5,
    priority: 60,
    description: "Propose economic policy if community is poor and agent is orderly",
  },

  taxation: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.rank_tier === 0 &&
      agentState.communityWealth > 200,
    priority: 50,
    description: "Propose taxation if sovereign and community is wealthy",
  },

  alliance: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.rank_tier <= 1 &&
      agentState.enemyCount > 2 &&
      agentState.allyCount === 0,
    priority: 75,
    description: "Propose alliance when surrounded by enemies with no allies",
  },

  cultural_initiative: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.rank_tier <= 1 &&
      agentState.tradition_innovation > 0.5 &&
      agentState.communityMorale > 60,
    priority: 40,
    description: "Propose culture initiative if innovative and morale is high",
  },

  trade_agreement: {
    enabled: true,
    condition: (agentState: any): boolean =>
      agentState.rank_tier <= 1 &&
      agentState.power_harmony < -0.3 &&
      agentState.communityWealth > 100,
    priority: 55,
    description: "Propose trade if peaceful-oriented and community is wealthy",
  },
} as const;

/**
 * Voting thresholds
 */
export const VOTING_THRESHOLDS = {
  majority: 0.5, // 50%+
  supermajority: 0.67, // 67%+
  consensus: 0.9, // 90%+
} as const;

/**
 * Faction settings
 */
export const FACTION_SETTINGS = {
  minMembersToForm: 3,
  max_members_per_faction: 50,
  power_gain_per_member: 5,
  power_loss_per_member: 2,
  power_decay_per_day: 0.1,
  ideological_distance_max: 1.0, // Factions with >1.0 ideological distance can't coexist peacefully
} as const;

/**
 * Agent voting strategy based on ideology
 * Defines how agents vote on different law types
 */
export const AGENT_VOTING_STRATEGY = {
  declare_war: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.power_harmony > 0.5) return "no"; // Peaceful agents vote no
    if (agentIdentity.order_chaos > 0.3) return "yes"; // Chaotic agents vote yes
    return "abstain";
  },

  alliance: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.self_community > 0.5) return "yes"; // Community-minded vote yes
    if (agentIdentity.power_harmony > 0.3) return "yes"; // Peaceful vote yes
    return "no";
  },

  taxation: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.order_chaos > 0.5) return "yes"; // Orderly accept taxes
    return "no";
  },

  cultural_initiative: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.tradition_innovation > 0.3) return "yes"; // Innovators support
    if (agentIdentity.self_community > 0.3) return "yes"; // Community-minded support
    return "abstain";
  },

  economic_policy: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.order_chaos > 0.3) return "yes"; // Orderly support policy
    return "abstain";
  },

  military_action: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.power_harmony > 0.5) return "no"; // Peaceful vote no
    if (agentIdentity.power_harmony < -0.5) return "yes"; // Domineering vote yes
    return "abstain";
  },

  trade_agreement: (agentIdentity: any): "yes" | "no" | "abstain" => {
    if (agentIdentity.power_harmony > 0.3) return "yes"; // Peaceful support trade
    if (agentIdentity.order_chaos > 0.3) return "yes"; // Orderly support structure
    return "abstain";
  },

  default: (agentIdentity: any): "yes" | "no" | "abstain" => "abstain",
} as const;

/**
 * Helper functions
 */
export function getLawType(typeKey: string) {
  return (LAW_TYPES as any)[typeKey];
}

export function getProposalTrigger(typeKey: string) {
  return (LAW_PROPOSAL_TRIGGERS as any)[typeKey];
}

export function getAgentVote(
  lawType: string,
  agentIdentity: any
): "yes" | "no" | "abstain" {
  const strategy = (AGENT_VOTING_STRATEGY as any)[lawType];
  return strategy ? strategy(agentIdentity) : "abstain";
}

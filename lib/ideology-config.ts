/**
 * Identity & Ideology Configuration
 *
 * Single source of truth for all ideology-related labels, thresholds, and rules.
 * Update this file when refining labels or thresholds - no code changes needed.
 */

export interface AxisDefinition {
  key: string
  label: string
  description: string
  lowLabel: string
  highLabel: string
}

export interface InterpretationLabel {
  label: string
  icon: string
  description: string
}

export const IDEOLOGY_CONFIG = {
  // ========================================================================
  // AXES DEFINITIONS
  // ========================================================================

  axes: [
    {
      key: 'order_chaos',
      label: 'Order vs Chaos',
      description: 'Preference for hierarchy, structure, and rules vs flexibility and spontaneity',
      lowLabel: 'Chaos, Flexibility, Anarchy',
      highLabel: 'Order, Hierarchy, Rules'
    },
    {
      key: 'self_community',
      label: 'Individual vs Collective',
      description: 'Focus on personal achievement vs community welfare',
      lowLabel: 'Individual, Self-Reliant, Selfish',
      highLabel: 'Collective, Cooperative, Group-First'
    },
    {
      key: 'logic_emotion',
      label: 'Logic vs Emotion',
      description: 'Decision-making based on reason vs intuition and feeling',
      lowLabel: 'Emotional, Intuitive, Passionate',
      highLabel: 'Logical, Rational, Calculated'
    },
    {
      key: 'power_harmony',
      label: 'Power vs Harmony',
      description: 'Pursuit of dominance vs peaceful cooperation',
      lowLabel: 'Harmony, Peace, Diplomatic',
      highLabel: 'Power, Domination, Conquest'
    },
    {
      key: 'tradition_innovation',
      label: 'Tradition vs Innovation',
      description: 'Preference for established ways vs new ideas and change',
      lowLabel: 'Tradition, Heritage, Conservative',
      highLabel: 'Innovation, Change, Progressive'
    }
  ] as AxisDefinition[],

  // ========================================================================
  // INTERPRETATION RULES - Vector values → Semantic Labels
  // ========================================================================

  interpretationRules: {
    // Governance styles (order_chaos × power_harmony × governance_type)
    governance: {
      monarchy: {
        'high_order_high_power': {
          label: 'Totalitarian Monarchy',
          icon: 'crown-shield',
          description: 'Absolute rule with rigid order enforced through military might'
        } as InterpretationLabel,
        'high_order_low_power': {
          label: 'Constitutional Monarchy',
          icon: 'crown-law',
          description: 'Hierarchical rule maintained through law and tradition, not force'
        } as InterpretationLabel,
        'low_order_high_power': {
          label: 'Warlord Monarchy',
          icon: 'crown-sword',
          description: 'Chaotic rule where strength determines hierarchy'
        } as InterpretationLabel,
        'low_order_low_power': {
          label: 'Decentralized Monarchy',
          icon: 'crown-branches',
          description: 'Loose monarchical rule with significant local autonomy'
        } as InterpretationLabel,
        'balanced': {
          label: 'Balanced Monarchy',
          icon: 'crown',
          description: 'Moderate governance style combining tradition and pragmatism'
        } as InterpretationLabel,
      },
      democracy: {
        'high_order_high_power': {
          label: 'Authoritarian Democracy',
          icon: 'voting-strict',
          description: 'Democratic processes controlled by strong central authority'
        } as InterpretationLabel,
        'high_order_low_power': {
          label: 'Constitutional Democracy',
          icon: 'voting-law',
          description: 'Democratic governance within established legal frameworks'
        } as InterpretationLabel,
        'low_order_high_power': {
          label: 'Populist Democracy',
          icon: 'voting-power',
          description: 'Direct rule by popular will, often led by strong leaders'
        } as InterpretationLabel,
        'low_order_low_power': {
          label: 'Direct Democracy',
          icon: 'voting-direct',
          description: 'Grassroots decision-making with minimal central authority'
        } as InterpretationLabel,
        'balanced': {
          label: 'Democratic Republic',
          icon: 'voting',
          description: 'Balanced democratic governance with representative systems'
        } as InterpretationLabel,
      },
      dictatorship: {
        'high_order_high_power': {
          label: 'Totalitarian Dictatorship',
          icon: 'gavel-shield',
          description: 'Absolute control with rigid order and no dissent'
        } as InterpretationLabel,
        'high_order_low_power': {
          label: 'Bureaucratic Dictatorship',
          icon: 'gavel-law',
          description: 'Dictatorial rule maintained through administrative control'
        } as InterpretationLabel,
        'low_order_high_power': {
          label: 'Military Junta',
          icon: 'gavel-sword',
          description: 'Rule by military strongmen with selective enforcement'
        } as InterpretationLabel,
        'low_order_low_power': {
          label: 'Chaotic Tyranny',
          icon: 'gavel-chaos',
          description: 'Oppressive rule with inconsistent enforcement and instability'
        } as InterpretationLabel,
        'balanced': {
          label: 'Autocracy',
          icon: 'gavel',
          description: 'Single-ruler governance balancing control and pragmatism'
        } as InterpretationLabel,
      }
    },

    // Economic systems (self_community axis)
    economy: {
      'high_collectivist': {
        label: 'Collectivist',
        icon: 'people-network',
        description: 'Resources and power are shared; community welfare prioritized'
      } as InterpretationLabel,
      'moderate_collectivist': {
        label: 'Social Market',
        icon: 'balance-people',
        description: 'Strong community support with market mechanisms'
      } as InterpretationLabel,
      'balanced': {
        label: 'Mixed Economy',
        icon: 'balance-scale',
        description: 'Balance between individual incentives and community support'
      } as InterpretationLabel,
      'moderate_individualist': {
        label: 'Market Economy',
        icon: 'balance-coins',
        description: 'Merit and competition with minimal community intervention'
      } as InterpretationLabel,
      'high_individualist': {
        label: 'Individualist',
        icon: 'person-star',
        description: 'Personal achievement and competition prioritized; minimal redistribution'
      } as InterpretationLabel,
    },

    // Cultural values (tradition_innovation axis)
    culture: {
      'high_traditionalist': {
        label: 'Traditionalist',
        icon: 'scroll',
        description: 'Deep respect for heritage, customs, ancestors, and established ways'
      } as InterpretationLabel,
      'moderate_traditionalist': {
        label: 'Conservative',
        icon: 'shield',
        description: 'Values stability and proven methods while open to gradual change'
      } as InterpretationLabel,
      'balanced': {
        label: 'Pragmatic',
        icon: 'lightbulb',
        description: 'Adopts what works regardless of age; respects proven methods'
      } as InterpretationLabel,
      'moderate_progressive': {
        label: 'Progressive',
        icon: 'rocket',
        description: 'Embraces change and new ideas; challenges established norms'
      } as InterpretationLabel,
      'high_progressive': {
        label: 'Revolutionary',
        icon: 'flame',
        description: 'Actively rejects tradition; pursues radical transformation'
      } as InterpretationLabel,
    },

    // Decision-making style (logic_emotion axis)
    decision: {
      'high_rationalist': {
        label: 'Rationalist',
        icon: 'brain',
        description: 'Decisions driven by logic, data, and calculated outcomes'
      } as InterpretationLabel,
      'moderate_rationalist': {
        label: 'Analytical',
        icon: 'chart-line',
        description: 'Prefers evidence-based decisions with some emotional consideration'
      } as InterpretationLabel,
      'balanced': {
        label: 'Balanced',
        icon: 'scale-balanced',
        description: 'Values both rational analysis and emotional wisdom equally'
      } as InterpretationLabel,
      'moderate_passionate': {
        label: 'Intuitive',
        icon: 'sparkles',
        description: 'Trusts instinct and feeling with rational oversight'
      } as InterpretationLabel,
      'high_passionate': {
        label: 'Passionate',
        icon: 'flame',
        description: 'Driven by emotion, intuition, and values rather than pure logic'
      } as InterpretationLabel,
    },
  },

  // ========================================================================
  // THRESHOLDS - How to map vector values to interpretation rules
  // ========================================================================

  thresholds: {
    // Strong opinions (clear governance/economic/cultural style)
    strong_positive: 0.5,
    strong_negative: -0.5,

    // Moderate opinions
    moderate_positive: 0.2,
    moderate_negative: -0.2,

    // Weak opinions (balanced/pragmatic)
    weak_threshold: 0.1,
  },

  // ========================================================================
  // POLARIZATION METRICS - Community unity thresholds
  // ========================================================================

  polarization: {
    unified: 0.3,           // < 0.3 = GREEN ("Unified") - Strong consensus
    moderate_tension: 0.6,  // 0.3-0.6 = YELLOW ("Moderate Tension") - Diverse but stable
    polarized: 1.0,         // > 0.6 = RED ("Polarized") - Opposing factions

    // Polarization detection thresholds (bimodal distribution analysis)
    extremeThreshold: 0.6,  // |value| > 0.6 considered extreme
    moderateThreshold: 0.3, // |value| < 0.3 considered moderate/center
    bimodalityThreshold: 0.5, // bimodality score > 0.5 = polarized axis
  },

  // ========================================================================
  // ALIGNMENT & CLUSTERING
  // ========================================================================

  alignment: {
    wellAligned: 0.3,       // Distance < 0.3 = well aligned with community
    clusterDetectionThreshold: 2.0,  // maxDistance > 2.0 = 2 clusters
    tripleClusterThreshold: 2.8,     // maxDistance > 2.8 = 3 clusters
  },

  // ========================================================================
  // RELIGION SYSTEM
  // ========================================================================

  religion: {
    // Trigger generation when community reaches this size
    minMembersToGenerate: 20,

    // Regenerate religion if ideology changes by more than this amount
    ideologyShiftThresholdForRegeneration: 0.3,

    // Which Claude model to use for lore generation
    generationAIModel: 'claude-3-5-sonnet',

    // Maximum retries for AI generation
    maxGenerationRetries: 3,
  },

  // ========================================================================
  // ACTION VECTORS - How community actions shift ideology
  // Stored as partial vectors; missing axes default to 0
  // ========================================================================

  actionVectors: {
    DECLARE_WAR: {
      order_chaos: 0.3,           // War increases chaos
      self_community: -0.2,       // Inward focus (less collectivist)
      logic_emotion: -0.3,        // Wars driven by emotion
      power_harmony: 0.8,         // Very aggressive
      tradition_innovation: -0.1,
    },
    FORM_ALLIANCE: {
      order_chaos: -0.1,          // Alliances increase order
      self_community: 0.5,        // Very collectivist
      logic_emotion: 0.0,         // Neutral
      power_harmony: -0.4,        // Peaceful
      tradition_innovation: 0.2,  // Creates new bonds
    },
    TRADE: {
      order_chaos: -0.1,          // Trade is orderly
      self_community: 0.2,        // Slightly collectivist
      logic_emotion: 0.0,         // Neutral
      power_harmony: -0.3,        // Peaceful
      tradition_innovation: 0.3,  // Encourages change
    },
    DECLARE_PEACE: {
      order_chaos: -0.2,          // Peace brings order
      self_community: 0.4,        // Cooperative
      logic_emotion: 0.3,         // Diplomatic emotion
      power_harmony: -0.7,        // Very peaceful
      tradition_innovation: 0.1,
    },
    PASS_LAW: {
      order_chaos: 0.5,           // Laws increase order
      self_community: 0.0,        // Depends on law type
      logic_emotion: 0.5,         // Legal processes rational
      power_harmony: 0.2,         // Assertion of rule
      tradition_innovation: -0.1, // Formalization
    },
  } as Record<string, Record<string, number>>,

  // ========================================================================
  // RANK WEIGHTS - How leadership power varies by governance type
  // ========================================================================

  rankWeights: {
    monarchy: {
      0: 10.0,   // Sovereign = 10 regular members
      1: 3.0,    // Advisor = 3 regular members
      10: 1.0,   // Regular member = 1
    },
    democracy: {
      0: 1.0,    // All equal vote
      1: 1.0,
      10: 1.0,
    },
    dictatorship: {
      0: 20.0,   // Dictator dominates
      1: 2.0,
      10: 0.5,   // Regular members have less say
    },
  },

  // ========================================================================
  // DEFAULT IDEOLOGY CALCULATION WEIGHTS
  // How different inputs are blended into final ideology
  // ========================================================================

  defaultWeights: {
    inertia: 0.4,     // 40% - Previous ideology (stability)
    members: 0.3,     // 30% - Average of member vectors
    actions: 0.2,     // 20% - Recent community actions
    text: 0.1,        // 10% - Bio/chat analysis (future)
    events: 0.0,      // 0% - Event history (future, enabled per-community)
  },

  // ========================================================================
  // TENETS MAPPING - Derive religion tenets from ideology
  // FUTURE: Consider making this more sophisticated with AI help
  // ========================================================================

  tenetsMapping: {
    order_chaos: {
      high: ['Discipline and Order', 'Hierarchy and Structure', 'Law and Justice'],
      low: ['Freedom and Spontaneity', 'Individual Liberty', 'Natural Chaos'],
    },
    self_community: {
      high: ['Collective Unity', 'Mutual Support', 'Brotherhood/Sisterhood'],
      low: ['Individual Excellence', 'Self-Reliance', 'Personal Achievement'],
    },
    logic_emotion: {
      high: ['Reason and Logic', 'Knowledge and Truth', 'Rational Analysis'],
      low: ['Passion and Intuition', 'Emotional Truth', 'Instinctive Wisdom'],
    },
    power_harmony: {
      high: ['Strength and Conquest', 'Dominance and Victory', 'Power and Glory'],
      low: ['Peace and Cooperation', 'Harmony and Balance', 'Compassion and Mercy'],
    },
    tradition_innovation: {
      high: ['Progress and Innovation', 'Discovery and Change', 'Evolution and Growth'],
      low: ['Tradition and Heritage', 'Ancestral Wisdom', 'Preservation of Ways'],
    },
  },

  // ========================================================================
  // SACRED VALUES - Derived from ideology for religion
  // ========================================================================

  sacredValuesMapping: {
    order_chaos: {
      high: ['Order', 'Law', 'Structure', 'Hierarchy'],
      low: ['Freedom', 'Change', 'Liberty', 'Possibility'],
    },
    self_community: {
      high: ['Community', 'Brotherhood', 'Cooperation', 'Unity'],
      low: ['Achievement', 'Excellence', 'Merit', 'Independence'],
    },
    logic_emotion: {
      high: ['Logic', 'Knowledge', 'Truth', 'Reason'],
      low: ['Emotion', 'Intuition', 'Heart', 'Spirit'],
    },
    power_harmony: {
      high: ['Power', 'Victory', 'Strength', 'Dominance'],
      low: ['Peace', 'Harmony', 'Balance', 'Compassion'],
    },
    tradition_innovation: {
      high: ['Progress', 'Innovation', 'Discovery', 'Evolution'],
      low: ['Tradition', 'Heritage', 'Ancestors', 'Customs'],
    },
  },

  // ========================================================================
  // FORBIDDEN ACTIONS - What the religion forbids (derived from ideology)
  // ========================================================================

  forbiddenActionsMapping: {
    order_chaos: {
      high: ['Anarchy', 'Chaos', 'Rebellion', 'Disorder'],
      low: ['Tyranny', 'Rigidity', 'Conformity', 'Oppression'],
    },
    self_community: {
      high: ['Selfishness', 'Isolation', 'Betrayal', 'Abandonment'],
      low: ['Conformity', 'Dependency', 'Mediocrity', 'Suppression'],
    },
    logic_emotion: {
      high: ['Impulsiveness', 'Superstition', 'Delusion', 'Irrationality'],
      low: ['Cold Logic', 'Detachment', 'Calculation', 'Heartlessness'],
    },
    power_harmony: {
      high: ['Weakness', 'Submission', 'Pacifism', 'Surrender'],
      low: ['Aggression', 'War', 'Domination', 'Cruelty'],
    },
    tradition_innovation: {
      high: ['Stagnation', 'Tradition', 'Conservatism', 'Regression'],
      low: ['Revolution', 'Destruction', 'Iconoclasm', 'Instability'],
    },
  },

  // ========================================================================
  // SOCIAL FRICTION (Future feature - Morale impact)
  // When enabled, ideology mismatch affects member morale
  // ========================================================================

  socialFriction: {
    // Friction score ranges
    wellAligned: 0.3,        // < 0.3 = +morale
    neutral: 0.6,            // 0.3-0.6 = no morale change
    misaligned: 1.0,         // > 0.6 = -morale

    // Morale impact calculations
    wellAlignedBonus: 10,     // Max +10 per day if friction < 0.3
    misalignedPenalty: 20,    // Max -20 per day if friction > 0.6
    rankMultiplier: {
      0: 0.2,   // Sovereigns only lose 20% of friction penalty
      1: 0.5,   // Advisors lose 50%
      10: 1.0,  // Members experience full penalty
    },

    // Personality affects how much friction matters
    frictionSensitivityByAxis: {
      self_community: 0.5,  // Collectivists care more about community alignment (+50% sensitivity)
    },
  },
}

/**
 * Helper function: Get interpretation label based on vector values
 * Used by UI to display semantic labels instead of raw numbers
 */
export function getGovernanceLabel(
  orderChaos: number,
  powerHarmony: number,
  governanceType: string
): InterpretationLabel {
  const orderKey = orderChaos > IDEOLOGY_CONFIG.thresholds.moderate_positive
    ? 'high_order'
    : orderChaos < IDEOLOGY_CONFIG.thresholds.moderate_negative
    ? 'low_order'
    : 'balanced'

  const powerKey = powerHarmony > IDEOLOGY_CONFIG.thresholds.moderate_positive
    ? 'high_power'
    : powerHarmony < IDEOLOGY_CONFIG.thresholds.moderate_negative
    ? 'low_power'
    : 'balanced'

  const key = orderKey === 'balanced' || powerKey === 'balanced'
    ? 'balanced'
    : `${orderKey}_${powerKey}`

  const govRules = IDEOLOGY_CONFIG.interpretationRules.governance[governanceType as keyof typeof IDEOLOGY_CONFIG.interpretationRules.governance]
  if (!govRules) return { label: 'Unknown', icon: 'question', description: '' }

  return govRules[key as keyof typeof govRules] || govRules['balanced'] || { label: 'Unknown', icon: 'question', description: '' }
}

/**
 * Helper function: Get economy label
 */
export function getEconomyLabel(selfCommunity: number): InterpretationLabel {
  const key = selfCommunity > IDEOLOGY_CONFIG.thresholds.strong_positive
    ? 'high_collectivist'
    : selfCommunity > IDEOLOGY_CONFIG.thresholds.moderate_positive
    ? 'moderate_collectivist'
    : selfCommunity < IDEOLOGY_CONFIG.thresholds.strong_negative
    ? 'high_individualist'
    : selfCommunity < IDEOLOGY_CONFIG.thresholds.moderate_negative
    ? 'moderate_individualist'
    : 'balanced'

  return IDEOLOGY_CONFIG.interpretationRules.economy[key as keyof typeof IDEOLOGY_CONFIG.interpretationRules.economy] ||
    IDEOLOGY_CONFIG.interpretationRules.economy['balanced']
}

/**
 * Helper function: Get culture label
 */
export function getCultureLabel(traditionInnovation: number): InterpretationLabel {
  const key = traditionInnovation < IDEOLOGY_CONFIG.thresholds.strong_negative
    ? 'high_traditionalist'
    : traditionInnovation < IDEOLOGY_CONFIG.thresholds.moderate_negative
    ? 'moderate_traditionalist'
    : traditionInnovation > IDEOLOGY_CONFIG.thresholds.strong_positive
    ? 'high_progressive'
    : traditionInnovation > IDEOLOGY_CONFIG.thresholds.moderate_positive
    ? 'moderate_progressive'
    : 'balanced'

  return IDEOLOGY_CONFIG.interpretationRules.culture[key as keyof typeof IDEOLOGY_CONFIG.interpretationRules.culture] ||
    IDEOLOGY_CONFIG.interpretationRules.culture['balanced']
}

/**
 * Helper function: Get decision-making label
 */
export function getDecisionLabel(logicEmotion: number): InterpretationLabel {
  const key = logicEmotion > IDEOLOGY_CONFIG.thresholds.strong_positive
    ? 'high_rationalist'
    : logicEmotion > IDEOLOGY_CONFIG.thresholds.moderate_positive
    ? 'moderate_rationalist'
    : logicEmotion < IDEOLOGY_CONFIG.thresholds.strong_negative
    ? 'high_passionate'
    : logicEmotion < IDEOLOGY_CONFIG.thresholds.moderate_negative
    ? 'moderate_passionate'
    : 'balanced'

  return IDEOLOGY_CONFIG.interpretationRules.decision[key as keyof typeof IDEOLOGY_CONFIG.interpretationRules.decision] ||
    IDEOLOGY_CONFIG.interpretationRules.decision['balanced']
}

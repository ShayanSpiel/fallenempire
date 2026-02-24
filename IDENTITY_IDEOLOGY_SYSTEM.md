# Identity & Ideology System - Master Documentation

**Last Updated:** 2025-12-20
**Version:** 1.0 (Foundation)
**Status:** Implementation in Progress

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Concepts](#core-concepts)
4. [Mathematical Formulas](#mathematical-formulas)
5. [Database Schema](#database-schema)
6. [API Reference](#api-reference)
7. [UI Component Specifications](#ui-component-specifications)
8. [Configuration System](#configuration-system)
9. [Extensibility & Future Features](#extensibility--future-features)
10. [Implementation Checklist](#implementation-checklist)

---

## System Overview

This system creates **dynamic, emergent community ideologies** derived from member psychology, leadership, and collective actions. It bridges individual identity with group behavior and is designed to scale from 10 members to 1M+ players.

### Core Purpose
- **Individual identity** (5D vector) informs **community ideology** (5D vector)
- Community ideology influences member morale through **social friction**
- Leaders shape ideology through rank-weighted influence
- Religion emerges from ideology as narrative wrapper
- System is extensible to include bio text, chat history, and law proposals

### Key Design Principles
✅ **Scalable inputs** - Start with member vectors, add text/chat later via config flags
✅ **No hardcoding** - All labels, thresholds, and rules in `ideology-config.ts`
✅ **Full UI integration** - Every feature has visual representation
✅ **Modular interpretation** - Easy to refine labels without touching core math
✅ **Event-driven** - Recalculate only when necessary (member changes, major events)

---

## Architecture

### Four-Tier Hierarchy

```
[ WORLD STAGE ]
     ↑
[ GOVERNANCE SYSTEM ] (Monarchy/Democracy/Dictatorship)
     ↑
[ COMMUNITY IDEOLOGY ] (Emergent from members + actions + leadership)
     ↑
[ INDIVIDUAL PSYCHOLOGY ] (5D identity vector per user)
```

### Information Flow

```
Member Identities → Weighted Average (by rank) → Community Ideology
                                                       ↓
                                    Religious Narrative + Interpretation Labels
                                                       ↓
                                    Social Friction (morale impact on members)
                                                       ↓
                                    Governance Type + Laws + Actions
```

### Calculation Frequency

| Event | Trigger | Frequency |
|-------|---------|-----------|
| Member joins/leaves | Immediate | On action |
| Rank changes | Immediate | On action |
| Action history | Daily drift | 1x per day |
| Community bio analysis | Manual | When enabled |
| Chat history analysis | Manual | When enabled |

---

## Core Concepts

### 1. Identity Vector (5 Dimensions)

Each user and community has a 5D identity vector representing core values/traits.

```typescript
interface IdentityVector {
  order_chaos: number        // Range: -1.0 to +1.0
  self_community: number     // Range: -1.0 to +1.0
  logic_emotion: number      // Range: -1.0 to +1.0
  power_harmony: number      // Range: -1.0 to +1.0
  tradition_innovation: number // Range: -1.0 to +1.0
}
```

**Axis Definitions:**

| Axis | Low (-1.0) | Mid (0.0) | High (+1.0) |
|------|-----------|----------|-----------|
| **order_chaos** | Chaos, Anarchy, Flexibility | Balanced | Order, Hierarchy, Rules |
| **self_community** | Individual, Self-Reliant, Selfish | Balanced | Collective, Cooperative, Group-First |
| **logic_emotion** | Emotional, Intuitive, Passionate | Balanced | Logical, Rational, Calculated |
| **power_harmony** | Harmony, Peace, Diplomatic | Balanced | Power, Domination, Conquest |
| **tradition_innovation** | Tradition, Heritage, Conservative | Balanced | Innovation, Change, Progressive |

### 2. Polarization Metrics

Measures internal community disagreement **without penalizing healthy diversity**.

```typescript
interface PolarizationMetrics {
  overall: number           // 0-1, how ideologically split the community is
  polarizedAxes: string[]   // Which axes have opposing camps
  clusters: number          // Number of ideological factions (2+ = high polarization)
  diversity: number         // 0-1, healthy variety (HIGH = good)
}
```

**Key Distinction:**
- **Diversity** (HIGH = GOOD): Members spread evenly across spectrum
- **Polarization** (HIGH = BAD): Members split into opposing camps

**Example:**
```
Community A: [-0.9, -0.7, 0.1, 0.6, 0.8] (5 members)
             One diverse perspective, HIGH diversity, LOW polarization ✅

Community B: [-0.9, -0.8, -0.7] + [0.8, 0.9, 0.9] (6 members)
             Two opposing camps, MEDIUM diversity, HIGH polarization ❌
```

### 3. Ideology Interpretation

Semantic labels derived from vector values (not hardcoded names).

```typescript
interface IdeologyInterpretation {
  governance_style: string    // e.g., "Authoritarian Monarchy"
  economic_system: string     // e.g., "Collectivist"
  cultural_values: string     // e.g., "Traditionalist"
  decision_making: string     // e.g., "Rationalist"
  religion_name?: string      // e.g., "The Order of Steel"
  religion_description?: string
}
```

Labels are **generated dynamically from vector values + governance type**, not from a static list.

### 4. Community Religion

Emerges from ideology when community reaches critical mass (20+ members).

```typescript
interface CommunityReligion {
  id: UUID
  community_id: UUID
  name: string                    // "The Ironbound Covenant"
  short_description: string       // 1-sentence elevator pitch
  long_description: string        // AI-generated lore (2-3 paragraphs)
  ideology_snapshot: IdentityVector // Ideology at time of creation
  core_tenets: string[]           // ["Discipline", "Order", "Unity"]
  sacred_values: string[]         // ["Hierarchy", "Law", "Community"]
  forbidden_actions: string[]     // ["Rebellion", "Anarchy", "Selfishness"]
  created_at: DateTime
  last_updated: DateTime
}
```

---

## Mathematical Formulas

### 1. Vector Distance (Cosine Similarity)

Measures ideological alignment between two vectors (0 = opposite, 1 = identical).

```
similarity = dotProduct(v1, v2) / (magnitude(v1) × magnitude(v2))

Where:
  dotProduct(v1, v2) = Σ(v1[i] × v2[i]) for all axes i
  magnitude(v) = √(Σ(v[i]²) for all axes i)

Returns: 0.0 (completely opposite) to 1.0 (identical)
```

**Implementation:**
```typescript
function cosineSimilarity(a: IdentityVector, b: IdentityVector): number {
  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (const axis of AXES) {
    dotProduct += a[axis] * b[axis]
    magnitudeA += a[axis] * a[axis]
    magnitudeB += b[axis] * b[axis]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (magnitudeA * magnitudeB)
}
```

### 2. Community Ideology Calculation

Weighted blend of member vectors, actions, and inertia.

```
ideology_new = (W_inertia × ideology_prev) +
               (W_members × weightedAverage(member_vectors)) +
               (W_actions × recentActionsVector) +
               (W_text × textAnalysisVector)

Where:
  W_inertia + W_members + W_actions + W_text = 1.0

  Weights depend on governance type:
    Monarchy:  {inertia: 0.4, members: 0.3, actions: 0.2, text: 0.1}
    Democracy: {inertia: 0.2, members: 0.5, actions: 0.2, text: 0.1}

  weightedAverage(vectors) = Σ(vector[i] × rank_weight[i]) / Σ(rank_weight[i])

  rank_weight:
    rank_tier 0 (Sovereign): 10.0
    rank_tier 1 (Advisor):   3.0
    rank_tier 10+ (Member):  1.0
```

**Per-Axis Calculation:**
```typescript
for (const axis of AXES) {
  const memberContribution = weightedAverage(members.map(m => m.identity_json[axis]))
  const actionContribution = recentActionVector[axis]
  const prevContribution = prevIdeology[axis]

  ideologyNew[axis] = (
    0.4 * prevContribution +
    0.3 * memberContribution +
    0.2 * actionContribution +
    0.1 * textContribution
  )
}
```

### 3. Polarization Detection (Bimodal Analysis)

Detects if community is split into opposing camps on specific axes.

```
For each axis:
  1. Calculate standard deviation of member values on that axis
  2. Detect bimodal distribution (two peaks vs. one center)
  3. If std_dev > 0.5 AND distribution is bimodal:
       Mark axis as polarized

polarization_overall = (count of polarized axes) / 5

polarization_clusters = k-means clustering on full vectors
  If k=2+ clusters with > 30% of members in each:
    clusters = k
```

**Bimodality Coefficient (simplified):**
```typescript
function calculateBimodality(values: number[]): number {
  // Check if values cluster at extremes (-1 or +1) vs center (0)
  const extreme = values.filter(v => Math.abs(v) > 0.6).length
  const moderate = values.filter(v => Math.abs(v) < 0.3).length

  // If more extreme than moderate, likely bimodal
  if (extreme > moderate && extreme > values.length * 0.5) {
    return 0.8  // High bimodality (bad)
  }

  return 0.1   // Low bimodality (good diversity)
}
```

**Diversity Score:**
```
diversity = min(1.0, std_dev(member_vectors) / 0.5)

Where:
  std_dev > 0.5: diversity = 1.0 (excellent variety)
  std_dev = 0.25: diversity = 0.5 (moderate variety)
  std_dev = 0: diversity = 0 (all identical)
```

### 4. Social Friction (Future - Morale Impact)

When enabled, ideology mismatch affects morale.

```
friction = vectorDistance(agent_identity, community_ideology) × polarization_multiplier

polarization_multiplier = 1.0 + polarization_overall

frictionSensitivity = 0.5 + ((agent.self_community + 1.0) / 4.0)
  (Collectivists care more about alignment: 0.5-1.0)

rankMultiplier = 0.2 (sovereign) | 0.5 (advisor) | 1.0 (member)

morale_impact = {
  if friction < 0.3:    +(0.3 - friction) × 10 × frictionSensitivity
  if friction > 0.6:    -(friction - 0.6) × 20 × frictionSensitivity × rankMultiplier
  else:                 0
}
```

**Note:** Social friction is not yet integrated; formula documented for future implementation.

### 5. Action Vector Conversion

Maps community actions to ideology shifts.

```typescript
const ACTION_VECTORS: Record<string, IdentityVector> = {
  DECLARE_WAR: {
    order_chaos: 0.3,
    self_community: -0.2,
    logic_emotion: -0.3,    // Wars are emotional
    power_harmony: 0.8,      // Aggressive
    tradition_innovation: -0.1
  },
  FORM_ALLIANCE: {
    order_chaos: -0.1,
    self_community: 0.5,     // Cooperative
    logic_emotion: 0.0,
    power_harmony: -0.4,     // Peaceful
    tradition_innovation: 0.2
  },
  // ... more actions mapped
}

// Calculate weighted vector from recent actions
recentActionsVector = weightedAverage(
  recentActions.map(a => ACTION_VECTORS[a.type]),
  weights by recency (exponential decay)
)
```

### 6. Ideology Interpretation Rules

Convert vector values to semantic labels (stored in `ideology-config.ts`).

```typescript
// Governance interpretation (order_chaos × power_harmony × governanceType)
if (governanceType === 'monarchy') {
  if (order_chaos > 0.5 && power_harmony > 0.5) → "Totalitarian Monarchy"
  if (order_chaos > 0.5 && power_harmony < -0.3) → "Constitutional Monarchy"
  if (order_chaos < -0.5) → "Decentralized Monarchy"
  else → "Balanced Monarchy"
}

// Economic system (self_community)
if (self_community > 0.5) → "Collectivist"
else if (self_community < -0.5) → "Individualist"
else → "Mixed Economy"

// Cultural values (tradition_innovation)
if (tradition_innovation < -0.5) → "Traditionalist"
else if (tradition_innovation > 0.5) → "Progressive"
else → "Pragmatic"

// Decision making (logic_emotion)
if (logic_emotion > 0.5) → "Rationalist"
else if (logic_emotion < -0.5) → "Passionate"
else → "Balanced"
```

### 7. Religion Generation

**Tenets Derivation:**

```typescript
// From ideology vector, derive core tenets
const coreTenets = []

// order_chaos axis
if (order_chaos > 0.5) {
  tenets.push("Discipline and Order")
  tenets.push("Hierarchy and Structure")
} else if (order_chaos < -0.5) {
  tenets.push("Freedom and Spontaneity")
  tenets.push("Individual Liberty")
}

// (Similar for all 5 axes)

// Result: 5-10 core tenets that reflect ideology
```

**Lore Generation:**

AI call with prompt containing:
- Community ideology vector
- Governance style
- Economic system
- Cultural values
- Core tenets (derived above)
- Community bio (if available)
- Recent major events (wars, alliances)

Returns:
- Unique religion name
- Short description (1 sentence)
- Long lore (2-3 paragraphs of narrative)

---

## Database Schema

### 1. Users Table (Modified)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  identity_json JSONB DEFAULT '{"order_chaos":0,"self_community":0,"logic_emotion":0,"power_harmony":0,"tradition_innovation":0}'::jsonb,
  identity_label TEXT DEFAULT 'Citizen',
  freewill NUMERIC DEFAULT 50 CHECK (freewill >= 0 AND freewill <= 100);
```

**Columns:**
- `identity_json`: 5D identity vector
- `identity_label`: Archetype name (e.g., "Warrior", "Citizen")
- `freewill`: Autonomy stat (affects AI decision-making)

### 2. Communities Table (Modified)

```sql
ALTER TABLE communities ADD COLUMN IF NOT EXISTS
  ideology_json JSONB DEFAULT '{"order_chaos":0,"self_community":0,"logic_emotion":0,"power_harmony":0,"tradition_innovation":0}'::jsonb,
  ideology_interpretation JSONB DEFAULT '{}'::jsonb,
  ideology_polarization_metrics JSONB DEFAULT '{}'::jsonb,
  last_ideology_update TIMESTAMPTZ DEFAULT NOW();
```

**Columns:**
- `ideology_json`: Community's 5D ideology vector
- `ideology_interpretation`: Cached interpretation labels (JSON)
  ```json
  {
    "governance_style": "Authoritarian Monarchy",
    "economic_system": "Collectivist",
    "cultural_values": "Traditionalist",
    "decision_making": "Rationalist"
  }
  ```
- `ideology_polarization_metrics`: Cached metrics
  ```json
  {
    "overall": 0.45,
    "polarizedAxes": ["order_chaos"],
    "clusters": 2,
    "diversity": 0.6
  }
  ```
- `last_ideology_update`: Timestamp of last recalculation

### 3. Community Ideology Inputs Table (New)

```sql
CREATE TABLE IF NOT EXISTS community_ideology_inputs (
  community_id UUID PRIMARY KEY REFERENCES communities(id) ON DELETE CASCADE,

  -- Current inputs (enabled)
  include_member_vectors BOOLEAN DEFAULT true,
  include_leader_weight BOOLEAN DEFAULT true,
  include_action_history BOOLEAN DEFAULT true,

  -- Future inputs (disabled by default, enable to add)
  include_community_bio BOOLEAN DEFAULT false,
  include_chat_history BOOLEAN DEFAULT false,
  include_law_proposals BOOLEAN DEFAULT false,
  include_event_history BOOLEAN DEFAULT false,

  -- Weights (per-community customization)
  inertia_weight NUMERIC DEFAULT 0.4 CHECK (inertia_weight >= 0 AND inertia_weight <= 1),
  member_weight NUMERIC DEFAULT 0.3,
  action_weight NUMERIC DEFAULT 0.2,
  text_weight NUMERIC DEFAULT 0.1,
  event_weight NUMERIC DEFAULT 0.0,

  -- Validation: weights sum to 1.0
  CONSTRAINT weights_sum_to_one CHECK (
    inertia_weight + member_weight + action_weight + text_weight + event_weight >= 0.99
    AND inertia_weight + member_weight + action_weight + text_weight + event_weight <= 1.01
  ),

  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose:**
- Controls which data sources feed into ideology calculation
- Allows per-community customization of weights
- Ready to enable bio/chat/event analysis without schema changes

### 4. Community Religions Table (New)

```sql
CREATE TABLE IF NOT EXISTS community_religions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID UNIQUE NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,

  -- Ideology at time of creation (for drift tracking)
  ideology_snapshot JSONB NOT NULL,

  -- Generated from ideology vector
  core_tenets TEXT[] DEFAULT '{}',
  sacred_values TEXT[] DEFAULT '{}',
  forbidden_actions TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
```

**Triggers:**
- Auto-update `last_updated` on regeneration
- Auto-delete if community deleted

---

## API Reference

### Server Actions (`app/actions/ideology.ts`)

#### `getCommunityIdeology(communityId: string)`

Fetches complete ideology data for a community.

**Returns:**
```typescript
{
  ideologyJson: IdentityVector
  interpretation: IdeologyInterpretation
  polarizationMetrics: PolarizationMetrics
  lastUpdate: DateTime
  religion?: CommunityReligion
  memberCount: number
}
```

#### `getMemberAlignment(userId: string, communityId: string)`

Calculates individual member alignment to community ideology.

**Returns:**
```typescript
{
  userId: string
  alignmentScore: number  // 0-1
  vectorDistance: number  // 0-1
  axisDetails: {
    [axis: string]: {
      memberValue: number
      communityValue: number
      difference: number
      aligned: boolean  // diff < 0.3
    }
  }
  predictedFriction?: number  // When social friction enabled
}
```

#### `regenerateReligion(communityId: string)`

Regenerate community religion (AI call). Requires sovereign role.

**Parameters:**
- `communityId`: UUID of community
- `force?: boolean`: Regenerate even if ideology hasn't changed

**Returns:**
```typescript
{
  success: boolean
  religion: CommunityReligion
  message: string
}
```

#### `updateIdeologyInputs(communityId: string, inputs: IdeologyInputConfig)`

Configure which data sources to include in ideology calculation.

**Parameters:**
```typescript
{
  include_member_vectors?: boolean
  include_leader_weight?: boolean
  include_action_history?: boolean
  include_community_bio?: boolean
  include_chat_history?: boolean
  include_law_proposals?: boolean
  inertia_weight?: number  // 0-1
  member_weight?: number
  action_weight?: number
  text_weight?: number
}
```

**Returns:**
```typescript
{
  success: boolean
  appliedWeights: { [key: string]: number }
}
```

#### `recalculateIdeology(communityId: string)`

Force immediate ideology recalculation (normally auto-triggered).

**Returns:**
```typescript
{
  success: boolean
  newIdeology: IdentityVector
  interpretation: IdeologyInterpretation
  polarization: PolarizationMetrics
  timeMs: number  // Execution time
}
```

---

## UI Component Specifications

### 1. IdeologyRadar
**File:** `components/community/ideology-radar.tsx`

Displays 5-axis radar chart.

**Props:**
```typescript
interface IdeologyRadarProps {
  ideology: IdentityVector
  showLabels?: boolean  // Show axis labels
  height?: number       // Default: 400px
  interactive?: boolean // Default: true
}
```

**Features:**
- 5-axis radar chart (recharts)
- Axis labels from config (not hardcoded)
- Color coding: negative = red tint, positive = blue tint
- Tooltip on hover showing exact values
- Responsive to container size

### 2. IdeologyLabels
**File:** `components/community/ideology-labels.tsx`

Displays semantic interpretation labels.

**Props:**
```typescript
interface IdeologyLabelsProps {
  interpretation: IdeologyInterpretation
  governanceType: string
  variant?: 'full' | 'compact'  // Full has tooltips, compact is minimal
}
```

**Display Format (Full):**
```
┌─ GOVERNANCE ─────────────┐
│ Authoritarian Monarchy   │ (icon)
│ Order-focused hierarchical leadership
└──────────────────────────┘

┌─ ECONOMY ────────────────┐
│ Collectivist            │ (icon)
│ Community-first shared resources
└──────────────────────────┘

┌─ CULTURE ────────────────┐
│ Traditionalist          │ (icon)
│ Values heritage and customs
└──────────────────────────┘

┌─ DECISION MAKING ────────┐
│ Rationalist             │ (icon)
│ Logic-driven choices
└──────────────────────────┘
```

All labels/descriptions from `ideology-config.ts`, zero hardcoding.

### 3. PolarizationIndicator
**File:** `components/community/polarization-indicator.tsx`

Status badge showing community unity/discord.

**Props:**
```typescript
interface PolarizationIndicatorProps {
  metrics: PolarizationMetrics
  showDetails?: boolean  // Show breakdown
}
```

**Color Scheme:**
- `overall < 0.3`: 🟢 GREEN - "Unified" (healthy consensus)
- `overall 0.3-0.6`: 🟡 YELLOW - "Moderate Tension" (diverse but stable)
- `overall > 0.6`: 🔴 RED - "Polarized" (opposing factions)

**Details (when enabled):**
```
Polarization: 0.65 (Polarized)
Clusters: 2 ideological factions
Diversity: 0.58 (Moderate)
Contested Axes: order_chaos, power_harmony
```

### 4. ReligionCard
**File:** `components/community/religion-card.tsx`

Displays community religion/ideology narrative.

**Props:**
```typescript
interface ReligionCardProps {
  religion: CommunityReligion
  isSovereign?: boolean
  onRegenerate?: () => void
}
```

**Display Format:**

```
╔════════════════════════════════╗
║   THE ORDER OF STEEL           ║ (title)
║   [Regenerate] (sovereign only)║ (button)
├────────────────────────────────┤
║ A faith of discipline and unity║ (short description)
├────────────────────────────────┤
║ CORE TENETS                    ║
║ • Discipline and Order         ║
║ • Collective Unity             ║
║ • Hierarchy and Structure      ║
├────────────────────────────────┤
║ SACRED VALUES                  ║
║ [Order] [Community] [Law]      ║
├────────────────────────────────┤
║ FORBIDDEN                      ║
║ [Rebellion] [Chaos] [Selfishness]
├────────────────────────────────┤
║ [Show More] - Expand to full   ║
║            lore narrative      ║
╚════════════════════════════════╝
```

### 5. MemberAlignmentList
**File:** `components/community/member-alignment-list.tsx`

Table of all members with ideology alignment scores.

**Props:**
```typescript
interface MemberAlignmentListProps {
  communityId: string
  canViewDetails?: boolean
}
```

**Columns:**
- Avatar + Username
- Alignment Score (0-100%, green/yellow/red)
- Rank Badge (Sovereign/Advisor/Member)
- Actions (View Details, etc.)

**Sortable by:**
- Alignment (default)
- Name
- Rank

**View Details Modal:**
Shows per-axis breakdown for selected member:
```
Member: John
Overall Alignment: 78%

order_chaos:        0.6 vs community -0.2 (diff: 0.8) ❌
self_community:     0.8 vs community  0.5 (diff: 0.3) ✅
logic_emotion:      0.4 vs community  0.4 (diff: 0.0) ✅
power_harmony:     -0.3 vs community  0.6 (diff: 0.9) ❌
tradition_innovation: -0.5 vs community -0.3 (diff: 0.2) ✅

Key Differences: Member is more chaotic and individualist than community average
```

### 6. IdeologyDashboard
**File:** `components/community/ideology-dashboard.tsx`

Unified ideology page combining all components.

**Layout:**
```
[Ideology & Religion] (tab title)

┌─────────────────────────────────┐
│  Radar Chart  │  Interpretation │
│               │  Labels         │
│               │                 │
│               │  Polarization   │
│               │  Status         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Religion Card                  │
│  (or "No religion yet..." )     │
│  [Regenerate] (sovereign only)  │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Member Alignment List          │
│  [Controls if admin]            │
│                                 │
│  John    78%  [████████  ]      │
│  Jane    92%  [██████████]      │
│  Bob     45%  [████    ]        │
└─────────────────────────────────┘

[Admin Controls] (sovereign only)
  - Configure ideology inputs
  - Manual recalculation
  - Reset to defaults
```

---

## Configuration System

### File: `lib/ideology-config.ts`

All non-mathematical labels, thresholds, and rules stored here. **This file should be updated when refining labels, no code changes needed.**

**Structure:**

```typescript
export const IDEOLOGY_CONFIG = {
  // Axis definitions (used in radar, tooltips, explanations)
  axes: [
    {
      key: 'order_chaos',
      label: 'Order vs Chaos',
      description: 'Preference for hierarchy and structure',
      lowLabel: 'Chaos, Flexibility, Anarchy',
      highLabel: 'Order, Hierarchy, Rules'
    },
    // ... 4 more axes
  ],

  // Interpretation rules: vector value ranges → semantic labels
  // These are used to generate governance_style, economic_system, etc.
  interpretationRules: {
    // Governance interpretation (order_chaos × power_harmony × type)
    governance: {
      monarchy: {
        'high_order_high_power': {
          label: 'Totalitarian Monarchy',
          icon: 'crown-shield',
          description: 'Absolute rule with strict order'
        },
        'high_order_low_power': {
          label: 'Constitutional Monarchy',
          icon: 'crown-law',
          description: 'Order maintained through law, not force'
        },
        // ... more combinations
      },
      democracy: { /* ... */ },
      dictatorship: { /* ... */ },
    },

    // Economic system (self_community)
    economy: {
      'high_collectivist': {
        label: 'Collectivist',
        icon: 'people-network',
        description: 'Resources shared, community-first'
      },
      'high_individualist': {
        label: 'Individualist',
        icon: 'person-star',
        description: 'Merit-based, personal achievement'
      },
      'balanced': {
        label: 'Mixed Economy',
        icon: 'balance-scale',
        description: 'Balance between individual and community'
      }
    },

    // Cultural values (tradition_innovation)
    culture: {
      'high_traditionalist': {
        label: 'Traditionalist',
        icon: 'scroll',
        description: 'Values heritage, customs, and established ways'
      },
      'high_progressive': {
        label: 'Progressive',
        icon: 'rocket',
        description: 'Embraces change, innovation, and new ideas'
      },
      'balanced': {
        label: 'Pragmatic',
        icon: 'lightbulb',
        description: 'Adopts what works, respects proven methods'
      }
    },

    // Decision making (logic_emotion)
    decision: {
      'high_rationalist': {
        label: 'Rationalist',
        icon: 'brain',
        description: 'Decisions based on logic and data'
      },
      'high_passionate': {
        label: 'Passionate',
        icon: 'flame',
        description: 'Decisions driven by emotion and intuition'
      },
      'balanced': {
        label: 'Balanced',
        icon: 'scale-balanced',
        description: 'Both logic and emotion inform choices'
      }
    },
  },

  // Thresholds for interpretation
  // (How to map vector values to interpretation labels)
  thresholds: {
    strong_positive: 0.5,    // > 0.5 = strong opinion
    weak_positive: 0.2,      // 0.2-0.5 = mild opinion
    weak_negative: -0.2,     // -0.5 to -0.2 = mild opinion
    strong_negative: -0.5,   // < -0.5 = strong opinion
  },

  // Polarization thresholds
  polarization: {
    unified: 0.3,        // < 0.3 = GREEN
    moderate_tension: 0.6, // 0.3-0.6 = YELLOW
    polarized: 1.0,      // > 0.6 = RED
  },

  // Religion generation triggers
  religion: {
    minMembersToGenerate: 20,
    ideologyShiftThresholdForRegeneration: 0.3,  // Regenerate if shift > this
    generationAIModel: 'claude-3-5-sonnet',      // Which model to use
  },

  // Action vector mappings (how actions shift ideology)
  actionVectors: {
    'DECLARE_WAR': { order_chaos: 0.3, self_community: -0.2, /* ... */ },
    'FORM_ALLIANCE': { order_chaos: -0.1, self_community: 0.5, /* ... */ },
    // ... more actions
  },

  // Member rank weights (governance-specific)
  rankWeights: {
    monarchy: { 0: 10.0, 1: 3.0, 10: 1.0 },      // Sovereign heavily weighted
    democracy: { 0: 1.0, 1: 1.0, 10: 1.0 },      // Equal votes
    dictatorship: { 0: 20.0, 1: 2.0, 10: 0.5 },  // Dictator dominates
  },

  // Default ideology calculation weights
  defaultWeights: {
    inertia: 0.4,    // 40% previous ideology
    members: 0.3,    // 30% member average
    actions: 0.2,    // 20% action history
    text: 0.1,       // 10% text analysis (bio/chat)
  }
}
```

**To refine labels in the future:**
1. Open `lib/ideology-config.ts`
2. Update label names, descriptions, icons
3. Deploy
4. No code changes needed, no DB migrations needed

---

## Extensibility & Future Features

### Phase 2: Social Friction (Morale Integration)

**When to enable:** After ideology system stabilized

**What it does:**
- Members in misaligned communities lose morale (-2 per day if friction > 0.6)
- Polarized communities amplify friction
- Leaders immune to friction (rank multiplier)
- Used formula documented above

**DB Change Needed:**
```sql
CREATE TABLE social_friction_cache (
  user_id UUID,
  community_id UUID,
  friction NUMERIC,
  morale_impact NUMERIC,
  last_calculated TIMESTAMPTZ,
  PRIMARY KEY (user_id, community_id)
);
```

**To Enable:**
1. Create table
2. Update `calculateSocialFriction()` in `lib/ideology.ts`
3. Add cron job to apply morale impacts daily
4. Done (no label/config changes needed)

### Phase 3: Community Bio Analysis

**When to enable:** When communities write bios

**What it does:**
- Analyzes community bio text → ideology vector
- Blends into ideology calculation with configurable weight
- AI extracts values, goals, philosophy from text

**To Enable:**
1. Set `include_community_bio = true` in `community_ideology_inputs`
2. Update `calculateCommunityIdeology()` to call `analyzeBioText()`
3. Define AI prompt for bio analysis
4. Done (formula already supports text_weight)

### Phase 4: Chat History Analysis

**When to enable:** When community chat logging implemented

**What it does:**
- Analyzes recent community chat messages
- Sentiment analysis + topic analysis → ideology vector
- Reflects what community actually talks about

**To Enable:**
1. Ensure chat messages stored in DB
2. Set `include_chat_history = true` in `community_ideology_inputs`
3. Implement `analyzeChatHistory()` function
4. Done (formula already supports)

### Phase 5: Law Proposals Analysis

**When to enable:** When law system stabilized

**What it does:**
- Laws proposed reflect community ideology
- Analyze law proposals → ideology shift
- Tracks what community values through what it laws

**To Enable:**
1. Set `include_law_proposals = true` in `community_ideology_inputs`
2. Implement `analyzeLawProposals()` function
3. Done (formula already supports event_weight)

### Custom Analysis Plugins (Future)

System designed to accept custom analysis functions:

```typescript
interface IdeologyAnalyzer {
  name: string
  analyze: (communityId: string) => Promise<IdentityVector>
  enabled: boolean
  weight: number
}

// Register new analyzers
registerAnalyzer({
  name: 'military_actions',
  analyze: (communityId) => analyzeMilitaryHistory(communityId),
  enabled: false,
  weight: 0.15
})
```

---

## Implementation Checklist

- [ ] Create migration: `_identity_ideology_foundation.sql`
- [ ] Create `lib/ideology-config.ts` with all labels/rules
- [ ] Create `lib/ideology.ts` with core calculations
- [ ] Create `lib/religion.ts` with religion generation
- [ ] Create `lib/db/ideology-functions.ts` with SQL helpers
- [ ] Create `app/actions/ideology.ts` with server actions
- [ ] Create `components/community/ideology-radar.tsx`
- [ ] Create `components/community/ideology-labels.tsx`
- [ ] Create `components/community/polarization-indicator.tsx`
- [ ] Create `components/community/religion-card.tsx`
- [ ] Create `components/community/member-alignment-list.tsx`
- [ ] Create `components/community/ideology-dashboard.tsx`
- [ ] Update `app/community/[slug]/page.tsx` to add ideology tab
- [ ] Update `app/actions/community.ts` to trigger recalculations
- [ ] Update `lib/ai/tools/community_tools.ts` to use real ideology
- [ ] Test: Create community with multiple members
- [ ] Test: Change member ranks and verify ideology updates
- [ ] Test: Verify polarization detection works
- [ ] Test: Regenerate religion and verify lore quality
- [ ] Test: Verify UI displays all data correctly
- [ ] Deploy and monitor for issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-20 | Initial architecture, formulas, and UI specs |
| | | Foundation system using member vectors + action history |
| | | Religion generation system |
| | | Documented future phases: social friction, bio/chat analysis |


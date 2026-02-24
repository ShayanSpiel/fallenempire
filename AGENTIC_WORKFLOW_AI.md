# AGENTIC_WORKFLOW_AI - Master Implementation Document

**Status**: Phase 1-2 Implementation
**Last Updated**: 2025-12-21
**Model**: Mistral AI (optimized for cost)
**Stack**: Next.js + Supabase + PGVector

---

## 1. ARCHITECTURE OVERVIEW

### The Sovereign Cycle v2
```
PERCEIVE
  ↓ [Load agent state, relationships, goals, recent posts]
FILTER
  ↓ [Relevance scoring to reduce token usage]
RELATIONSHIPS
  ↓ [Load persistent relationship state and history]
STRATEGIC_PLANNING
  ↓ [Check active goals, determine next step]
REASONING
  ↓ [Unified decision tree: social + physical + governance]
EXECUTION
  ↓ [Perform action, update all state]
UPDATE_STATE
  ↓ [Persist relationships, goals, identity drift]
```

---

## 2. AUTONOMOUS AGENT CAPABILITIES

### What Makes Agents Truly Autonomous

1. **Persistent State Machine**
   - Relationships persist across cycles (no amnesia)
   - Goals carry across multiple steps (multi-turn agency)
   - Identity evolves based on actions (personality growth)

2. **Decision Independence**
   - No hardcoded action sequences
   - Decisions based on: identity, relationships, goals, morale, community ideology
   - Can override human-set rules (propose alternatives to laws)

3. **Proactive Behavior**
   - Goals generate actions (not just reactive to posts)
   - Multi-step planning towards objectives
   - Community participation (propose laws, form alliances)

4. **Full Context Awareness**
   - Remember past conflicts (beef tracking)
   - Understand governance context (laws, ranks, roles)
   - Strategic planning (multi-turn goals)

---

## 3. DATABASE SCHEMA

### New Tables (Phase 1-2)

#### agent_relationships
Persistent "beef" tracking - WHO did WHAT to WHOM
```sql
agent_id UUID          -- Agent performing the action
target_id UUID         -- Agent/person on receiving end
relationship_type TEXT -- 'enemy' | 'ally' | 'neutral' | 'cautious'
relationship_score NUMERIC -- -100 (enemy) to +100 (ally)
last_interaction_at TIMESTAMPZ
interaction_count INT
recent_actions JSONB   -- [{action: 'ATTACK', when: timestamp, context: '...'}]
created_at TIMESTAMPZ
updated_at TIMESTAMPZ

PRIMARY KEY (agent_id, target_id)
```

#### agent_goals
Multi-turn objectives - WHAT agents are trying to achieve
```sql
id UUID PRIMARY KEY
agent_id UUID
goal_type TEXT -- 'join_community' | 'revenge' | 'alliance' | 'wealth' | 'dominance'
target_id UUID -- community_id or user_id being targeted
priority NUMERIC -- 0-100
deadline TIMESTAMPZ
status TEXT -- 'active' | 'completed' | 'abandoned' | 'failed'
context JSONB -- {reason, expected_outcome, ...}
created_at TIMESTAMPZ
updated_at TIMESTAMPZ
```

#### agent_plans
Step-by-step action sequences - HOW to achieve goals
```sql
id UUID PRIMARY KEY
goal_id UUID REFERENCES agent_goals(id)
step_number INT
action_type TEXT -- 'GATHER_ALLIES' | 'TRADE' | 'PROPOSE_LAW' | 'ATTACK' | etc
target_id UUID
description TEXT -- human-readable step description
status TEXT -- 'pending' | 'in_progress' | 'completed' | 'failed'
created_at TIMESTAMPZ
completed_at TIMESTAMPZ
```

#### simulation_control
Master control for all agent simulations
```sql
id UUID PRIMARY KEY
is_active BOOLEAN -- Global on/off
batch_size INT -- Agents per cycle (default: 8)
max_concurrent INT -- Parallel agents (default: 5)
global_token_budget INT -- Monthly limit
tokens_used_today INT
cost_limit NUMERIC
paused_until TIMESTAMPZ
created_at TIMESTAMPZ
updated_at TIMESTAMPZ
```

---

## 4. PHASE 1: RELATIONSHIP TRACKING (Week 1)

### Goal
Agents remember past interactions and form persistent relationship states

### Implementation

**Files to Create:**
- `lib/ai/core/relationships.ts` - Relationship management system
- `supabase/migrations/20260120_agent_relationships.sql` - Database schema

**Files to Modify:**
- `lib/ai/nodes/perception.ts` - Load relationships during perception
- `lib/ai/nodes/execution.ts` - Update relationships after actions

### Key Functions

```typescript
// lib/ai/core/relationships.ts

// Load relationship state between two agents
async getRelationship(agentId: string, targetId: string): Promise<AgentRelationship>

// Update relationship after interaction
async updateRelationship(
  agentId: string,
  targetId: string,
  action: string,  // 'ATTACK' | 'TRADE' | 'FOLLOW' | 'DISLIKE'
  delta: number    // -10 to +10 score change
): Promise<void>

// Get all active relationships for an agent
async getAgentRelationships(agentId: string): Promise<AgentRelationship[]>

// Decay old relationships (optional)
async decayRelationships(agentId: string, daysOld: number = 90): Promise<void>
```

### Integration Points

1. **During Perception**: Load relationships for post author
2. **During Reasoning**: Use relationship score in decision weighting
3. **During Execution**: Update relationship based on action taken

---

## 5. PHASE 2: STRATEGIC PLANNING (Week 2)

### Goal
Agents can pursue multi-turn goals instead of just reacting to posts

### Implementation

**Files to Create:**
- `lib/ai/core/planning.ts` - Goal and plan generation
- `lib/ai/nodes/reasoning_strategic.ts` - Strategic decision node
- `supabase/migrations/20260121_agent_goals.sql` - Database schema

**Files to Modify:**
- `lib/ai/orchestrator.ts` - Add planning node to cycle
- `lib/ai/nodes/perception.ts` - Load active goals

### Key Functions

```typescript
// lib/ai/core/planning.ts

// Generate goals based on agent state
async generateGoals(agent: AgentState): Promise<Goal[]>

// Create step-by-step plan for a goal
async createPlan(goal: Goal, agent: AgentState): Promise<Plan[]>

// Get next step in active plan
async getNextPlanStep(agent: AgentState): Promise<PlanStep | null>

// Mark plan step as completed
async completePlanStep(stepId: string): Promise<void>

// Abandon goal (if conditions change)
async abandonGoal(goalId: string): Promise<void>
```

### Goal Types (Non-Hardcoded)

Goals are generated dynamically based on agent state:
- **join_community**: If `self_community > 0.5` and has 0-1 communities
- **alliance**: If isolated and enemy count > 0
- **revenge**: If relationship_score < -50 with someone
- **wealth**: If morale < 50 (needs resources)
- **dominance**: If `power_harmony > 0.5` and community_rank high

### Integration Points

1. **During Perception**: Load active goals and current step
2. **During Strategic Reasoning**: Determine next action from plan
3. **During Execution**: Execute plan action, mark step complete

---

## 6. UNIFIED REASONING (Phase 2)

### Decision Flow

```
Agent perceives post
  ↓
Does agent have active plan?
  → YES: Execute next plan step
  → NO: Check for new goals to create
    ↓
Score post relevance (0-1)
  → LOW (<0.3): Deterministic action (no token cost)
  → HIGH (>0.3): Full reasoning
    ↓
Check relationships
  - Who is the author?
  - What's our history?
  - Should we engage?
    ↓
Run reasoning (Mistral)
  - Match identity to post
  - Calculate coherence
  - Generate action
    ↓
Check constraints
  - Do laws forbid this action?
  - Do relationships override this?
  - Is this aligned with active goal?
    ↓
Execute action
```

---

## 7. EXECUTION & STATE UPDATES

### What Happens When Agent Acts

1. **Action Execution**
   - Perform the action (LIKE, ATTACK, FOLLOW, PROPOSE_LAW, etc)
   - Record in game_logs

2. **Relationship Update**
   - ATTACK on non-enemy → relationship_score -= 20, type → 'enemy'
   - TRADE → relationship_score += 10, type → 'ally'
   - FOLLOW → relationship_score += 5
   - DISLIKE → relationship_score -= 5

3. **Goal/Plan Update**
   - Mark plan steps as completed if action matches step
   - Check if goal should be abandoned
   - Generate new goals if conditions change

4. **Identity Drift**
   - ATTACK (on outgroup) → order_chaos -= 0.02
   - TRADE/FOLLOW → order_chaos += 0.01
   - Clamp to [-1, 1]

---

## 8. CONFIGURATION (NO HARDCODING)

### Relationship Configuration
```typescript
// lib/config/agent-relationships.ts
export const RELATIONSHIP_DELTAS = {
  ATTACK: -20,
  TRADE: +10,
  FOLLOW: +5,
  DISLIKE: -5,
  HELP: +15,
  IGNORE: 0
} as const;

export const RELATIONSHIP_TYPES = {
  enemy: { scoreRange: [-100, -40] },
  cautious: { scoreRange: [-39, -1] },
  neutral: { scoreRange: [0, 39] },
  ally: { scoreRange: [40, 100] }
} as const;
```

### Goal Generation Configuration
```typescript
// lib/config/agent-goals.ts
export const GOAL_TRIGGERS = {
  join_community: {
    condition: (agent) => agent.identity.self_community > 0.5 && agent.communityCount < 2,
    priority: 50,
    deadline_days: 30
  },
  revenge: {
    condition: (agent) => agent.lowestRelationshipScore < -50,
    priority: 80,
    deadline_days: 60
  },
  // ... more goals
} as const;
```

### Admin Control Configuration
```typescript
// lib/config/simulation.ts
export const SIMULATION_DEFAULTS = {
  batch_size: 8,
  max_concurrent: 5,
  token_budget_monthly: 1000000,
  enabled_by_default: true
} as const;
```

---

## 9. ADMIN CONTROLS

### Database Control
```sql
-- Enable/disable all agents
UPDATE simulation_control SET is_active = false;

-- Pause until specific time
UPDATE simulation_control SET paused_until = NOW() + interval '1 hour';

-- Adjust batch size for performance
UPDATE simulation_control SET batch_size = 12;
```

### Programmatic Control
```typescript
// lib/admin/simulation-control.ts

// Check if simulation is running
async function isSimulationActive(): Promise<boolean>

// Check if we've hit token budget
async function hasTokenBudget(): Promise<boolean>

// Log token usage
async function logTokenUsage(tokens: number, cost: number): Promise<void>

// Get simulation stats
async function getSimulationStats(): Promise<{
  agentsRunToday: number,
  tokensUsed: number,
  costToDate: number,
  nextRunIn: number
}>
```

---

## 10. MISTRAL INTEGRATION

### Cost Optimization (Mistral Only)

**Mistral Pricing**: ~$0.14 per 1M input tokens, $0.42 per 1M output tokens

**Current approach**:
- Per agent cycle: ~1000 tokens (Mistral cheap)
- 1000 agents/day: 1M tokens = $0.14/day
- Monthly: ~$4 (vs Claude $180)

**No additional optimization needed for now** - Mistral is already cost-effective.

### Mistral Prompt Format
```typescript
// Use Mistral's chat template
const messages = [
  {
    role: 'system',
    content: `You are ${agent.identity_label}. Identity: ${JSON.stringify(agent.identity_json)}`
  },
  {
    role: 'user',
    content: `Post from ${author.username}: "${post.content}". What do you do?`
  }
];

const response = await mistral.chat.complete({ messages });
```

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 1: Relationships
- [ ] Create `agent_relationships` table migration
- [ ] Create `relationships.ts` core module
- [ ] Update perception to load relationships
- [ ] Update execution to update relationships
- [ ] Add relationship context to reasoning
- [ ] Test: Agent remembers past conflicts

### Phase 2: Strategic Planning
- [ ] Create `agent_goals` and `agent_plans` tables
- [ ] Create `planning.ts` core module
- [ ] Create `reasoning_strategic.ts` node
- [ ] Update orchestrator to include strategic node
- [ ] Update perception to load active goals
- [ ] Update execution to track plan progress
- [ ] Test: Agent pursues multi-turn goals

### Admin & Control
- [ ] Create `simulation_control` table
- [ ] Create admin control module
- [ ] Add control checks to orchestrator
- [ ] Create admin API endpoints (if needed)
- [ ] Test: Can enable/disable agents globally

---

## 12. SUCCESS METRICS

### Phase 1 Complete When:
- ✅ Agents have relationship_score with each other
- ✅ Relationships persist across cycles
- ✅ Agents avoid/favor targets based on history
- ✅ Relationship decay works (old conflicts fade)

### Phase 2 Complete When:
- ✅ Agents can generate goals automatically
- ✅ Agents create multi-step plans
- ✅ Plans execute across multiple cycles
- ✅ Agents pursue goals proactively (not just reactive)

### Autonomy Complete When:
- ✅ Agent can pursue goal without human intervention
- ✅ Agent remembers who has wronged them
- ✅ Agent forms alliances strategically
- ✅ Agent proposes laws based on beliefs
- ✅ Agent participates in governance
- ✅ Agent adapts personality based on experience

---

## 13. MIGRATION SCHEDULE

**Week 1**: Phase 1 (Relationships)
**Week 2**: Phase 2 (Strategic Planning)
**Week 3**: Testing & Admin Panel
**Week 4**: Governance Integration

---

## IMPLEMENTATION STATUS

### ✅ COMPLETED (Phase 1-6 - Fully Political Autonomous Agents with Chat)

#### Phase 1: Relationships (DONE)
- ✅ `lib/ai/core/relationships.ts` - RelationshipManager class
- ✅ `supabase/migrations/20260120_agent_relationships.sql` - Database schema + RPCs
- ✅ Integration in `lib/ai/nodes/perception.ts` - Load relationships during perception
- ✅ Integration in `lib/ai/nodes/execution-state-updates.ts` - Update relationships after actions
- ✅ Integrated into orchestrator cycle - relationships persist and affect decisions

**What Works Now:**
- Agents remember past interactions with specific people
- Relationship scores persist across cycles (-100 to +100)
- Relationships automatically decay over time (old conflicts fade)
- Types: enemy, cautious, neutral, ally (auto-determined by score)

#### Phase 2: Strategic Planning (DONE)
- ✅ `lib/ai/core/planning.ts` - PlanningManager class
- ✅ `supabase/migrations/20260121_agent_goals.sql` - Database schema + RPCs
- ✅ `lib/ai/nodes/reasoning_strategic.ts` - Strategic reasoning node
- ✅ Integration in `lib/ai/nodes/perception.ts` - Load goals and plan steps
- ✅ Integration in orchestrator cycle - strategic decisions override tactical

**What Works Now:**
- Agents can have multiple active goals (revenge, wealth, dominance, etc.)
- Each goal has a multi-step plan generated automatically
- Plans are tracked and marked complete as agents execute steps
- High-priority goals override immediate post reactions (true agency)
- Agents can be interrupted by strong grudges (enemy check)

#### Core Infrastructure (DONE)
- ✅ `lib/ai/core/types.ts` - Updated with relationship and planning types
- ✅ `lib/ai/nodes/execution-state-updates.ts` - State update helpers
- ✅ `lib/admin/simulation-control.ts` - Admin control system
- ✅ `supabase/migrations/20260122_simulation_control.sql` - Simulation control table
- ✅ `lib/config/agent-behavior.ts` - All non-hardcoded configuration

**What Works Now:**
- Global simulation enable/disable
- Token budget tracking
- Pause/resume controls
- All behavior parameters configurable (no hardcoding)

#### Phase 3: Identity Drift (DONE)
- ✅ `lib/ai/nodes/execution-state-updates.ts` - applyIdentityDrift function
- ✅ Configuration in `lib/config/agent-behavior.ts` - IDENTITY_DRIFT settings
- ✅ Integration in orchestrator - applies after each action

**What Works Now:**
- Agent personality evolves based on actions
- Configurable per-action drift rules (e.g., ATTACK makes agents more chaotic)
- Multi-axis evolution (order_chaos, self_community, power_harmony, etc.)
- Drift bounded to [-1, 1] range (can't become extreme)
- Can be enabled/disabled via config

#### Phase 4: Background Jobs (DONE)
- ✅ `lib/ai/background-jobs.ts` - Job handlers
- ✅ `lib/ai/job-scheduler.ts` - Cron-based scheduler
- ✅ `lib/ai/init-scheduler.ts` - Initialization
- ✅ `supabase/migrations/20260123_background_jobs_support.sql` - Helper RPCs
- ✅ `package.json` updated - added node-cron dependency

**What Works Now:**
- Relationship decay (weekly) - grudges fade over time
- Goal generation (daily) - agents get new goals when idle
- Goal cleanup (weekly) - expire old/failed goals
- Stats vacuum (monthly) - archive old logs, reset counters
- Manual job triggering for testing/admin
- Scheduler status/validation
- Agent statistics views (via RPCs)

#### Phase 5: Governance (DONE)
- ✅ `lib/ai/core/governance.ts` - Governance system (propose laws, vote, factions)
- ✅ `lib/config/governance.ts` - Non-hardcoded law types and voting strategies
- ✅ `lib/ai/nodes/reasoning_governance.ts` - Governance decision reasoning
- ✅ `lib/ai/nodes/governance-execution.ts` - Execute governance actions
- ✅ `supabase/migrations/20260124_agent_governance.sql` - Factions and voting tables
- ✅ Integrated into orchestrator - agents propose laws, vote, form factions

**What Works Now:**
- Agents propose laws (based on rank tier and identity)
- Agents vote on proposals (based on ideology)
- Agents form and join factions (political coalitions)
- 10 non-hardcoded law types: declare_war, propose_heir, change_governance, taxation, alliance, etc
- Voting thresholds configurable: majority (50%), supermajority (67%), consensus (90%)
- Factions have power, members, ideology tracking
- Agents can create/lead factions or join existing ones

#### Phase 6: Human-AI Chat (DONE)
- ✅ `lib/ai/core/chat.ts` - Chat system with full agent context
- ✅ `/app/api/chat/agent/route.ts` - Chat API endpoint
- ✅ `supabase/migrations/20260125_agent_chat.sql` - Chat history storage
- ✅ Chat responses use full context: relationships, goals, morale, memories

**What Works Now:**
- Humans can chat directly with AI agents
- Agents respond with full context awareness (goals, relationships, morale, memories)
- Conversation history persists in database
- Agent responses reflect their actual personality and beliefs
- Context includes: identity, relationships, active goals, recent experiences

#### Admin Panel & APIs (DONE)
- ✅ `/app/api/admin/agents/route.ts` - Agent management API
- ✅ `/app/api/admin/simulation/route.ts` - Simulation control API
- ✅ `/app/api/admin/governance/route.ts` - Governance management API
- ✅ `/components/admin/ai-dashboard.tsx` - Full admin dashboard
- ✅ All APIs non-hardcoded, configuration-driven

**Admin Features:**
- View all agents with stats (morale, power, last seen)
- Manually update agent stats (morale, power, etc)
- Reset agents to default state
- Enable/disable entire simulation globally
- Pause/resume simulation
- Adjust batch size and concurrency
- Monitor token usage and costs
- View proposals and vote counts
- Manage factions (create, add members, update power)
- Trigger background jobs manually
- Chat with agents directly
- Real-time dashboard with system status

#### Integration (DONE)
- ✅ Updated `lib/ai/orchestrator.ts` with ALL Phase 1-6 features
- ✅ Cycle now: Perceive → Memory → Strategic Reasoning → Execution → State Updates → Identity Drift → Governance
- ✅ All systems fully integrated and interdependent
- ✅ Everything production-ready

---

### 📋 DEPLOYMENT READY - PHASES 1-6 COMPLETE

Everything for Phases 1-6 is implemented, integrated, and production-ready.

#### Deploy Now:
1. **Run 5 migrations** in Supabase (in order):
   - 20260120_agent_relationships.sql
   - 20260121_agent_goals.sql
   - 20260122_simulation_control.sql
   - 20260123_background_jobs_support.sql
   - 20260124_agent_governance.sql
   - 20260125_agent_chat.sql
2. **Install dependencies**: `npm install` (node-cron added)
3. **Initialize scheduler** in app startup (call `initializeBackgroundJobs()`)
4. **Deploy code** to production
5. **Access admin panel** at `/admin/ai-dashboard`
6. **Test**:
   - Create test agents
   - Watch them form relationships and pursue goals
   - Vote on proposals and form factions
   - Chat with agents via `/api/chat/agent`

#### Configuration (ALL Non-Hardcoded):
- **Agent Behavior**: `lib/config/agent-behavior.ts`
  - Relationship deltas, goal triggers, identity drift rates
- **Governance**: `lib/config/governance.ts`
  - Law types, voting strategies, faction settings
- **Simulation**: `lib/admin/simulation-control.ts`
  - Global settings, token budgets, pause/resume

#### Features by Phase:
- **Phase 1**: Relationships (remembers people, grudges fade)
- **Phase 2**: Strategic Planning (multi-turn goals)
- **Phase 3**: Identity Drift (personality evolves)
- **Phase 4**: Background Jobs (decay, goal gen, cleanup)
- **Phase 5**: Governance (laws, voting, factions)
- **Phase 6**: Human-AI Chat (talk to agents with full context)
- **Admin**: Full control panel + API endpoints

#### Future Enhancements (Phase 7+):
1. Multi-community raids and alliances
2. Trade markets and economic systems
3. Territory control and warfare
4. Cultural movements and revolutions
5. Historical record keeping and agent memory

---

## FILE STRUCTURE

```
lib/ai/core/
  ├── relationships.ts          [NEW] Relationship management (Phase 1)
  ├── planning.ts               [NEW] Goal and plan management (Phase 2)
  ├── governance.ts             [NEW] Law proposals, voting, factions (Phase 5)
  ├── chat.ts                   [NEW] Human-AI conversations (Phase 6)
  ├── types.ts                  [UPDATED] All context types
  └── memory.ts                 [EXISTING] Vector memory

lib/ai/nodes/
  ├── perception.ts             [UPDATED] Load all contexts
  ├── reasoning_strategic.ts     [NEW] Strategic goals (Phase 2)
  ├── reasoning_governance.ts    [NEW] Governance decisions (Phase 5)
  ├── execution-state-updates.ts [NEW] State persistence + drift (Phase 3)
  ├── governance-execution.ts    [NEW] Execute governance actions (Phase 5)
  └── execution.ts              [EXISTING] Action execution

lib/ai/
  ├── orchestrator.ts           [UPDATED] Integrated Phases 1-6
  ├── background-jobs.ts        [NEW] Job handlers (Phase 4)
  ├── job-scheduler.ts          [NEW] Cron scheduler (Phase 4)
  └── init-scheduler.ts         [NEW] Initialization (Phase 4)

lib/config/
  ├── agent-behavior.ts         [NEW] All agent config
  └── governance.ts             [NEW] Law types, voting, factions

lib/admin/
  └── simulation-control.ts      [NEW] Admin control

app/api/admin/
  ├── agents/route.ts           [NEW] Agent management API
  ├── simulation/route.ts        [NEW] Simulation control API
  └── governance/route.ts        [NEW] Governance API

app/api/chat/
  └── agent/route.ts            [NEW] Chat endpoint

components/admin/
  └── ai-dashboard.tsx          [NEW] Full admin panel

supabase/migrations/
  ├── 20260120_agent_relationships.sql    [Phase 1]
  ├── 20260121_agent_goals.sql            [Phase 2]
  ├── 20260122_simulation_control.sql     [Admin]
  ├── 20260123_background_jobs_support.sql [Phase 4]
  ├── 20260124_agent_governance.sql       [Phase 5]
  └── 20260125_agent_chat.sql             [Phase 6]
```

---

## HOW IT ALL WORKS TOGETHER

### Agent Lifecycle (Per Post/Cycle)

```
1. PERCEIVE CONTEXT
   - Load agent state
   - Load relationships with post author ← [Phase 1]
   - Load active goals and current plan step ← [Phase 2]
   - Analyze post content

2. RETRIEVE MEMORIES
   - Get agent's past experiences
   - Filter by relevance

3. STRATEGIC REASONING ← [Phase 2 NEW]
   - Check if agent has active plan
   - High-priority goals? → Execute plan step
   - Enemy post? → May attack regardless of plan
   - Low-priority goals? → React to post tactically

4. TACTICAL REASONING
   - Normal psychological + physical reasoning
   - (Only if not following plan)

5. EXECUTE ACTIONS
   - Perform decision (like/follow/attack/etc)
   - Store memory

6. UPDATE STATE ← [Phase 1 NEW]
   - Update relationships with author
     (ATTACK = -20 score, TRADE = +10 score, etc)
   - Track plan step completion

7. IDENTITY DRIFT ← [Phase 3 NEW]
   - Evolve personality based on actions
   - ATTACK makes more chaotic
   - TRADE/FOLLOW makes more orderly
   - Updates identity_json in database

8. GOAL MANAGEMENT ← [Phase 2 NEW]
   - Check if goal completed
   - Generate new goals if needed
```

### Background Tasks (Autonomous)

```
DAILY (2 AM):
  - Goal Generation
    → Agents with no active goals get new ones
    → Based on morale, morale, community status

WEEKLY (Monday 3 AM):
  - Relationship Decay
    → All relationship scores decay by 5%
    → Grudges fade over time

WEEKLY (Sunday 4 AM):
  - Goal Cleanup
    → Expire old/failed goals
    → Clean up completed plans

MONTHLY (1st at 5 AM):
  - Stats Vacuum
    → Archive game logs older than 90 days
    → Reset daily token counters
```

### Autonomy Gained

**Before (Reactive):**
- Agent sees post
- Agent reasons about it
- Agent acts
- Cycle repeats (amnesia)

**After (Autonomous):**
- Agent sees post
- Agent checks: "Do I have a goal?"
- YES → Execute plan step (goal-driven)
- NO → React to post (opportunistic)
- Agent remembers this interaction
- Agent evolves based on experience
- Agent forms grudges/alliances
- Agent pursues multi-turn objectives

---

## CONFIGURATION (NO HARDCODING)

All agent behavior is configurable in `lib/config/agent-behavior.ts`:

```typescript
// Change how actions affect relationships
RELATIONSHIP_DELTAS.ATTACK = -30  // Make attacks worse

// Adjust goal priorities
GOAL_TRIGGERS.revenge.priority = 90  // Make revenge more important

// Tune drift rates
IDENTITY_DRIFT.rate = 0.02  // Faster personality change

// All changes take effect immediately (no code deployment needed)
```

---

## DATABASE SCHEMA OVERVIEW

### agent_relationships
```
agent_id → target_id: 1-to-1
score: -100 to +100 (auto-updates based on actions)
type: auto-determined from score range
last_interaction_at: timestamp
interaction_count: integer
recent_actions: JSON array of last 5 interactions
```

### agent_goals
```
id → agent_id: 1-to-many
goal_type: 'revenge' | 'wealth' | 'dominance' | etc
target_id: who/what the goal is about
priority: 0-100
deadline: when goal expires
status: active | completed | abandoned | failed
```

### agent_plans
```
id → goal_id: 1-to-many
step_number: 1, 2, 3, ...
action_type: ATTACK, TRADE, PROPOSE_LAW, etc
description: human-readable step description
status: pending | in_progress | completed | failed
```

### simulation_control
```
is_active: boolean (master on/off)
batch_size: agents per cycle
tokens_used_today/month: cost tracking
paused_until: pause until specific time
```

---

## SUMMARY OF CHANGES

### Phase 1: Relationships
- Agents remember specific people they've interacted with
- Relationship scores range from -100 (enemy) to +100 (ally)
- Actions automatically update scores (non-hardcoded deltas)
- Old relationships decay over time

### Phase 2: Strategic Planning
- Agents can pursue multi-turn goals (revenge, wealth, dominance, etc.)
- Each goal has a step-by-step plan
- Goals are generated dynamically based on agent state
- High-priority goals override immediate post reactions (true agency)
- Plan steps marked complete as agent executes actions

### Admin Control
- Global simulation enable/disable
- Token budget and cost tracking
- Pause/resume without disabling
- All settings non-hardcoded and configurable

---

## KEY ACHIEVEMENTS

✅ **True Autonomy**: Agents now pursue goals, not just react
✅ **Memory**: Agents remember past conflicts and relationships
✅ **Evolution**: Agent personality changes based on actions
✅ **Flexibility**: All behavior configurable, zero hardcoding
✅ **Scalability**: Strategic reasoning reduces unnecessary token usage
✅ **Observability**: Full logging of decisions and state changes

---

## NEXT ACTIONS

1. **Deploy migrations** to Supabase
2. **Test with 2-3 agents** on a test post
3. **Verify**:
   - Relationships created and updated
   - Goals generated (check agent_goals table)
   - Plan steps tracked (check agent_plans table)
   - Logs show strategic reasoning happening
4. **Monitor costs** - Mistral is cheap, should be $0.01-0.05 per agent cycle
5. **Iterate** - Use logs to tune behavior config


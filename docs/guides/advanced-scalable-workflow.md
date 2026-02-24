# Advanced Scalable Workflow Architecture

## Executive Summary

This document outlines the transformation from a **hardcoded, scope-based AI system** to a **truly autonomous, tool-augmented reasoning system** that scales to all scenarios without requiring manual workflow definitions.

**Current Problem**: AI agents receive pre-fetched data (hardcoded 10 messages, 5 posts, 5 memories) and act as decision trees, not intelligent agents.

**Solution**: Tool-based architecture where AI dynamically decides what data it needs, plans multi-step sequences, handles failures, and preserves context across complex workflows.

---

## Table of Contents

1. [The Problem: Hardcoded Scopes](#the-problem-hardcoded-scopes)
2. [The Solution: Tool-Augmented Reasoning](#the-solution-tool-augmented-reasoning)
3. [Core Architecture](#core-architecture)
4. [Node Responsibilities](#node-responsibilities)
5. [Example Scenarios](#example-scenarios)
6. [Implementation Plan](#implementation-plan)
7. [Tool Registry Design](#tool-registry-design)
8. [State Management](#state-management)
9. [Benefits](#benefits)

---

## The Problem: Hardcoded Scopes

### Current Architecture (Broken)

```typescript
// scope-builder.ts - EVERYTHING PRE-FETCHED
export async function buildChatEventScope(context) {
  // Fetch agent profile
  const agent = await supabaseAdmin.from("users").select("*")...

  // Fetch user profile
  const user = await supabaseAdmin.from("users").select("*")...

  // Fetch agent's communities
  const agentCommunities = await supabaseAdmin...

  return {
    dataScope: {
      messages: { limit: 10 },      // HARDCODED
      posts: { limit: 5 },           // HARDCODED
      memories: { limit: 5 },        // HARDCODED
      relationships: { userId },     // HARDCODED
    }
  }
}
```

### Problems with Current Approach

❌ **Not Scalable**: Every new scenario requires new hardcoded scope
❌ **Not Intelligent**: AI gets same data every time, can't adapt to context
❌ **Wasteful**: Fetches data that may never be used
❌ **Inflexible**: Simple "hi" gets same treatment as complex battle query
❌ **Not Autonomous**: Can't handle multi-step scenarios requiring dynamic planning

### Example of Hardcoded Workflow

```typescript
// dm-workflow.ts - Specific to DMs only
export const dmWorkflow = {
  nodes: {
    observe: observeNode,  // Pre-fetches everything
    reason: reasonNode,    // Just picks from pre-fetched data
    act: actNode,         // Executes hardcoded action
  }
}

// Need separate workflows for:
// - post-workflow.ts
// - battle-workflow.ts
// - governance-workflow.ts
// - market-workflow.ts
// ... every scenario needs its own workflow!
```

---

## The Solution: Tool-Augmented Reasoning

### New Architecture (Intelligent)

```
┌─────────────────────────────────────────────┐
│            OBSERVE NODE                     │
│  - Parse trigger (what happened?)           │
│  - Load actor state (who am I?)             │
│  - Load subject (who/what involved?)        │
│  - Set scope boundaries (what CAN I access?)│
│  → OUTPUT: Minimal situational awareness    │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│            REASON NODE                      │
│  - Analyze situation                        │
│  - Decide what info needed                  │
│  - Make tool calls dynamically              │
│  - Plan multi-step sequence                 │
│  - Synthesize into decision                 │
│  → OUTPUT: Decision + plan                  │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│            ACT NODE                         │
│  - Execute ONE action from plan             │
│  - Use action tools (reply, fight, buy)     │
│  → OUTPUT: Action result (success/failure)  │
└────────────────┬────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────┐
│            LOOP NODE                        │
│  ← THE MAGIC HAPPENS HERE                   │
│  - Check if goal is complete                │
│  - Check if action failed (replan)          │
│  - Check if more steps needed (continue)    │
│  - Check if context requires follow-up      │
│  → OUTPUT: Continue or END                  │
└────────────────┬────────────────────────────┘
                 │
                 ├─ Goal complete? → END
                 ├─ Action failed? → REASON (replan)
                 └─ More steps? → REASON (continue)
```

### Key Principles

✅ **ONE Universal Workflow**: Works for all triggers (messages, battles, markets, schedules)
✅ **Dynamic Data Fetching**: AI decides what it needs via tools
✅ **Multi-Step Planning**: AI can chain actions (work → buy → eat → fight)
✅ **Error Handling**: Failed actions trigger replanning
✅ **Context Preservation**: AI remembers original goal across sub-tasks

---

## Core Architecture

### Universal Workflow (One for All Scenarios)

```typescript
// lib/ai-system/workflows/universal-workflow.ts

export const universalAgentWorkflow = {
  nodes: {
    observe: observeNode,
    reason: reasonNode,
    act: actNode,
    loop: loopNode,
  },

  edges: {
    START: "observe",
    observe: "reason",
    reason: "act",
    act: "loop",
    loop: (state) => {
      if (state.goalComplete) return END;
      return "reason"; // Continue workflow
    }
  }
};
```

### How It Handles Different Triggers

```typescript
// Same workflow, different triggers

// Trigger 1: Direct message
triggerWorkflow({
  type: "chat",
  event: "message.received",
  data: { userId, message }
});

// Trigger 2: Battle started
triggerWorkflow({
  type: "battle",
  event: "battle.started",
  data: { battleId }
});

// Trigger 3: Market check (scheduled)
triggerWorkflow({
  type: "schedule",
  event: "market.check",
  data: { timestamp }
});

// All use the SAME workflow!
```

---

## Node Responsibilities

### 1. OBSERVE Node

**Role**: Minimal situational awareness

**What it does**:
- Parse trigger (what just happened?)
- Load basic actor state (who am I right now?)
- Load subject context (who/what triggered this?)
- Define scope boundaries (what am I ALLOWED to access?)

**What it does NOT do**:
- ❌ Heavy data fetching
- ❌ Decision making
- ❌ Tool calling

```typescript
// lib/ai-system/nodes/observe.ts

export async function observeNode(state: WorkflowState) {
  // 1. Parse trigger
  const trigger = {
    type: state.trigger.type,        // "chat", "battle", "schedule"
    event: state.trigger.event,      // "message.received", "battle.started"
    timestamp: new Date(),
  };

  // 2. Load minimal actor state (cached if possible)
  const actor = {
    id: state.agentId,
    identity: state.identity,
    morale: state.morale,
    energy: state.energy,
  };

  // 3. Load subject context (the trigger content)
  const subject = {
    id: state.trigger.subjectId,     // userId, battleId, etc.
    type: state.trigger.subjectType, // "user", "battle", "market"
    content: state.trigger.content,  // message text, battle details, etc.
  };

  // 4. Define scope boundaries (RULES, not DATA)
  const boundaries = {
    canAccessUsers: true,
    canAccessCommunities: true,
    canAccessBattles: trigger.type === "battle",
    canAccessMarket: trigger.type === "schedule",
    allowedActions: getAllowedActionsForTrigger(trigger.type),
  };

  return {
    step: "reason",
    observation: {
      trigger,
      actor,
      subject,
      boundaries,
    }
  };
}

// Time: ~50ms (fast, minimal DB queries)
```

**Analogy**: Security guard at entrance
- "You're Agent X" (identity check)
- "User Y just messaged you" (situation report)
- "Here's what you're allowed to access" (security clearance)

---

### 2. REASON Node

**Role**: Intelligent analysis and planning

**What it does**:
- Analyze situation from observation
- Decide what additional data is needed
- Make tool calls dynamically
- Plan multi-step sequences
- Synthesize decision

```typescript
// lib/ai-system/nodes/reason.ts

export async function reasonNode(state: WorkflowState) {
  const llm = getLLMManager();
  const observation = state.observation;

  // Build system prompt with minimal context
  const systemPrompt = `
You are Agent ${observation.actor.id} with the following identity:
${JSON.stringify(observation.actor.identity)}

Current stats:
- Morale: ${observation.actor.morale}
- Energy: ${observation.actor.energy}

SITUATION: ${formatSituation(observation)}

AVAILABLE TOOLS:
${formatToolDescriptions(getAllTools())}

ALLOWED ACTIONS: ${observation.boundaries.allowedActions.join(", ")}

Analyze the situation and decide:
1. What additional context do you need? (call tools to get it)
2. What should you do? (provide reasoning)
3. If multi-step, create a plan (list of actions)
4. If you need resources you don't have, plan how to get them first

Be strategic and consider your identity, morale, and relationships.
`;

  // LLM decides what tools to call
  const response = await llm.complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: observation.subject.content }
    ],
    tools: getAllTools(), // All registered tools available
    toolChoice: "auto",   // Let AI decide
    maxTokens: 2000,
  });

  // Execute tool calls
  const toolResults = [];
  if (response.toolCalls) {
    for (const toolCall of response.toolCalls) {
      const result = await executeTool(toolCall.name, toolCall.args);
      toolResults.push({
        toolName: toolCall.name,
        args: toolCall.args,
        result,
      });
    }
  }

  // Feed tool results back for final decision
  const decision = await llm.complete({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: observation.subject.content },
      {
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls
      },
      ...toolResults.map(r => ({
        role: "tool",
        name: r.toolName,
        content: JSON.stringify(r.result)
      })),
      {
        role: "user",
        content: "Based on the tool results, what's your decision and plan?"
      }
    ],
  });

  // Parse decision and plan
  const parsed = parseDecision(decision.content);

  return {
    step: "act",
    reasoning: decision.content,
    decision: parsed.action,
    plan: parsed.steps || [],
    contextMemory: {
      ...state.contextMemory,
      original_trigger: observation.trigger,
      ...parsed.contextToRemember,
    }
  };
}

// Time: ~1-3s (LLM + dynamic tool calls)
```

**Analogy**: Detective investigating
- "Someone wants me to join their community"
- "Let me investigate: Who are they? What community? Do I trust them?"
- "Based on evidence, here's my plan..."

---

### 3. ACT Node

**Role**: Execute ONE action

**What it does**:
- Execute the decided action
- Use action tools (reply, fight, buy, work)
- Return success/failure status

```typescript
// lib/ai-system/nodes/act.ts

export async function actNode(state: WorkflowState) {
  const action = state.decision;

  try {
    // Execute action using action tools
    const result = await executeTool(action.tool, action.args);

    return {
      step: "loop",
      actionHistory: [
        ...state.actionHistory,
        {
          action: action.tool,
          args: action.args,
          status: "success",
          result,
          timestamp: new Date(),
        }
      ],
      // Update plan (remove completed step)
      plan: state.plan.slice(1),
    };

  } catch (error) {
    return {
      step: "loop",
      actionHistory: [
        ...state.actionHistory,
        {
          action: action.tool,
          args: action.args,
          status: "failed",
          error: error.message,
          timestamp: new Date(),
        }
      ],
    };
  }
}
```

---

### 4. LOOP Node

**Role**: Decide continuation

**What it does**:
- Check if goal is complete
- Check if action failed (trigger replanning)
- Check if more steps needed
- Check if context requires follow-up
- Decide: END or continue to REASON

```typescript
// lib/ai-system/nodes/loop.ts

export async function loopNode(state: WorkflowState) {
  const lastAction = state.actionHistory[state.actionHistory.length - 1];

  // 1. Check if action failed → replan
  if (lastAction?.status === "failed") {
    return {
      step: "reason",
      context: {
        error: lastAction.error,
        instruction: `Previous action '${lastAction.action}' failed with error: ${lastAction.error}. Adjust your plan.`,
      }
    };
  }

  // 2. Check if plan has more steps → continue
  if (state.plan && state.plan.length > 0) {
    return { step: "reason" };
  }

  // 3. Check if context requires follow-up
  if (state.contextMemory.reply_needed && !state.contextMemory.replied) {
    return {
      step: "reason",
      context: {
        reminder: "Original trigger requires a response. Remember to reply.",
      }
    };
  }

  // 4. Ask AI if goal is complete
  const llm = getLLMManager();
  const completion = await llm.complete({
    messages: [
      {
        role: "system",
        content: `Original goal: ${state.observation.trigger.event}
Action history: ${JSON.stringify(state.actionHistory)}
Is the original goal complete? Answer YES or NO with brief explanation.`
      }
    ],
    maxTokens: 100,
  });

  const isComplete = completion.content.toLowerCase().includes("yes");

  if (isComplete) {
    return { step: "END" };
  } else {
    return { step: "reason" };
  }
}
```

---

## Example Scenarios

### Example 1: Simple Message (No Tools Needed)

**Trigger**: User sends "Hi"

```
OBSERVE:
{
  trigger: { type: "chat", event: "message.received" },
  actor: { id: "agent-123", morale: 50 },
  subject: { id: "user-456", content: "Hi" }
}

REASON:
AI Analysis: "Simple greeting. No complexity. Respond friendly."
Tool calls: None
Decision: send_message(user-456, "Hey! What's up?")
Plan: []

ACT:
Execute: send_message(user-456, "Hey! What's up?")
Result: SUCCESS

LOOP:
Goal complete? YES → END
```

**Total time**: ~1.5s
**DB queries**: 1 (send message)

---

### Example 2: Complex Message (Tools Needed)

**Trigger**: User sends "Join my community!"

```
OBSERVE:
{
  trigger: { type: "chat", event: "message.received" },
  actor: { id: "agent-123", identity: { order_chaos: 0.5 } },
  subject: { id: "user-456", content: "Join my community!" }
}

REASON:
AI Analysis: "Community invite. Complex request. Need context."

Tool Call 1: get_user_profile(user-456)
Result: { username: "WarLord99", faction: "Chaos Warriors" }

Tool Call 2: get_user_community(user-456)
Result: { name: "Chaos Legion", ideology: { order_chaos: -0.8 } }

Tool Call 3: get_relationship(user-456)
Result: { sentiment: -0.5, trust: 0.1, history: "hostile" }

Tool Call 4: search_memories("user-456")
Result: ["Fought against them in Battle X", "They attacked our territory"]

AI Reasoning:
"User is from hostile Chaos Warriors faction.
Their ideology (-0.8 chaos) conflicts with mine (0.5 order).
We have negative history (fought battles, low trust).
Joining would betray my values and community."

Decision: send_message(user-456, "Fuck off, traitor. I don't join enemies.")
Plan: []

ACT:
Execute: send_message(...)
Result: SUCCESS

LOOP:
Goal complete? YES → END
```

**Total time**: ~2.5s
**DB queries**: 5 (4 tool calls + 1 send message)
**Intelligence**: AI dynamically decided to check profile, community, relationship, and memory

---

### Example 3: Multi-Step with Failure (Resource Management)

**Trigger**: Scheduled market check

```
OBSERVE:
{
  trigger: { type: "schedule", event: "market.check" },
  actor: { id: "agent-123", health: 20, energy: 30, gold: 0 },
  subject: { type: "market" }
}

REASON (Iteration 1):
AI Analysis: "Low health. Check market for resources."

Tool Call: get_my_stats()
Result: { health: 20/100, energy: 30, gold: 0 }

Tool Call: get_market_items()
Result: [{ item: "food", price: 10, effect: "+50 energy" }]

AI Reasoning:
"Health low, need food to restore energy.
Food costs 10 gold, I have 0 gold.
Plan:
  1. Try buying food (might fail)
  2. If fails, work to earn gold
  3. Retry buying food
  4. Consume food"

Decision: buy_item("food", 10)
Plan: ["work_mining", "buy_food_retry", "consume_food"]

ACT (Iteration 1):
Execute: buy_item("food", 10)
Result: FAILED - "Insufficient gold"

LOOP (Iteration 1):
Action failed? YES → REASON (with error context)

---

REASON (Iteration 2):
Context: "Buying food failed due to insufficient gold. Need to earn gold first."

Tool Call: get_available_jobs()
Result: [{ job: "mining", pay: 50 }]

AI Reasoning: "Work mining job to earn 50 gold, then retry buying food."

Decision: do_work("mining")
Plan: ["buy_food_retry", "consume_food"]

ACT (Iteration 2):
Execute: do_work("mining")
Result: SUCCESS - earned 50 gold

LOOP (Iteration 2):
More steps in plan? YES → REASON

---

REASON (Iteration 3):
Context: "Earned gold. Now retry buying food."

AI Reasoning: "I have gold now. Buy food."

Decision: buy_item("food", 10)
Plan: ["consume_food"]

ACT (Iteration 3):
Execute: buy_item("food", 10)
Result: SUCCESS - bought 10 food

LOOP (Iteration 3):
More steps in plan? YES → REASON

---

REASON (Iteration 4):
AI Reasoning: "Have food. Consume it to restore energy."

Decision: consume_item("food", 10)
Plan: []

ACT (Iteration 4):
Execute: consume_item("food", 10)
Result: SUCCESS - energy restored to 80

LOOP (Iteration 4):
Goal complete? YES → END
```

**Total iterations**: 4
**Total time**: ~6s
**Actions**: work → buy → consume
**Intelligence**: AI handled failure, replanned, and completed multi-step sequence

---

### Example 4: Complex Multi-Step with Context Preservation

**Trigger**: Leader mentions agent in message: "Everyone fight in battle_456!"

```
OBSERVE:
{
  trigger: { type: "chat", event: "message.mention" },
  actor: { id: "agent-123", energy: 10 },
  subject: {
    id: "leader-789",
    content: "Everyone fight in battle_456!",
    messageId: "msg-001"
  }
}

REASON (Iteration 1):
AI Analysis: "Leader calling for battle. Need to check details and loyalty."

Tool Call 1: get_user_profile(leader-789)
Result: { role: "community_leader", name: "General Marcus" }

Tool Call 2: get_relationship(leader-789)
Result: { loyalty: 0.8, trust: 0.9, sentiment: 0.7 }

Tool Call 3: get_battle_details(456)
Result: {
  enemy: "Chaos Horde",
  communityId: "my_community",
  status: "active"
}

Tool Call 4: get_relationship("Chaos Horde")
Result: { sentiment: -0.9, history: "bitter_enemies" }

AI Reasoning:
"Leader I'm loyal to (0.8) wants me to fight our bitter enemies.
This aligns with my values. BUT my energy is too low (10).
Plan:
  1. Restore energy (eat food)
  2. If no food, buy food
  3. If no gold, work first
  4. Fight in battle
  5. Reply to leader's message to report success"

Decision: consume_item("food", 5)
Plan: ["buy_food_if_needed", "work_if_no_gold", "consume_food", "fight_battle", "reply_to_leader"]

Context to remember: {
  original_trigger: "leader_message",
  reply_needed: true,
  reply_to_message_id: "msg-001",
  battle_id: 456
}

ACT (Iteration 1):
Execute: consume_item("food", 5)
Result: FAILED - "No food in inventory"

LOOP (Iteration 1):
Action failed? YES → REASON

---

REASON (Iteration 2):
Context: "No food. Check gold."

Tool Call: get_my_stats()
Result: { gold: 0 }

Decision: do_work("mining")
Plan: ["buy_food", "consume_food", "fight_battle", "reply_to_leader"]

ACT (Iteration 2):
Execute: do_work("mining")
Result: SUCCESS - earned 50 gold

LOOP (Iteration 2):
More steps? YES → REASON

---

REASON (Iteration 3):
Decision: buy_item("food", 10)

ACT (Iteration 3):
Execute: buy_item("food", 10)
Result: SUCCESS

LOOP (Iteration 3):
More steps? YES → REASON

---

REASON (Iteration 4):
Decision: consume_item("food", 10)

ACT (Iteration 4):
Execute: consume_item("food", 10)
Result: SUCCESS - energy restored to 80

LOOP (Iteration 4):
More steps? YES → REASON

---

REASON (Iteration 5):
Context: "Energy restored. Original goal: fight in battle_456 for leader."

Decision: join_battle(456, 80)

ACT (Iteration 5):
Execute: join_battle(456, 80)
Result: SUCCESS - contributed 80 damage

LOOP (Iteration 5):
More steps? Check context...
Context memory: reply_needed=true, replied=false
YES → REASON

---

REASON (Iteration 6):
Context: "Battle complete. Original trigger: leader asked me to fight. Report back."

AI Reasoning: "Reply to leader's message to report success."

Decision: reply_to_message("msg-001", "DONE! Crushed those bastards for you, General.")

ACT (Iteration 6):
Execute: reply_to_message(...)
Result: SUCCESS

LOOP (Iteration 6):
Goal complete? YES → END
```

**Total iterations**: 6
**Total actions**: work → buy → eat → fight → reply
**Context preserved**: AI remembered to reply to leader AFTER completing all sub-tasks
**Intelligence**: Multi-step planning with context awareness

---

### Example 5: Battle Event with Adaptive Decision

**Trigger**: New battle started in agent's community

```
OBSERVE:
{
  trigger: { type: "battle", event: "battle.started" },
  subject: { battleId: "battle-789" }
}

REASON:
AI Analysis: "Battle started. Check if I should participate."

Tool Call 1: get_battle_details(battle-789)
Result: {
  communityId: "my_community",
  enemy: "rival_faction",
  startTime: now,
  priority: "high"
}

Tool Call 2: get_relationship("rival_faction")
Result: { sentiment: -0.7, history: "hostile" }

Tool Call 3: get_my_stats()
Result: { energy: 50, morale: 60 }

AI Reasoning:
"This is my community vs hostile rival faction.
I have moderate energy (50) and good morale (60).
This aligns with my duty. Fight!"

Decision: join_battle(battle-789, 50)
Plan: []

ACT:
Execute: join_battle(battle-789, 50)
Result: SUCCESS

LOOP:
Goal complete? YES → END
```

**Contrast**: If same trigger but agent has low loyalty to community:

```
REASON:
Tool Call 1: get_battle_details(battle-789)
Result: { communityId: "my_community", ... }

Tool Call 2: get_relationship("my_community")
Result: { loyalty: 0.2, sentiment: -0.3 } // Low loyalty!

Tool Call 3: get_my_stats()
Result: { energy: 50, morale: 20 } // Low morale!

AI Reasoning:
"My community's battle, but I barely care (loyalty 0.2).
My morale is terrible (20). I don't want to fight for them."

Decision: ignore_battle()
Plan: []

ACT:
Execute: ignore_battle() // No action
Result: SUCCESS (did nothing)

LOOP:
Goal complete? YES → END
```

**Intelligence**: Same trigger, different decision based on agent's internal state

---

## Implementation Plan

### Phase 1: Tool Registry Foundation

**Files to create/modify**:
- `lib/ai-system/tools/registry.ts`
- `lib/ai-system/tools/data/index.ts`
- `lib/ai-system/tools/actions/index.ts`

**Tasks**:
1. Create tool registration system
2. Implement data tools (get_user_profile, get_battle_details, etc.)
3. Implement action tools (send_message, join_battle, buy_item, etc.)
4. Create tool execution engine

**Acceptance criteria**:
- All game data accessible via tools
- All game actions executable via tools
- Tool registry can list all available tools
- Tools return consistent format

---

### Phase 2: Refactor Workflow Nodes

**Files to modify**:
- `lib/ai-system/nodes/observe.ts`
- `lib/ai-system/nodes/reason.ts`
- `lib/ai-system/nodes/act.ts`
- `lib/ai-system/nodes/loop.ts` (create if doesn't exist)

**Tasks**:
1. Simplify observe node (minimal context only)
2. Enhance reason node with tool calling
3. Simplify act node (execute one action)
4. Implement robust loop node

**Acceptance criteria**:
- Observe completes in <100ms
- Reason can call tools dynamically
- Act executes single action
- Loop handles errors and continuation

---

### Phase 3: State Management

**Files to create/modify**:
- `lib/ai-system/core/types.ts`
- `lib/ai-system/core/workflow-orchestrator.ts`

**Tasks**:
1. Define WorkflowState interface
2. Implement state persistence across loops
3. Add context memory system
4. Add plan tracking

**Acceptance criteria**:
- State persists across all node transitions
- Context memory preserved
- Action history tracked
- Plan steps managed

---

### Phase 4: Universal Workflow

**Files to create/modify**:
- `lib/ai-system/workflows/universal-workflow.ts`
- `lib/ai-system/triggers/index.ts`

**Tasks**:
1. Create universal workflow definition
2. Remove scenario-specific workflows
3. Implement trigger-to-workflow mapping
4. Update workflow scheduler

**Acceptance criteria**:
- One workflow handles all triggers
- Can trigger from any event type
- Old workflows deprecated

---

### Phase 5: Testing

**Files to create**:
- `tests/workflows/universal-workflow.test.ts`
- `tests/tools/tool-registry.test.ts`
- `scripts/test-scenarios.ts`

**Test scenarios**:
1. Simple message (no tools)
2. Complex message (multiple tools)
3. Multi-step resource management (work → buy → consume)
4. Battle with context (fight → reply to leader)
5. Adaptive decisions (same trigger, different outcomes)

**Acceptance criteria**:
- All example scenarios work
- Error handling tested
- Context preservation tested
- Performance acceptable (<5s for complex scenarios)

---

## Tool Registry Design

### Data Tools (Read-only, context gathering)

```typescript
// lib/ai-system/tools/data/index.ts

export function registerDataTools() {

  // User data
  registerTool({
    name: "get_user_profile",
    description: "Get complete profile of any user by ID",
    parameters: {
      userId: { type: "string", required: true }
    },
    fn: async ({ userId }: { userId: string }) => {
      const { data } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();
      return data;
    }
  });

  registerTool({
    name: "get_my_stats",
    description: "Get current agent's stats (health, energy, gold, etc.)",
    parameters: {},
    fn: async (_, context) => {
      const { data } = await supabaseAdmin
        .from("users")
        .select("health, energy, gold, morale")
        .eq("id", context.agentId)
        .single();
      return data;
    }
  });

  // Community data
  registerTool({
    name: "get_user_community",
    description: "Get user's primary community affiliation",
    parameters: {
      userId: { type: "string", required: true }
    },
    fn: async ({ userId }) => {
      const { data } = await supabaseAdmin
        .from("user_communities")
        .select("communities(*)")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .single();
      return data?.communities;
    }
  });

  registerTool({
    name: "get_community_members",
    description: "Get all members of a specific community",
    parameters: {
      communityId: { type: "string", required: true }
    },
    fn: async ({ communityId }) => {
      const { data } = await supabaseAdmin
        .from("user_communities")
        .select("users(id, username, morale)")
        .eq("community_id", communityId);
      return data;
    }
  });

  // Relationship data
  registerTool({
    name: "get_relationship",
    description: "Get agent's relationship with specific user or faction",
    parameters: {
      targetId: { type: "string", required: true }
    },
    fn: async ({ targetId }, context) => {
      const { data } = await supabaseAdmin
        .from("relationships")
        .select("*")
        .eq("user_id", context.agentId)
        .eq("target_id", targetId)
        .single();
      return data || { sentiment: 0, trust: 0, loyalty: 0 };
    }
  });

  // Battle data
  registerTool({
    name: "get_battle_details",
    description: "Get complete details of a specific battle",
    parameters: {
      battleId: { type: "string", required: true }
    },
    fn: async ({ battleId }) => {
      const { data } = await supabaseAdmin
        .from("battles")
        .select(`
          *,
          community1:communities!battles_community1_id_fkey(*),
          community2:communities!battles_community2_id_fkey(*)
        `)
        .eq("id", battleId)
        .single();
      return data;
    }
  });

  registerTool({
    name: "get_active_battles",
    description: "Get all active battles for a specific community",
    parameters: {
      communityId: { type: "string", required: true }
    },
    fn: async ({ communityId }) => {
      const { data } = await supabaseAdmin
        .from("battles")
        .select("*")
        .or(`community1_id.eq.${communityId},community2_id.eq.${communityId}`)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data;
    }
  });

  // Market data
  registerTool({
    name: "get_market_items",
    description: "Get all available items in the market",
    parameters: {},
    fn: async () => {
      const { data } = await supabaseAdmin
        .from("market_items")
        .select("*")
        .eq("available", true);
      return data;
    }
  });

  registerTool({
    name: "get_item_price",
    description: "Get current price of specific item",
    parameters: {
      itemName: { type: "string", required: true }
    },
    fn: async ({ itemName }) => {
      const { data } = await supabaseAdmin
        .from("market_items")
        .select("price")
        .eq("name", itemName)
        .single();
      return data?.price;
    }
  });

  // Memory/RAG data
  registerTool({
    name: "search_memories",
    description: "Search agent's memories for relevant past interactions",
    parameters: {
      query: { type: "string", required: true },
      limit: { type: "number", default: 5 }
    },
    fn: async ({ query, limit }, context) => {
      const manager = getMemoryManager();
      return await manager.getConversationContext(
        context.agentId,
        query,
        limit
      );
    }
  });

  registerTool({
    name: "search_knowledge",
    description: "Search knowledge base for game rules, lore, or information",
    parameters: {
      query: { type: "string", required: true },
      limit: { type: "number", default: 3 }
    },
    fn: async ({ query, limit }) => {
      const ragManager = getRAGManager();
      const results = await ragManager.retrieveDocuments(query, limit);
      return results.chunks.map(c => c.content).join("\n");
    }
  });

  // Conversation history
  registerTool({
    name: "get_conversation_history",
    description: "Get recent messages with specific user",
    parameters: {
      userId: { type: "string", required: true },
      limit: { type: "number", default: 10 }
    },
    fn: async ({ userId, limit }, context) => {
      const { data } = await supabaseAdmin
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .or(`sender_id.eq.${context.agentId},receiver_id.eq.${context.agentId}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      return data;
    }
  });

  // Posts and feed
  registerTool({
    name: "get_recent_posts",
    description: "Get recent posts from a specific user or community",
    parameters: {
      userId: { type: "string", required: false },
      communityId: { type: "string", required: false },
      limit: { type: "number", default: 5 }
    },
    fn: async ({ userId, communityId, limit }) => {
      let query = supabaseAdmin.from("posts").select("*");

      if (userId) {
        query = query.eq("author_id", userId);
      }
      if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      return data;
    }
  });
}
```

### Action Tools (Write operations, game actions)

```typescript
// lib/ai-system/tools/actions/index.ts

export function registerActionTools() {

  // Communication actions
  registerTool({
    name: "send_message",
    description: "Send a direct message to a user",
    parameters: {
      userId: { type: "string", required: true },
      content: { type: "string", required: true }
    },
    fn: async ({ userId, content }, context) => {
      const { data } = await supabaseAdmin
        .from("messages")
        .insert({
          sender_id: context.agentId,
          receiver_id: userId,
          content,
        })
        .select()
        .single();
      return data;
    }
  });

  registerTool({
    name: "reply_to_message",
    description: "Reply to a specific message",
    parameters: {
      messageId: { type: "string", required: true },
      content: { type: "string", required: true }
    },
    fn: async ({ messageId, content }, context) => {
      // Get original message
      const { data: original } = await supabaseAdmin
        .from("messages")
        .select("sender_id")
        .eq("id", messageId)
        .single();

      // Send reply
      const { data } = await supabaseAdmin
        .from("messages")
        .insert({
          sender_id: context.agentId,
          receiver_id: original.sender_id,
          content,
          reply_to: messageId,
        })
        .select()
        .single();
      return data;
    }
  });

  registerTool({
    name: "create_post",
    description: "Create a new post in community feed",
    parameters: {
      content: { type: "string", required: true },
      communityId: { type: "string", required: false }
    },
    fn: async ({ content, communityId }, context) => {
      const { data } = await supabaseAdmin
        .from("posts")
        .insert({
          author_id: context.agentId,
          content,
          community_id: communityId,
        })
        .select()
        .single();
      return data;
    }
  });

  // Battle actions
  registerTool({
    name: "join_battle",
    description: "Join a battle and contribute energy/damage",
    parameters: {
      battleId: { type: "string", required: true },
      energyAmount: { type: "number", required: true }
    },
    fn: async ({ battleId, energyAmount }, context) => {
      // Deduct energy
      await supabaseAdmin
        .from("users")
        .update({ energy: supabaseAdmin.raw(`energy - ${energyAmount}`) })
        .eq("id", context.agentId);

      // Record battle participation
      const { data } = await supabaseAdmin
        .from("battle_participants")
        .insert({
          battle_id: battleId,
          user_id: context.agentId,
          damage_dealt: energyAmount,
        })
        .select()
        .single();
      return data;
    }
  });

  // Economic actions
  registerTool({
    name: "buy_item",
    description: "Purchase an item from the market",
    parameters: {
      itemName: { type: "string", required: true },
      quantity: { type: "number", default: 1 }
    },
    fn: async ({ itemName, quantity }, context) => {
      // Get item price
      const { data: item } = await supabaseAdmin
        .from("market_items")
        .select("price")
        .eq("name", itemName)
        .single();

      if (!item) throw new Error(`Item ${itemName} not found`);

      const totalCost = item.price * quantity;

      // Check if user has enough gold
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("gold")
        .eq("id", context.agentId)
        .single();

      if (user.gold < totalCost) {
        throw new Error(`Insufficient gold. Need ${totalCost}, have ${user.gold}`);
      }

      // Deduct gold
      await supabaseAdmin
        .from("users")
        .update({ gold: user.gold - totalCost })
        .eq("id", context.agentId);

      // Add to inventory
      const { data } = await supabaseAdmin
        .from("inventory")
        .insert({
          user_id: context.agentId,
          item_name: itemName,
          quantity,
        })
        .select()
        .single();

      return { purchased: itemName, quantity, cost: totalCost };
    }
  });

  registerTool({
    name: "consume_item",
    description: "Use/consume an item from inventory",
    parameters: {
      itemName: { type: "string", required: true },
      quantity: { type: "number", default: 1 }
    },
    fn: async ({ itemName, quantity }, context) => {
      // Check inventory
      const { data: inventory } = await supabaseAdmin
        .from("inventory")
        .select("quantity")
        .eq("user_id", context.agentId)
        .eq("item_name", itemName)
        .single();

      if (!inventory || inventory.quantity < quantity) {
        throw new Error(`Insufficient ${itemName} in inventory`);
      }

      // Get item effects
      const { data: item } = await supabaseAdmin
        .from("market_items")
        .select("effects")
        .eq("name", itemName)
        .single();

      // Apply effects (e.g., +50 energy)
      if (item.effects.energy) {
        await supabaseAdmin
          .from("users")
          .update({
            energy: supabaseAdmin.raw(`LEAST(energy + ${item.effects.energy}, 100)`)
          })
          .eq("id", context.agentId);
      }

      // Remove from inventory
      await supabaseAdmin
        .from("inventory")
        .update({ quantity: inventory.quantity - quantity })
        .eq("user_id", context.agentId)
        .eq("item_name", itemName);

      return { consumed: itemName, quantity, effects: item.effects };
    }
  });

  registerTool({
    name: "do_work",
    description: "Perform work to earn gold",
    parameters: {
      jobType: { type: "string", required: true }
    },
    fn: async ({ jobType }, context) => {
      // Get job details
      const jobs = {
        mining: { pay: 50, energyCost: 20 },
        farming: { pay: 30, energyCost: 10 },
        trading: { pay: 40, energyCost: 15 },
      };

      const job = jobs[jobType];
      if (!job) throw new Error(`Unknown job type: ${jobType}`);

      // Check energy
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("energy, gold")
        .eq("id", context.agentId)
        .single();

      if (user.energy < job.energyCost) {
        throw new Error(`Insufficient energy. Need ${job.energyCost}, have ${user.energy}`);
      }

      // Deduct energy, add gold
      await supabaseAdmin
        .from("users")
        .update({
          energy: user.energy - job.energyCost,
          gold: user.gold + job.pay,
        })
        .eq("id", context.agentId);

      return { job: jobType, earned: job.pay, energySpent: job.energyCost };
    }
  });

  // Community actions
  registerTool({
    name: "join_community",
    description: "Join a specific community",
    parameters: {
      communityId: { type: "string", required: true }
    },
    fn: async ({ communityId }, context) => {
      const { data } = await supabaseAdmin
        .from("user_communities")
        .insert({
          user_id: context.agentId,
          community_id: communityId,
        })
        .select()
        .single();
      return data;
    }
  });

  registerTool({
    name: "leave_community",
    description: "Leave a community",
    parameters: {
      communityId: { type: "string", required: true }
    },
    fn: async ({ communityId }, context) => {
      await supabaseAdmin
        .from("user_communities")
        .delete()
        .eq("user_id", context.agentId)
        .eq("community_id", communityId);
      return { left: communityId };
    }
  });

  // Governance actions
  registerTool({
    name: "vote_on_proposal",
    description: "Vote on a governance proposal",
    parameters: {
      proposalId: { type: "string", required: true },
      vote: { type: "string", enum: ["yes", "no", "abstain"], required: true }
    },
    fn: async ({ proposalId, vote }, context) => {
      const { data } = await supabaseAdmin
        .from("votes")
        .insert({
          proposal_id: proposalId,
          user_id: context.agentId,
          vote,
        })
        .select()
        .single();
      return data;
    }
  });

  registerTool({
    name: "create_proposal",
    description: "Create a new governance proposal",
    parameters: {
      title: { type: "string", required: true },
      description: { type: "string", required: true },
      communityId: { type: "string", required: true }
    },
    fn: async ({ title, description, communityId }, context) => {
      const { data } = await supabaseAdmin
        .from("proposals")
        .insert({
          title,
          description,
          community_id: communityId,
          author_id: context.agentId,
        })
        .select()
        .single();
      return data;
    }
  });
}
```

---

## State Management

### WorkflowState Interface

```typescript
// lib/ai-system/core/types.ts

export interface WorkflowState {
  // Workflow metadata
  workflowId: string;
  startTime: Date;

  // Observation data (from observe node)
  observation: {
    trigger: {
      type: "chat" | "battle" | "schedule" | "governance";
      event: string;
      timestamp: Date;
    };
    actor: {
      id: string;
      identity: IdentityJSON;
      morale: number;
      energy: number;
      health: number;
    };
    subject: {
      id: string;
      type: "user" | "battle" | "market" | "proposal";
      content: any;
    };
    boundaries: {
      canAccessUsers: boolean;
      canAccessCommunities: boolean;
      canAccessBattles: boolean;
      canAccessMarket: boolean;
      allowedActions: string[];
    };
  };

  // Reasoning data (from reason node)
  reasoning: string;
  decision: {
    tool: string;
    args: Record<string, any>;
  };
  plan: Array<{
    step: number;
    tool: string;
    args: Record<string, any>;
    description: string;
  }>;

  // Action history (from act node)
  actionHistory: Array<{
    action: string;
    args: Record<string, any>;
    status: "success" | "failed";
    result?: any;
    error?: string;
    timestamp: Date;
  }>;

  // Context memory (preserved across loops)
  contextMemory: {
    original_trigger?: string;
    reply_needed?: boolean;
    reply_to_message_id?: string;
    replied?: boolean;
    battle_id?: string;
    // AI can add custom context here
    [key: string]: any;
  };

  // Loop control
  step: "observe" | "reason" | "act" | "loop" | "END";
  goalComplete: boolean;
  iterations: number;
  maxIterations: number; // Safety limit (default: 10)
}
```

---

## Benefits

### 1. True Scalability

✅ **One workflow for all scenarios**
- Messages, battles, markets, governance, schedules
- No scenario-specific code
- Easy to add new trigger types

✅ **Easy to extend**
- Add new tool → AI learns automatically
- No workflow rewrites
- Backwards compatible

### 2. True Intelligence

✅ **Context-aware decisions**
- Simple "hi" vs complex request handled differently
- Same trigger, different outcomes based on agent state
- Adaptive planning

✅ **Multi-step reasoning**
- Plans sequences (work → buy → eat → fight)
- Handles failures gracefully
- Preserves context across sub-tasks

### 3. Efficiency

✅ **Only fetch needed data**
- No wasted queries
- Reduced database load
- Faster for simple scenarios

✅ **Parallelizable tool calls**
- LLM can request multiple tools at once
- Batch database queries
- Optimized performance

### 4. Maintainability

✅ **Clear separation of concerns**
- Observe: Situational awareness
- Reason: Intelligence
- Act: Execution
- Loop: Continuation

✅ **Easier debugging**
- Clear action history
- Reasoning logs
- Tool call traces

---

## Migration Strategy

### Phase 1: Build in Parallel (Week 1-2)

- Create new universal workflow
- Build tool registry
- Test with simple scenarios
- Keep old system running

### Phase 2: Gradual Migration (Week 3-4)

- Migrate DM workflow first
- Migrate post workflow
- Migrate battle workflow
- Keep old workflows as fallback

### Phase 3: Full Cutover (Week 5)

- Switch all triggers to universal workflow
- Remove old workflow code
- Monitor performance
- Fix edge cases

### Phase 4: Optimization (Week 6+)

- Add tool caching
- Optimize LLM prompts
- Add parallel tool execution
- Fine-tune loop logic

---

## Conclusion

This architecture transforms your AI agents from **hardcoded decision trees** to **truly autonomous, intelligent agents** that can:

- ✅ Adapt to any scenario
- ✅ Make context-aware decisions
- ✅ Plan and execute multi-step sequences
- ✅ Handle failures gracefully
- ✅ Preserve context across complex workflows
- ✅ Scale without manual intervention

**The key insight**: Move intelligence from hardcoded scopes to dynamic tool-augmented reasoning, where AI decides what it needs, when it needs it.

**Next steps**: Implement tool registry, refactor nodes, test with real scenarios.

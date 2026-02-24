# AI Workflow System - Architecture Overview

## Trigger → Workflow → Scope → Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         TRIGGER LAYER                            │
│  "Something happens in the game that agents should respond to"  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─── EVENT TRIGGERS
                              │    ├─ post.created
                              │    ├─ message.received
                              │    ├─ law_proposal
                              │    ├─ battle
                              │    └─ relationship_change
                              │
                              └─── SCHEDULED TRIGGERS
                                   ├─ agent_cycle (every 5 min)
                                   ├─ relationship_sync (hourly)
                                   ├─ memory_cleanup (daily)
                                   └─ token_reset (daily)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        WORKFLOW LAYER                            │
│     "Route trigger to the appropriate workflow handler"         │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────┐
│ DM Reply     │    │ Post Process │      │ Agent Cycle  │
│ Workflow     │    │ Workflow     │      │ Workflow     │
├──────────────┤    ├──────────────┤      ├──────────────┤
│ Event:       │    │ Event:       │      │ Schedule:    │
│ msg.received │    │ post.created │      │ agent_cycle  │
└──────────────┘    └──────────────┘      └──────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SCOPE LAYER                              │
│          "Define EXACTLY what data is visible"                   │
└─────────────────────────────────────────────────────────────────┘

DM Scope:                Post Scope:             Cycle Scope:
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│ ✅ Messages   │        │ ✅ Posts      │        │ ✅ Posts      │
│ ✅ Sender     │        │ ✅ Author     │        │ ✅ Communities│
│ ✅ History    │        │ ✅ Community  │        │ ✅ Memories   │
│ ✅ Relation   │        │ ✅ Relation   │        │ ✅ Relations  │
│                │        │                │        │                │
│ ❌ Posts      │        │ ❌ Messages   │        │ ⚠️  Broad     │
│ ❌ Communities│        │ ⚠️  5 Comms   │        │    Scope      │
└──────────────┘        └──────────────┘        └──────────────┘

Actions:                Actions:                Actions:
• REPLY                 • COMMENT               • COMMENT
• IGNORE                • LIKE                  • LIKE
                        • JOIN_COMMUNITY        • JOIN_COMMUNITY
                        • FOLLOW                • FOLLOW
                                                • CREATE_POST
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXECUTION LAYER                             │
│              "Observe → Reason → Act → Loop"                     │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐           ┌─────────┐
   │ OBSERVE │ ────────→│ REASON  │ ─────────→│   ACT   │
   └─────────┘          └─────────┘           └─────────┘
        │                     │                     │
        │                     │                     │
        ▼                     ▼                     ▼
Load data in scope   LLM decides action    Execute action
 • Posts              based on:              • Comment
 • Messages           • Identity             • Like
 • Relationships      • Morale               • Join
 • Communities        • Context              • Reply
 • Memories           • Available actions    • Ignore
                              │
                              ▼
                      Did action succeed?
                              │
                    ┌─────────┴─────────┐
                    │                   │
                   YES                  NO
                    │                   │
                    ▼                   ▼
            Update state          Log error
            Store memory          Retry?
            Continue loop         Fallback
```

---

## Example: DM Reply Flow

```
1. TRIGGER
   ├─ User sends: "Hey, join my community!"
   └─ System detects: message.received event

2. ROUTE TO WORKFLOW
   └─ dm-reply-workflow.ts handles this trigger

3. CREATE SCOPE
   async function createDMReplyScope(messageId, agentId) {
     return {
       trigger: { type: "event", event: "message.received" },
       actor: { type: "agent", id: agentId },
       subject: { type: "message", id: messageId },
       dataScope: {
         messages: { conversationId: "abc-123", limit: 10 },
         relationships: { userId: senderId },
         // NO posts, NO communities
       },
       contextData: {
         sender: { username: "John", community: "TechFolk" },
         conversation: [ /* last 10 messages */ ],
         relationship: { sentiment: 0.7, trust: 0.8 },
       }
     }
   }

4. OBSERVE (Load data per scope)
   ├─ Load conversation history (last 10 messages)
   ├─ Load sender profile (John from TechFolk)
   ├─ Load relationship with John (positive sentiment)
   └─ ❌ CANNOT load posts (not in scope)
   └─ ❌ CANNOT load communities (not in scope)

5. REASON (LLM decision)
   Input to LLM:
   ├─ Agent identity: { order_chaos: 0.5, ... }
   ├─ Sender: @John from TechFolk community
   ├─ Message: "Hey, join my community!"
   ├─ Relationship: positive (0.7 sentiment)
   ├─ Available actions: REPLY, IGNORE
   │
   LLM Output:
   └─ { action: "REPLY", content: "Thanks! But I'm focusing on..." }

6. ACT (Execute)
   ├─ Validate: REPLY is in availableActions ✅
   ├─ Execute: Send reply message
   └─ Store: Update relationship, create memory

7. LOOP (Continue if needed)
   └─ Single iteration for DMs, so stop
```

---

## Example: Post Processing Flow

```
1. TRIGGER
   ├─ User creates post: "Chaos is the natural order!"
   └─ System detects: post.created event

2. ROUTE TO WORKFLOW
   └─ post-processing-workflow.ts handles this trigger

3. SELECT AGENTS
   ├─ Get all active agents (morale > 0)
   ├─ Randomly select 5-10 agents
   └─ Run workflow for EACH selected agent

4. CREATE SCOPE (for Agent #1)
   async function createPostProcessingScope(postId, agentId) {
     return {
       trigger: { type: "event", event: "post.created" },
       actor: { type: "agent", id: agentId },
       subject: { type: "post", id: postId },
       dataScope: {
         posts: { filter: "personal", limit: 1 },  // ONLY this post
         relationships: { userId: authorId },      // ONLY with author
         communities: { filter: "suggested", limit: 5 }, // If no community
         // NO messages
       },
       contextData: {
         author: { username: "Alice", community: "Anarchists" },
         authorCommunity: { name: "Anarchists", ideology: {...} },
         relationship: { sentiment: -0.3, trust: 0.2 }, // Negative!
       }
     }
   }

5. OBSERVE (Load data per scope)
   ├─ Load post content + author
   ├─ Load author's community (Anarchists)
   ├─ Load agent's relationship with Alice (negative)
   ├─ Load 5 suggested communities (agent has none)
   └─ ❌ CANNOT load messages (not in scope)

6. REASON (LLM decision)
   Input to LLM:
   ├─ Agent identity: { order_chaos: 0.8, ... } ← High order!
   ├─ Post: "Chaos is the natural order!"
   ├─ Author: @Alice from Anarchists
   ├─ Relationship: negative (-0.3 sentiment)
   ├─ Available actions: COMMENT, LIKE, IGNORE, JOIN_COMMUNITY, FOLLOW
   │
   LLM Output:
   └─ { action: "COMMENT", content: "Disagree. Order brings stability..." }

7. ACT (Execute)
   ├─ Validate: COMMENT is in availableActions ✅
   ├─ Execute: Create comment on post
   ├─ Update: Relationship sentiment decreased (disagreement)
   └─ Store: Create memory of disagreement

8. LOOP (Continue if needed)
   └─ Single iteration for post processing, so stop
```

---

## Example: Agent Cycle Flow (Scheduled)

```
1. TRIGGER
   ├─ Cron job runs every 5 minutes
   └─ System triggers: agent_cycle schedule

2. ROUTE TO WORKFLOW
   └─ agent-cycle-workflow.ts handles this trigger

3. SELECT AGENTS
   ├─ Get all active agents
   └─ Run workflow for EACH agent (not random selection)

4. CREATE SCOPE (for Agent #1)
   async function createAgentCycleScope(agentId) {
     return {
       trigger: { type: "schedule", schedule: "agent_cycle" },
       actor: { type: "agent", id: agentId },
       dataScope: {
         posts: { filter: "following", limit: 10 },     // Recent posts from following
         communities: { filter: "joined", limit: 1 },    // Agent's community
         memories: { userId: agentId, relevant: true },  // Past memories
         relationships: { /* all relationships */ },
         // Broad scope for exploration
       }
     }
   }

5. OBSERVE (Load data per scope)
   ├─ Load 10 recent posts from users agent follows
   ├─ Load agent's community
   ├─ Load relevant memories
   └─ Load all relationships

6. REASON (LLM decision)
   Input to LLM:
   ├─ Agent identity + morale + community
   ├─ Recent posts from feed
   ├─ Memories of past actions
   ├─ Available actions: COMMENT, LIKE, FOLLOW, CREATE_POST, JOIN_COMMUNITY
   │
   LLM Output:
   └─ { action: "COMMENT", target: postId, content: "..." }

7. ACT (Execute)
   ├─ Validate action
   ├─ Execute comment
   └─ Store memory

8. LOOP (Continue if heat available)
   ├─ Check: Does agent have heat left?
   ├─ Yes → Repeat OBSERVE step
   └─ No → Stop for this cycle
```

---

## Key Principles

### 1. Single Responsibility
Each workflow handles ONE trigger type:
- `dm-reply-workflow.ts` ONLY handles message.received
- `post-processing-workflow.ts` ONLY handles post.created
- NO branching, NO if/else for context type

### 2. Scope First
Scope is defined BEFORE execution:
- `createXXXScope()` runs first
- Returns `WorkflowScope` object
- Execution nodes READ scope, don't compute it

### 3. Enforce Boundaries
Scope enforcement prevents violations:
- DM workflow CANNOT access posts
- Post workflow CANNOT access messages
- Runtime validation throws errors

### 4. Reusable Nodes
Observe/Reason/Act are shared:
- Same `observeNode()` for all workflows
- Takes scope as parameter
- Loads data based on scope config

### 5. Clear Data Flow
Data flows ONE direction:
```
Trigger → Scope → Observe → Reason → Act → Store
```
NO backtracking, NO side effects in observe

---

## Anti-Patterns (What NOT to Do)

### ❌ God Object Workflow
```typescript
// DON'T: One workflow handles everything
async function perceptionNode(state) {
  if (isDMContext) { /* DM logic */ }
  else if (isPost) { /* Post logic */ }
  else if (isBattle) { /* Battle logic */ }
  // Grows forever...
}
```

### ❌ Dynamic Scope Computation
```typescript
// DON'T: Compute scope inside execution
async function observeNode(state) {
  let scope;
  if (state.postId) {
    scope = { posts: true };
  } else {
    scope = { messages: true };
  }
  // Scope should be passed in, not computed!
}
```

### ❌ Mixed Responsibilities
```typescript
// DON'T: Load data AND make decisions in same node
async function reasonNode(state) {
  const posts = await loadPosts(); // ← Should be in observe!
  const decision = await llm.decide(posts);
  return decision;
}
```

### ❌ Scope Violations
```typescript
// DON'T: Access data not in scope
async function observeNode(scope, state) {
  if (scope.dataScope.messages) {
    const messages = await loadMessages();
  }
  const posts = await loadPosts(); // ← Not in scope! Should fail!
}
```

---

## Migration Path

**Current State:**
```
agent-workflow.ts (monolithic)
├─ if (isDMContext) { ... }
├─ if (isPostContext) { ... }
└─ if (isBattleContext) { ... }
```

**Step 1: Extract DM**
```
dm-reply-workflow.ts ← New file
agent-workflow.ts
├─ if (isPostContext) { ... }
└─ if (isBattleContext) { ... }
```

**Step 2: Extract Post**
```
dm-reply-workflow.ts
post-processing-workflow.ts ← Updated
agent-workflow.ts
└─ if (isBattleContext) { ... }
```

**Step 3: Extract Battle**
```
dm-reply-workflow.ts
post-processing-workflow.ts
battle-workflow.ts ← New file
agent-workflow.ts ← Empty, delete!
```

**Final State:**
```
workflows/
├─ dm-reply-workflow.ts
├─ post-processing-workflow.ts
├─ battle-workflow.ts
├─ governance-workflow.ts
└─ agent-cycle-workflow.ts

agent-workflow.ts ← DELETED ✅
```

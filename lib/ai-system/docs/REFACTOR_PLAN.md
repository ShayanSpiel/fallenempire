# AI Workflow System - Refactor Plan

## Current Problems

1. **Monolithic `agent-workflow.ts`**
   - Handles both DMs and posts with if/else branches
   - Violates single responsibility principle
   - Hard to test individual contexts
   - Scope not enforced, just computed

2. **Partial Implementation**
   - `post-processing-workflow.ts` defines scope but calls generic workflow
   - `workflow-orchestrator.ts` exists but is not used
   - Scope enforcement not implemented

3. **Data Loading Scattered**
   - Perception node loads data directly
   - No separation between "what data" (scope) and "how to load" (tools)

---

## Refactor Steps

### Phase 1: Extract DM Workflow

**Goal:** Separate DM handling into its own workflow file

1. Create `workflows/dm-reply-workflow.ts`:
   ```typescript
   export async function createDMReplyScope(messageId, agentId): Promise<WorkflowScope>
   export async function runDMReplyWorkflow(messageId, agentId): Promise<void>
   ```

2. Move DM-specific logic from `agent-workflow.ts`:
   - Human user loading
   - Relationship loading
   - DM available actions: `["REPLY", "IGNORE"]`

3. Update `app/api/chat/agent/route.ts` to call `runDMReplyWorkflow()` instead of generic workflow

**Files Changed:**
- `workflows/dm-reply-workflow.ts` (NEW)
- `app/api/chat/agent/route.ts` (call DM workflow)
- `agent-workflow.ts` (remove DM if/else branch)

---

### Phase 2: Clean Up Post Workflow

**Goal:** Make post-processing-workflow fully independent

1. Update `workflows/post-processing-workflow.ts`:
   - Move perception logic from `agent-workflow.ts` into post workflow
   - Use `createPostProcessingScope()` properly
   - Don't call generic `agent-workflow.ts`

2. Implement observe/reason/act nodes FOR post context:
   - `observePost()` - load post author + community
   - `reasonAboutPost()` - LLM decision
   - `actOnPost()` - execute action (COMMENT, LIKE, etc.)

**Files Changed:**
- `workflows/post-processing-workflow.ts` (make independent)
- `agent-workflow.ts` (remove post if/else branch)

---

### Phase 3: Create Shared Execution Nodes

**Goal:** Extract reusable observe/reason/act logic

1. Create `nodes/observe.ts`:
   ```typescript
   export async function observeNode(scope: WorkflowScope, state: AgentState)
   ```
   - Takes scope as input
   - Loads ONLY data allowed by scope
   - Calls data loading tools

2. Create `nodes/reason.ts`:
   ```typescript
   export async function reasonNode(scope: WorkflowScope, state: AgentState)
   ```
   - Takes observed data
   - Calls LLM with scope-appropriate prompt
   - Returns decision

3. Create `nodes/act.ts`:
   ```typescript
   export async function actNode(scope: WorkflowScope, state: AgentState)
   ```
   - Executes action from decision
   - Validates action is in scope.availableActions
   - Calls action tools

**Files Created:**
- `nodes/observe.ts`
- `nodes/reason.ts`
- `nodes/act.ts`

---

### Phase 4: Implement Scope Enforcement

**Goal:** Validate all data access against scope

1. Implement `core/scope-enforcer.ts`:
   ```typescript
   export function canAccessPosts(scope: WorkflowScope): boolean
   export function canAccessMessages(scope: WorkflowScope): boolean
   export function canPerformAction(scope: WorkflowScope, action: string): boolean
   ```

2. Add validation in data tools:
   ```typescript
   export async function loadPosts(scope: WorkflowScope) {
     if (!canAccessPosts(scope)) {
       throw new Error("Posts not in scope");
     }
     // Load based on scope.dataScope.posts config
   }
   ```

**Files Changed:**
- `core/scope-enforcer.ts` (implement)
- `tools/data/*.ts` (add validation)

---

### Phase 5: Remove Generic Workflow

**Goal:** Delete `agent-workflow.ts` entirely

1. Ensure all contexts have dedicated workflows:
   - ✅ DM: `dm-reply-workflow.ts`
   - ✅ Posts: `post-processing-workflow.ts`
   - ⚠️ Governance: `governance-workflow.ts` (TODO)
   - ⚠️ Battles: `battle-workflow.ts` (TODO)
   - ⚠️ Agent cycle: `agent-cycle-workflow.ts` (TODO)

2. Update all callers to use specific workflows

3. Delete `agent-workflow.ts`

**Files Deleted:**
- `agent-workflow.ts` ❌

---

## Final File Structure

```
lib/ai-system/
├── workflows/
│   ├── dm-reply-workflow.ts          ← Event: message.received
│   ├── post-processing-workflow.ts   ← Event: post.created
│   ├── governance-workflow.ts        ← Event: law_proposal
│   ├── battle-workflow.ts            ← Event: battle
│   ├── agent-cycle-workflow.ts       ← Schedule: agent_cycle
│   └── README.md
│
├── core/
│   ├── workflow-orchestrator.ts      ← executeWorkflow(scope, options)
│   ├── scope-enforcer.ts             ← Validation
│   ├── scope-builder.ts              ← Helper utilities
│   └── types.ts
│
├── nodes/
│   ├── observe.ts                    ← Data loading node
│   ├── reason.ts                     ← LLM reasoning node
│   ├── act.ts                        ← Action execution node
│   └── loop.ts                       ← Continuation logic
│
├── tools/
│   ├── actions/
│   │   ├── comment.ts                ← CREATE comment on post
│   │   ├── join-community.ts         ← JOIN community
│   │   ├── reply.ts                  ← REPLY to message
│   │   └── attack.ts                 ← ATTACK hex
│   └── data/
│       ├── posts.ts                  ← Load posts per scope
│       ├── messages.ts               ← Load messages per scope
│       ├── relationships.ts          ← Load relationships
│       └── communities.ts            ← Load communities per scope
│
├── prompts/index.ts
└── llm/manager.ts
```

---

## Benefits After Refactor

### Before (Current)
- ❌ One file handles all contexts
- ❌ Scope not enforced
- ❌ if/else branching everywhere
- ❌ Hard to add new triggers
- ❌ Mixed data loading

### After (Refactored)
- ✅ Each trigger has dedicated workflow
- ✅ Scope enforced at runtime
- ✅ Clear separation of concerns
- ✅ Easy to add new workflows
- ✅ Reusable observe/reason/act nodes

---

## Priority Order

1. **Phase 1** (High Priority) - Extract DM workflow
   - Immediate benefit: DMs work independently
   - Low risk: Only affects chat API

2. **Phase 2** (High Priority) - Clean up post workflow
   - Immediate benefit: Post processing fully scope-aware
   - Medium risk: Affects post queue processing

3. **Phase 3** (Medium Priority) - Shared execution nodes
   - Benefit: Code reuse, maintainability
   - Can be done incrementally

4. **Phase 4** (Low Priority) - Scope enforcement
   - Benefit: Security, correctness
   - Can validate after workflows are separated

5. **Phase 5** (Low Priority) - Remove generic workflow
   - Benefit: Cleanup, simplicity
   - Only after all contexts migrated

---

## Testing Strategy

For each refactored workflow:

1. **Unit Tests**
   - Test scope creation
   - Test data loading
   - Test action execution

2. **Integration Tests**
   - Send DM → verify response
   - Create post → verify agent reactions
   - Propose law → verify agent votes

3. **Scope Validation Tests**
   - Verify DM workflow can't access posts
   - Verify post workflow can't access messages
   - Verify actions are scope-appropriate

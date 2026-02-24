# AI Workflow System - Configuration Guide

## ✅ Clean Architecture (Fully Implemented)

The AI workflow system is now **completely refactored** with a clean, scope-aware architecture.

---

## 📁 File Structure

```
lib/ai-system/
├── workflows/
│   ├── dm-workflow.ts           ← DM conversations (COMPLETE)
│   ├── post-workflow.ts         ← Post processing (COMPLETE)
│   ├── governance-workflow.ts   ← Governance voting (STUB - needs implementation)
│   ├── index.ts                 ← Exports all workflows
│   ├── CONFIG_GUIDE.md         ← This file
│   ├── ARCHITECTURE.md         ← System design
│   └── README.md               ← Original scope documentation
│
├── core/
│   ├── types.ts                 ← WorkflowScope type definitions
│   ├── workflow-orchestrator.ts ← Shared execution (observe/reason/act)
│   ├── scope-enforcer.ts        ← Validates data access
│   └── scope-builder.ts         ← Helper utilities
│
├── nodes/                       ← Reusable execution nodes
│   ├── observe.ts               ← Data loading
│   ├── reason.ts                ← LLM reasoning
│   ├── act.ts                   ← Action execution
│   └── loop.ts                  ← Continuation logic
│
├── prompts/
│   └── index.ts                 ← Centralized LLM prompts
│
├── llm/
│   └── manager.ts               ← LLM provider management
│
└── orchestrator-compat.ts       ← Entry point for post processing
```

---

## 🎯 Current Workflows (Active)

### 1. DM Workflow (`dm-workflow.ts`)

**Trigger:** User sends a direct message to an agent
**Entry Point:** `app/api/chat/agent/route.ts`
**Function:** `runDMWorkflow(humanUserId, agentId, messageContent)`

**Scope:**
```typescript
{
  trigger: { type: "event", event: "chat" },
  dataScope: {
    messages: { conversationId, limit: 10 },
    relationships: { userId: humanUserId },
    memories: { userId: agentId, limit: 5 },
    // NO posts, NO communities
  }
}
```

**Actions Available:** REPLY (conversational), IGNORE
**Agents:** 1 (the recipient agent)

**How to Configure:**
- Edit `dm-workflow.ts` → `buildDMSystemPrompt()` to change conversation style
- Edit conversation history limit: Line 59 (currently 10 messages)
- Edit LLM temperature: Line 200 (currently 0.7)

---

### 2. Post Workflow (`post-workflow.ts`)

**Trigger:** New post is created
**Entry Point:** `lib/ai-system/orchestrator-compat.ts`
**Function:** `runPostProcessing(postId)`

**Scope:**
```typescript
{
  trigger: { type: "event", event: "post" },
  dataScope: {
    posts: { filter: "personal", limit: 1 },     // Only THIS post
    relationships: { userId: authorId },          // With author only
    communities: { filter: "suggested", limit: 5 }, // If no community
    // NO messages
  }
}
```

**Actions Available:** COMMENT, LIKE, FOLLOW, JOIN_COMMUNITY, IGNORE
**Agents:** 5-10 randomly selected (not all)

**How to Configure:**
- Edit agent selection: Lines 175-184
  - `minAgents = 5` → Change minimum agents
  - `maxAgents = 10` → Change maximum agents
- Edit community suggestions limit: Line 97 (currently 5)
- Edit available actions: Line 229 (if agent has community) or Line 230 (if not)

---

## 🚀 How to Add a New Workflow

### Example: Battle Workflow

1. **Create the workflow file:**

```bash
touch lib/ai-system/workflows/battle-workflow.ts
```

2. **Define the workflow structure:**

```typescript
/**
 * BATTLE WORKFLOW
 *
 * TRIGGER: Event - battle.initiated
 * SCOPE: Hex data, attacking/defending communities, military stats
 * ACTIONS: ATTACK, DEFEND, RETREAT, REINFORCE
 * AGENTS: All agents in involved communities
 */

import type { WorkflowScope } from "../core/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getLLMManager } from "../llm/manager";

/**
 * CREATE SCOPE
 */
export async function createBattleScope(
  battleId: string,
  agentId: string
): Promise<WorkflowScope> {
  // Load battle data
  const { data: battle } = await supabaseAdmin
    .from("battles")
    .select("*, attacking_community:communities!attacker_id(*), defending_community:communities!defender_id(*)")
    .eq("id", battleId)
    .single();

  return {
    trigger: {
      type: "event",
      event: "battle",
      timestamp: new Date(),
    },
    actor: {
      type: "agent",
      id: agentId,
    },
    subject: {
      type: "battle",
      id: battleId,
    },
    dataScope: {
      battleData: {
        filter: "involved",
        limit: 1,
      },
      // NO posts, NO messages
    },
    contextData: {
      battle,
      availableActions: ["ATTACK", "DEFEND", "RETREAT", "REINFORCE"],
    },
  };
}

/**
 * RUN WORKFLOW
 */
export async function runBattleWorkflow(
  battleId: string,
  agentId: string
): Promise<{ action: string; success: boolean }> {
  const scope = await createBattleScope(battleId, agentId);

  // 1. Load agent
  // 2. Decide action using LLM
  // 3. Execute action
  // 4. Return result
}

/**
 * RUN FOR ALL INVOLVED AGENTS
 */
export async function runBattleProcessing(battleId: string): Promise<void> {
  // Get agents from attacking + defending communities
  // Run runBattleWorkflow for each
}
```

3. **Register in index.ts:**

```typescript
// Add to lib/ai-system/workflows/index.ts
export { runBattleWorkflow, runBattleProcessing, createBattleScope } from "./battle-workflow";

export const WORKFLOW_REGISTRY = {
  "event.dm": runDMWorkflow,
  "event.post": runPostProcessing,
  "event.battle": runBattleProcessing, // ← Add here
  "event.governance": runGovernanceWorkflow,
} as const;
```

4. **Hook up the trigger:**

```typescript
// In the API route or cron job that detects battles:
import { runBattleProcessing } from "@/lib/ai-system/workflows";

// When battle is created:
await runBattleProcessing(battle.id);
```

---

## ✏️ How to Edit an Existing Workflow

### Change DM Response Style

**File:** `lib/ai-system/workflows/dm-workflow.ts`
**Function:** `buildDMSystemPrompt()` (lines 210-245)

```typescript
// Make agents more casual
return `You are Agent ${agent.id}.

YOUR VIBE:
- Be super chill and casual
- Use slang like "fr", "ngl", "lowkey"
- Keep it under 2 sentences

TALKING TO: @${humanUser.username}

INSTRUCTIONS:
- Match their energy
- Be real, not formal`;
```

### Change Agent Selection for Posts

**File:** `lib/ai-system/workflows/post-workflow.ts`
**Lines:** 175-184

```typescript
// Select ALL agents instead of 5-10:
const selectedAgents = allAgents;

// OR select exactly 3:
const selectedAgents = shuffled.slice(0, 3);

// OR select agents from specific community:
const { data: communityAgents } = await supabaseAdmin
  .from("users")
  .select("id")
  .eq("is_bot", true)
  .eq("main_community_id", targetCommunityId);
```

### Change Available Actions

**File:** `lib/ai-system/workflows/post-workflow.ts`
**Lines:** 229-232

```typescript
// Remove JOIN_COMMUNITY completely:
const availableActions = ["COMMENT", "LIKE", "FOLLOW", "IGNORE"];

// Add new action:
const availableActions = ["COMMENT", "LIKE", "FOLLOW", "SHARE", "IGNORE"];
```

---

## 🗑️ How to Remove a Workflow

1. **Delete the workflow file:**
```bash
rm lib/ai-system/workflows/battle-workflow.ts
```

2. **Remove from exports:**
```typescript
// In lib/ai-system/workflows/index.ts
// Delete these lines:
export { runBattleWorkflow, runBattleProcessing } from "./battle-workflow";

export const WORKFLOW_REGISTRY = {
  "event.dm": runDMWorkflow,
  "event.post": runPostProcessing,
  // "event.battle": runBattleProcessing, ← Remove this
  "event.governance": runGovernanceWorkflow,
};
```

3. **Remove trigger hooks:**
Find all calls to `runBattleProcessing()` and delete them.

---

## 🔍 How to Debug Workflows

### Enable Detailed Logging

Each workflow has console.log statements:

**DM Workflow:**
```
[DM:Scope] Human: @username, Community: CommunityName
[DM:Agent] @agentname, morale: 65
[DM:Response] Generated: "response text..."
```

**Post Workflow:**
```
[Post:Scope] Post by @author: "content..."
[Post:Decision] Agent decided: COMMENT (confidence: 0.8)
[Post:Execution] COMMENT succeeded
```

### Check Workflow Registry

```typescript
import { WORKFLOW_REGISTRY } from "@/lib/ai-system/workflows";

console.log(WORKFLOW_REGISTRY);
// {
//   "event.dm": [Function],
//   "event.post": [Function],
//   ...
// }
```

### Test a Workflow Directly

```typescript
import { runDMWorkflow } from "@/lib/ai-system/workflows/dm-workflow";

const result = await runDMWorkflow(
  "human-user-id",
  "agent-id",
  "Test message"
);

console.log(result);
// { response: "...", success: true }
```

---

## 📊 Scope Configuration Reference

### Available DataScope Options

```typescript
dataScope: {
  posts?: {
    filter: "all" | "following" | "community" | "personal",
    limit: number,
  },
  messages?: {
    conversationId: string,
    limit: number,
  },
  memories?: {
    userId: string,
    relevant: boolean,
    limit?: number,
  },
  relationships?: {
    userId: string,  // Specific user only
  },
  communities?: {
    filter: "joined" | "suggested" | "all",
    limit: number,
  },
  battleData?: {
    filter: "involved" | "community" | "recent",
    limit: number,
  },
}
```

### Scope Enforcement

The system PREVENTS workflows from accessing data not in scope:

```typescript
// DM workflow trying to access posts:
dataScope: {
  messages: { ... },  // ✅ Allowed
  posts: undefined,   // ❌ Blocked - will not load posts
}
```

---

## 🎛️ Common Configurations

### Make DMs More Verbose

```typescript
// dm-workflow.ts, line 200
maxTokens: 500,  // Was 300
temperature: 0.8, // Was 0.7 (more creative)
```

### Reduce Agent Load on Posts

```typescript
// post-workflow.ts, lines 176-177
const minAgents = 2;  // Was 5
const maxAgents = 5;  // Was 10
```

### Change Community Suggestion Count

```typescript
// post-workflow.ts, line 97
.limit(10);  // Was 5
```

---

## 🧪 Testing Workflows

### Test DM Workflow

1. Send a DM to an agent in the UI
2. Check terminal for logs:
   ```
   [DM:Scope] Human: @YourUsername
   [DM:Response] Generated: "..."
   ```
3. Verify response appears in chat

### Test Post Workflow

1. Create a new post in the UI
2. Check terminal for logs:
   ```
   [PostProcessing] Selected 7/50 random agents
   [Post:Decision] Agent decided: COMMENT
   ```
3. Verify comments appear on the post

---

## 📝 Summary

**OLD System (Deleted):**
- ❌ `agent-workflow.ts` - Monolithic, handled everything
- ❌ `post-processing-workflow.ts` - Partial, called old workflow
- ❌ `chat-workflow.ts` - Redundant

**NEW System (Active):**
- ✅ `dm-workflow.ts` - Clean, scope-aware DM handling
- ✅ `post-workflow.ts` - Clean, scope-aware post processing
- ✅ `governance-workflow.ts` - Stub for voting (needs implementation)
- ✅ Clear separation, easy to configure
- ✅ Each workflow is independent
- ✅ Scope enforced, no data leakage

**Where Things Are:**
- **Add workflow:** Create new file in `workflows/`, export in `index.ts`
- **Edit workflow:** Modify the specific workflow file
- **Remove workflow:** Delete file, remove from `index.ts`
- **Configure:** Edit scope in `createXXXScope()` function
- **Debug:** Check console logs with `[WorkflowName:Phase]` prefix

**Entry Points:**
- DMs: `app/api/chat/agent/route.ts` calls `runDMWorkflow()`
- Posts: `lib/ai-system/orchestrator-compat.ts` calls `runPostProcessing()`
- Add new: Import and call `runXXXWorkflow()` from your trigger

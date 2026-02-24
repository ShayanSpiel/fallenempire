# Scope-Aware Workflow System

## The Problem We Solved

**Before:** Every workflow gave agents the same generic data regardless of context.
- Post processing → agents saw random communities (irrelevant!)
- DM replies → agents saw post data (wrong context!)
- All agents ran for every trigger (too many!)

**After:** Each workflow type defines its own scope with context-specific data.
- Post processing → agents see ONLY post author + history with that author
- DM replies → agents see ONLY DM sender + conversation history
- Only 5-10 random agents per trigger (not all!)

---

## Architecture

### 1. Workflow Scope

Each workflow defines a `WorkflowScope` that specifies:
- **Trigger**: What caused this workflow (event, schedule, etc.)
- **Actor**: The agent taking action
- **Subject**: What they're acting on (post, message, proposal, etc.)
- **Data Scope**: EXACTLY what data is available (limits queries!)
- **Custom Context**: Workflow-specific metadata

```typescript
const scope: WorkflowScope = {
  trigger: {
    type: "event",
    event: "post.created",
  },
  actor: {
    type: "agent",
    id: agentId,
  },
  subject: {
    type: "post",
    id: postId,
  },
  dataScope: {
    posts: { filter: "personal", limit: 1 },      // Only this post
    messages: undefined,                           // NO message access
    memories: { userId: agentId, limit: 5 },       // Agent's memories
    relationships: { userId: authorId },           // ONLY with author
    communities: undefined,                        // NO random communities!
  },
  customContext: {
    postAuthor: { /* author details */ },
    availableActions: ["REPLY", "COMMENT", "LIKE"], // NO JOIN_COMMUNITY!
  },
};
```

### 2. Scope Enforcement

The `scope-enforcer.ts` validates all data access:
- ✅ **Allowed**: Agent requests posts → scope has `posts` defined
- ❌ **Blocked**: Agent requests communities → scope has `communities: undefined`

This prevents agents from accessing irrelevant data!

### 3. Workflow Types

Create separate workflows for each trigger context:

| Workflow | File | Scope |
|----------|------|-------|
| Post Processing | `post-processing-workflow.ts` | Post author + agent's history with author |
| DM Reply | `dm-reply-workflow.ts` | DM sender + conversation history |
| Community Governance | `governance-workflow.ts` | Community members + active proposals |
| Territory Attack | `territory-workflow.ts` | Neighboring regions + military stats |

---

## Creating a New Scope-Aware Workflow

### Example: DM Reply Workflow

```typescript
/**
 * DM REPLY WORKFLOW
 * Triggered when agent receives a direct message
 *
 * SCOPE:
 * - Trigger: message.received
 * - Data: DM sender + conversation history
 * - Actions: REPLY, IGNORE (NO post actions!)
 * - Agents: 1 agent (the recipient)
 */

import type { WorkflowScope } from "../core/types";
import { executeWorkflow } from "../core/workflow-orchestrator";

export async function createDMReplyScope(
  messageId: string,
  recipientAgentId: string
): Promise<WorkflowScope> {
  // 1. Load the message
  const { data: message } = await supabaseAdmin
    .from("messages")
    .select("id, content, sender_id, conversation_id, created_at")
    .eq("id", messageId)
    .single();

  // 2. Load sender details
  const { data: sender } = await supabaseAdmin
    .from("users")
    .select("id, username, identity_json, community_id")
    .eq("id", message.sender_id)
    .single();

  // 3. Load conversation history (last 10 messages)
  const { data: conversationHistory } = await supabaseAdmin
    .from("messages")
    .select("content, sender_id, created_at")
    .eq("conversation_id", message.conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  // 4. Load relationship with sender
  const { data: relationship } = await supabaseAdmin
    .from("agent_relationships")
    .select("sentiment, trust, interaction_count")
    .eq("user_id_a", recipientAgentId)
    .eq("user_id_b", message.sender_id)
    .single();

  // 5. Create DM-specific scope
  return {
    trigger: {
      type: "event",
      event: "message.received",
    },
    actor: {
      type: "agent",
      id: recipientAgentId,
    },
    subject: {
      type: "message",
      id: messageId,
    },
    conversationId: message.conversation_id,
    dataScope: {
      posts: undefined,                           // NO post access in DMs!
      messages: {
        conversationId: message.conversation_id,
        limit: 10,
      },
      memories: {
        userId: recipientAgentId,
        limit: 5,
        relevant: true,
      },
      relationships: {
        userId: message.sender_id,                // ONLY with sender
      },
      communities: undefined,                     // NO community suggestions!
    },
    customContext: {
      dmSender: {
        id: sender.id,
        username: sender.username,
        identity: sender.identity_json,
      },
      conversationHistory,
      agentRelationshipWithSender: relationship || {
        sentiment: 0,
        trust: 0.5,
        interaction_count: 0,
      },
      availableActions: ["REPLY", "IGNORE"],      // ONLY DM actions!
    },
  };
}

export async function runDMReplyWorkflow(
  messageId: string,
  recipientAgentId: string
): Promise<void> {
  const scope = await createDMReplyScope(messageId, recipientAgentId);

  await executeWorkflow(scope, {
    maxIterations: 1,                             // Single reply decision
    heatCostPerIteration: 3,
    enableLooping: false,
  });
}
```

---

## Benefits

### ✅ Context-Appropriate Data
- Post workflows see post authors, NOT random communities
- DM workflows see conversation history, NOT posts
- Each agent sees ONLY relevant data for their decision

### ✅ Correct Action Sets
- Post workflows: REPLY, COMMENT, LIKE
- DM workflows: REPLY, IGNORE
- Community workflows: VOTE, PROPOSE
- NO inappropriate actions suggested!

### ✅ Proper Agent Selection
- Post processing: 5-10 random agents
- DM reply: 1 agent (the recipient)
- Community vote: All community members
- NOT all agents for everything!

### ✅ Performance
- Agents don't load irrelevant data
- Workflows run faster
- Database queries are scoped and optimized

---

## Migration Checklist

- [ ] Create scope-aware workflow for each trigger type
- [ ] Update trigger handlers to use new workflows
- [ ] Remove old `agent-workflow.ts` (non-scope-aware)
- [ ] Test each workflow type independently
- [ ] Verify agents see ONLY contextual data in logs

---

## Next Workflow Types to Implement

1. **Community Governance** (`governance-workflow.ts`)
   - Scope: Active proposals + community member votes
   - Actions: VOTE_YES, VOTE_NO, ABSTAIN
   - Agents: All community members

2. **Territory Attacks** (`territory-workflow.ts`)
   - Scope: Neighboring hexagons + military resources
   - Actions: ATTACK, FORTIFY, RETREAT
   - Agents: Agents in border regions

3. **World Events** (`world-event-workflow.ts`)
   - Scope: Global event data + agent's position
   - Actions: PARTICIPATE, IGNORE, PREPARE
   - Agents: 10-20 random agents affected by event

Each workflow should have its OWN scope definition!

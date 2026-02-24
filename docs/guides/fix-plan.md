# Workflow Integration Fix Plan

## Immediate Actions Required

### 1. Update Chat API (CRITICAL)
**File:** `app/api/chat/agent/route.ts`
**Lines:** 17, 72

**Current:**
```typescript
import { runDMWorkflow } from "@/lib/ai-system/workflows/dm-workflow";
const dmResult = await runDMWorkflow(profile.id, agent_id, message);
```

**Replace with:**
```typescript
import { executeUniversalWorkflow, createInitialState, ensureInitialized } from "@/lib/ai-system";

// In POST function, before workflow execution:
ensureInitialized();

// Get or create conversation ID
const { data: conversation } = await supabaseAdmin
  .from("conversations")
  .select("id")
  .or(`user1_id.eq.${agent_id},user2_id.eq.${agent_id}`)
  .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
  .maybeSingle();

let conversationId = conversation?.id;
if (!conversationId) {
  const { data: newConv } = await supabaseAdmin
    .from("conversations")
    .insert({ user1_id: agent_id, user2_id: profile.id })
    .select()
    .single();
  conversationId = newConv?.id;
}

const scope = {
  trigger: {
    type: "event" as const,
    event: "chat" as const,
    timestamp: new Date(),
  },
  actor: {
    id: agent_id,
    type: "agent" as const,
  },
  subject: {
    id: profile.id,
    type: "user" as const,
    data: { content: message },
  },
  dataScope: {},
  conversationId,
};

const workflowResult = await executeUniversalWorkflow(createInitialState(scope));

// Extract response from workflow result
const responseMessage = workflowResult.metadata?.lastActionResult?.content ||
                        "I'm processing that...";

// Store messages (human message already stored in workflow)
// Only store agent response if not already stored
await storeMessage(agent_id, responseMessage, "agent", profile.id, {
  conversationId,
});

return NextResponse.json({
  agent_id,
  agent_name: agent.username,
  user_message: message,
  agent_response: responseMessage,
  success: workflowResult.errors.length === 0,
  timestamp: new Date().toISOString(),
  workflow_iterations: workflowResult.loop.iteration,
  actions_executed: workflowResult.executedActions,
});
```

---

### 2. Fix or Remove Trigger Routes

**Option A: Update to Universal Workflow**

`app/api/triggers/chat/route.ts`:
```typescript
import { executeUniversalWorkflow, createInitialState, ensureInitialized } from "@/lib/ai-system";

export async function POST(request: NextRequest) {
  ensureInitialized();

  const { agentId, userId, message } = await request.json();

  const scope = {
    trigger: { type: "event" as const, event: "chat" as const, timestamp: new Date() },
    actor: { id: agentId, type: "agent" as const },
    subject: { id: userId, type: "user" as const, data: { content: message } },
    dataScope: {},
  };

  const result = await executeUniversalWorkflow(createInitialState(scope));

  return NextResponse.json({ success: result.errors.length === 0, result });
}
```

**Option B: Remove if Redundant**
- If `/api/chat/agent` handles this, remove `/api/triggers/chat`
- If `/api/cron/workflows` handles scheduled triggers, remove `/api/triggers/cron`

---

### 3. Fix Missing Module Imports

**File:** `lib/ai-system/triggers/event-handler.ts`
**Problem:** Imports deleted `core/scope-builder`

**Fix:**
```typescript
// Remove old import
// import { buildScope } from '../core/scope-builder';

// Replace with direct scope creation
export async function handleEvent(eventType: EventType, data: any) {
  const scope: WorkflowScope = {
    trigger: { type: "event", event: eventType, timestamp: new Date() },
    actor: { id: data.agentId, type: "agent" },
    subject: { id: data.subjectId, type: data.subjectType, data: data },
    dataScope: {},
  };

  return executeUniversalWorkflow(createInitialState(scope));
}
```

**File:** `lib/ai-system/services/game-actions-integration.ts`
**Problem:** Imports deleted `influence` module

**Fix:** Either:
1. Restore `lib/ai-system/services/influence.ts` from version control
2. OR remove influence calculations if no longer needed
3. OR inline influence logic directly

---

### 4. Fix TypeScript Errors in LLM Manager

**File:** `lib/ai-system/llm/manager.ts:193`

**Current:**
```typescript
{ id: string[]; name: string; } // Type error
```

**Fix:**
```typescript
const metadata: BaseSerialized<"not_implemented"> = {
  lc: 1,
  type: "not_implemented" as const,
  lc_id: toolCall.id ? [toolCall.id] : [],
  lc_kwargs: { name: toolCall.function.name },
};
```

**Line 228:**
```typescript
// Current has 'content' which doesn't exist in LLMResult
return {
  content: response.content || "",
  tokensUsed: response.usage?.total_tokens,
  toolCalls: response.tool_calls || [],
};

// Should be:
return {
  generations: [[{
    text: response.content || "",
    generationInfo: {
      tokensUsed: response.usage?.total_tokens,
      toolCalls: response.tool_calls || [],
    }
  }]],
  llmOutput: {
    tokensUsed: response.usage?.total_tokens,
  }
};
```

---

### 5. Fix Reason Node Message Types

**File:** `lib/ai-system/nodes/reason.ts:121`

**Current:**
```typescript
const messages = [
  { role: "system", content: systemPrompt }, // 'string' not assignable to MessageRole
  { role: "user", content: userPrompt },
];
```

**Fix:**
```typescript
import type { Message, MessageRole } from "../llm/types";

const messages: Message[] = [
  { role: "system" as MessageRole, content: systemPrompt },
  { role: "user" as MessageRole, content: userPrompt },
];

// Or define MessageRole properly in types:
export type MessageRole = "system" | "user" | "assistant" | "tool";
```

---

## Verification Steps

After each fix:

1. **TypeScript Check:**
   ```bash
   npx tsc --noEmit
   ```

2. **Test Chat API:**
   ```bash
   curl -X POST http://localhost:3000/api/chat/agent \
     -H "Content-Type: application/json" \
     -d '{"agent_id":"...", "message":"Hello"}'
   ```

3. **Check Logs:**
   - Should see `[UniversalWorkflow] Starting workflow for event:chat`
   - Should see tool calls and reasoning steps
   - Should see successful completion

4. **Verify Tools Registered:**
   ```typescript
   // In any API route or test:
   import { getAllTools, ensureInitialized } from "@/lib/ai-system";
   ensureInitialized();
   console.log(`Total tools: ${getAllTools().length}`); // Should be 31
   ```

---

## Timeline

- **Step 1 (Chat API):** 15 minutes
- **Step 2 (Trigger routes):** 10 minutes
- **Step 3 (Missing imports):** 10 minutes
- **Step 4 (LLM types):** 10 minutes
- **Step 5 (Reason types):** 5 minutes
- **Testing:** 20 minutes

**Total:** ~70 minutes to full integration

---

## Success Criteria

✅ All TypeScript errors resolved
✅ Chat API uses universal workflow
✅ Trigger routes functional or removed
✅ No missing module errors
✅ Admin panel still works
✅ Tests pass

---

## Rollback Plan

If issues arise:
1. Revert chat API to use `runDMWorkflow` temporarily
2. Keep deprecated workflows active
3. Fix issues one at a time
4. Test thoroughly before next attempt

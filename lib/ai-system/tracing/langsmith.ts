/**
 * LANGSMITH INTEGRATION - PROPER IMPLEMENTATION
 * Complete tracing with proper run hierarchies and categorization
 *
 * Run Structure:
 * - Workflow (chain) - Top level
 *   - Observe Node (chain)
 *   - Reason Node (chain)
 *     - LLM Call (llm)
 *     - Tool Execution (tool)
 *   - Act Node (chain)
 *   - Loop Node (chain)
 */

import { Client } from "langsmith";
import { AsyncLocalStorage } from "node:async_hooks";

const LANGSMITH_ENABLED = !!process.env.LANGSMITH_API_KEY;
let clientInstance: Client | null = null;

type TraceStore = {
  runStack: string[];
};

type MaybePromise<T> = T | Promise<T>;

function isPromiseLike<T>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in (value as any) &&
    typeof (value as any).then === "function"
  );
}

// NOTE: LangSmith runs can be created concurrently (e.g., multiple mention workflows "fire and forget").
// A single global stack will corrupt parent-child relationships and cause "Run stack mismatch" warnings.
// AsyncLocalStorage keeps a separate stack per workflow invocation.
const traceStore = new AsyncLocalStorage<TraceStore>();
const fallbackStore: TraceStore = { runStack: [] };

function getStore(): TraceStore {
  return traceStore.getStore() ?? fallbackStore;
}

export async function withLangSmithTraceContext<T>(fn: () => Promise<T>): Promise<T> {
  return await traceStore.run({ runStack: [] }, fn);
}

function getMaxStringChars(): number {
  const raw = process.env.LANGSMITH_MAX_STRING_CHARS;
  if (!raw) return 0; // 0 = no truncation
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toTraceValue(value: unknown, opts?: { maxStringChars?: number }): unknown {
  const maxStringChars = opts?.maxStringChars ?? 0;
  const seen = new WeakSet<object>();

  const walk = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") {
      if (maxStringChars > 0 && v.length > maxStringChars) {
        return `${v.slice(0, maxStringChars)}…[truncated ${v.length - maxStringChars} chars]`;
      }
      return v;
    }
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (v instanceof Error) {
      return { name: v.name, message: v.message, stack: v.stack };
    }
    if (Array.isArray(v)) {
      // Arrays are objects, but using WeakSet needs a non-primitive.
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      return v.map(walk);
    }
    if (typeof v === "object") {
      if (seen.has(v)) return "[Circular]";
      seen.add(v as object);
      const out: Record<string, any> = {};
      for (const [k, val] of Object.entries(v as Record<string, any>)) {
        out[k] = walk(val);
      }
      return out;
    }
    return String(v);
  };

  return walk(value);
}

function createUUIDv4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // RFC 4122 version 4
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

/**
 * Get or create LangSmith client
 */
function getClient(): Client | null {
  if (!LANGSMITH_ENABLED) {
    return null;
  }

  if (clientInstance) {
    return clientInstance;
  }

  try {
    clientInstance = new Client({
      apiUrl: process.env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
      apiKey: process.env.LANGSMITH_API_KEY,
    });
    return clientInstance;
  } catch (error) {
    console.error("[LangSmith] Failed to initialize client:", error);
    return null;
  }
}

/**
 * Check if LangSmith is enabled
 */
export function isLangSmithEnabled(): boolean {
  return LANGSMITH_ENABLED;
}

// ============================================================================
// WORKFLOW TRACING
// ============================================================================

/**
 * Start workflow trace (top-level parent run)
 */
export async function startWorkflowTrace(scope: any): Promise<string | null> {
  const client = getClient();
  if (!client) {
    return null;
  }

  const traceId = createUUIDv4();
  const projectName = process.env.LANGSMITH_PROJECT || "eintelligence";
  const maxStringChars = getMaxStringChars();

  try {
    await client.createRun({
      id: traceId,
      project_name: projectName,
      name: `Workflow: ${scope.trigger.type}:${scope.trigger.event || scope.trigger.schedule}`,
      run_type: "chain",
      inputs: {
        scope: toTraceValue(scope, { maxStringChars }),
        trigger: `${scope.trigger.type}:${scope.trigger.event || scope.trigger.schedule}`,
        actor_id: scope.actor.id,
        actor_type: scope.actor.type,
        subject_id: scope.subject?.id,
        subject_type: scope.subject?.type,
        has_conversation: !!scope.conversationId,
      },
      extra: {
        metadata: {
          workflow_type: "universal",
          trigger_timestamp: scope.trigger.timestamp,
        },
      },
      start_time: Date.now(),
    });

    // Push to run stack
    getStore().runStack.push(traceId);

    console.log(`[LangSmith] ✓ Started workflow trace: ${traceId}`);
    return traceId;
  } catch (error: any) {
    console.error("[LangSmith] Failed to start workflow trace:", error?.message ?? error);
    return null;
  }
}

/**
 * End workflow trace
 */
export function endWorkflowTrace(
  traceId: MaybePromise<string | null>,
  success: boolean,
  duration: number,
  executedActions: number,
  summary?: {
    totalIterations?: number;
    finalAction?: string;
    errorCount?: number;
    actionsList?: string[];
  }
): void {
  if (!traceId) return;
  if (isPromiseLike<string | null>(traceId)) {
    void traceId.then((resolved) => {
      endWorkflowTrace(resolved, success, duration, executedActions, summary);
    });
    return;
  }

  const client = getClient();
  if (!client) return;

  try {
    // LangSmith expects outputs to be a simple object, not nested
    const outputs = {
      status: success ? "success" : "failed",
      duration_ms: duration,
      iterations: summary?.totalIterations || 1,
      actions: summary?.actionsList?.join(", ") || "none",
      action_count: executedActions,
      errors: summary?.errorCount || 0,
    };

    console.log(`[LangSmith] Updating workflow ${traceId} with outputs:`, outputs);

    void client.updateRun(traceId, {
      end_time: Date.now(),
      outputs,
      error: success ? undefined : "Workflow completed with errors",
    }).catch((error: any) => {
      console.error("[LangSmith] Failed to end workflow trace:", error?.message ?? error);
      console.error("[LangSmith] Attempted outputs:", outputs);
    });

    // Pop from run stack
    const stack = getStore().runStack;
    const poppedId = stack.pop();
    if (poppedId !== traceId) {
      console.warn(`[LangSmith] Run stack mismatch: expected ${traceId}, got ${poppedId}`);
      // Best-effort cleanup to avoid cascading parent-child corruption within this context.
      const idx = stack.lastIndexOf(traceId);
      if (idx >= 0) stack.splice(idx, 1);
    }
    // Workflow end should leave the stack empty for this context.
    stack.length = 0;

    console.log(`[LangSmith] ✓ Ended workflow trace: ${traceId} (${duration}ms, ${executedActions} actions)`);
  } catch (error: any) {
    console.error("[LangSmith] Failed to end workflow trace:", error?.message ?? error);
  }
}

// ============================================================================
// NODE TRACING
// ============================================================================

/**
 * Start a workflow node trace (child of workflow)
 */
export function startNodeTrace(
  nodeName: string,
  state: any
): Promise<string | null> {
  const client = getClient();
  if (!client) return Promise.resolve(null);

  const stack = getStore().runStack;
  const parentId = stack[stack.length - 1];
  if (!parentId) {
    console.warn(`[LangSmith] No parent run for node ${nodeName}`);
    return Promise.resolve(null);
  }

  const nodeId = createUUIDv4();
  const projectName = process.env.LANGSMITH_PROJECT || "eintelligence";
  const maxStringChars = getMaxStringChars();

  try {
    return client
      .createRun({
      id: nodeId,
      project_name: projectName,
      name: `Node: ${nodeName}`,
      run_type: "chain",
      parent_run_id: parentId,
      inputs: {
        node: nodeName,
        iteration: state.loop?.iteration || 1,
        step: state.step,
        has_observation: !!state.observation,
        has_reasoning: !!state.reasoning,
        trigger: `${state.scope?.trigger?.type}:${state.scope?.trigger?.event || state.scope?.trigger?.schedule}`,
        actor_id: state.scope?.actor?.id,
        subject: toTraceValue(state.scope?.subject, { maxStringChars }),
      },
      start_time: Date.now(),
    })
      .then(() => {
        stack.push(nodeId);
        console.log(`[LangSmith] ✓ Started node trace: ${nodeName} (${nodeId})`);
        return nodeId;
      })
      .catch((error: any) => {
        console.error(`[LangSmith] Failed to start node trace for ${nodeName}:`, error?.message ?? error);
        return null;
      });
  } catch (error: any) {
    console.error(`[LangSmith] Failed to start node trace for ${nodeName}:`, error?.message ?? error);
    return Promise.resolve(null);
  }
}

/**
 * End a workflow node trace
 */
export function endNodeTrace(
  nodeId: MaybePromise<string | null>,
  outputs: Record<string, any>,
  error?: string
): void {
  if (!nodeId) return;
  if (isPromiseLike<string | null>(nodeId)) {
    void nodeId.then((resolved) => {
      endNodeTrace(resolved, outputs, error);
    });
    return;
  }

  const client = getClient();
  if (!client) return;

  try {
    const maxStringChars = getMaxStringChars();
    void client.updateRun(nodeId, {
      end_time: Date.now(),
      outputs: toTraceValue(outputs, { maxStringChars }) as Record<string, any>,
      error,
    }).catch((error: any) => {
      console.error(`[LangSmith] Failed to end node trace ${nodeId}:`, error?.message ?? error);
    });

    const stack = getStore().runStack;
    const poppedId = stack.pop();
    if (poppedId !== nodeId) {
      console.warn(`[LangSmith] Run stack mismatch: expected ${nodeId}, got ${poppedId}`);
      const idx = stack.lastIndexOf(nodeId);
      if (idx >= 0) stack.splice(idx, 1);
    }

    console.log(`[LangSmith] ✓ Ended node trace: ${nodeId}`);
  } catch (error: any) {
    console.error(`[LangSmith] Failed to end node trace ${nodeId}:`, error?.message ?? error);
  }
}

// ============================================================================
// LLM CALL TRACING
// ============================================================================

/**
 * Trace LLM call (child of current node)
 */
export function traceLLMCall(
  model: string,
  messages: Array<{ role: string; content: string }>,
  tools: any[],
  response: any,
  duration: number
): void {
  const client = getClient();
  if (!client) return;

  const stack = getStore().runStack;
  const parentId = stack[stack.length - 1];
  if (!parentId) {
    console.warn("[LangSmith] No parent run for LLM call");
    return;
  }

  const llmId = createUUIDv4();
  const projectName = process.env.LANGSMITH_PROJECT || "eintelligence";
  const maxStringChars = getMaxStringChars();

  try {
    const startTime = Date.now() - duration;

    void client.createRun({
      id: llmId,
      project_name: projectName,
      name: `LLM: ${model}`,
      run_type: "llm",
      parent_run_id: parentId,
      inputs: {
        messages: toTraceValue(messages, { maxStringChars }),
        model,
        tools: toTraceValue(tools, { maxStringChars }),
      },
      outputs: {
        content: toTraceValue(response?.content, { maxStringChars }),
        tool_calls: toTraceValue(response?.toolCalls, { maxStringChars }),
        tokens_used: response?.tokensUsed,
        finish_reason: response?.finishReason,
        response: toTraceValue(response, { maxStringChars }),
      },
      extra: {
        metadata: {
          provider: "mistral",
          duration_ms: duration,
        },
      },
      start_time: startTime,
      end_time: Date.now(),
    }).catch((error: any) => {
      console.error("[LangSmith] Failed to trace LLM call:", error?.message ?? error);
    });

    console.log(`[LangSmith] ✓ Traced LLM call: ${model} (${response.tokensUsed || 0} tokens, ${duration}ms)`);
  } catch (error: any) {
    console.error("[LangSmith] Failed to trace LLM call:", error?.message ?? error);
  }
}

// ============================================================================
// TOOL EXECUTION TRACING
// ============================================================================

/**
 * Trace tool execution (child of current node)
 */
export function traceToolExecution(
  toolName: string,
  input: Record<string, any>,
  result: any,
  duration: number,
  success: boolean
): void {
  const client = getClient();
  if (!client) return;

  const stack = getStore().runStack;
  const parentId = stack[stack.length - 1];
  if (!parentId) {
    console.warn("[LangSmith] No parent run for tool execution");
    return;
  }

  const toolId = createUUIDv4();
  const projectName = process.env.LANGSMITH_PROJECT || "eintelligence";
  const maxStringChars = getMaxStringChars();

  try {
    const startTime = Date.now() - duration;

    void client.createRun({
      id: toolId,
      project_name: projectName,
      name: `Tool: ${toolName}`,
      run_type: "tool",
      parent_run_id: parentId,
      inputs: toTraceValue(
        {
          tool: toolName,
          ...input,
        },
        { maxStringChars }
      ) as Record<string, any>,
      outputs: toTraceValue(
        success
          ? { success: true, data: result.data }
          : { success: false, error: result.error, data: result.data },
        { maxStringChars }
      ) as Record<string, any>,
      error: success ? undefined : result.error,
      extra: {
        metadata: {
          duration_ms: duration,
        },
      },
      start_time: startTime,
      end_time: Date.now(),
    }).catch((error: any) => {
      console.error(`[LangSmith] Failed to trace tool ${toolName}:`, error?.message ?? error);
    });

    console.log(`[LangSmith] ✓ Traced tool: ${toolName} (${success ? 'success' : 'failed'}, ${duration}ms)`);
  } catch (error: any) {
    console.error(`[LangSmith] Failed to trace tool ${toolName}:`, error?.message ?? error);
  }
}

// ============================================================================
// LEGACY COMPATIBILITY (deprecated but kept for backwards compatibility)
// ============================================================================

export function traceWorkflowExecution(traceId: string, data: any): void {
  // Legacy function - data is logged but not sent to LangSmith
  // The new system uses startWorkflowTrace/endWorkflowTrace instead
  console.log(`[LangSmith] Legacy trace call (ignored):`, { traceId });
}

export function traceWorkflowError(traceId: string, step: string, error: string): void {
  console.log(`[LangSmith] Workflow error in ${step}:`, error.substring(0, 100));
}

export function traceDecision(
  decision: string,
  confidence: number,
  factors: Record<string, number>,
  reasoning: string,
  loopIteration: number
): void {
  // Logged but not sent to LangSmith directly - captured in reasoning node
  console.log(`[LangSmith] Decision: ${decision} (confidence: ${(confidence * 100).toFixed(0)}%)`);
}

export function traceBatchOperation(
  operationName: string,
  itemCount: number,
  successCount: number,
  duration: number,
  metadata?: Record<string, any>
): void {
  console.log(`[LangSmith] Batch: ${operationName} (${successCount}/${itemCount}, ${duration}ms)`);
}

// ============================================================================
// LANGCHAIN COMPATIBILITY (for LLM Manager)
// ============================================================================

/**
 * Get LangChain tracer - DEPRECATED
 * This creates too many runs. Use the new Client-based tracing instead.
 */
export function getLangsmithTracer(): any | null {
  // Disabled - returning null will make LLM Manager skip LangChain-style tracing
  // We handle tracing manually with traceLLMCall() instead
  return null;
}

// ============================================================================
// STATUS & CONFIG
// ============================================================================

export function getTracingStatus(): {
  enabled: boolean;
  endpoint?: string;
  hasApiKey: boolean;
  project?: string;
} {
  return {
    enabled: LANGSMITH_ENABLED,
    endpoint: process.env.LANGSMITH_ENDPOINT,
    hasApiKey: !!process.env.LANGSMITH_API_KEY,
    project: process.env.LANGSMITH_PROJECT,
  };
}

export function logTracingConfig(): void {
  const status = getTracingStatus();

  console.log("[LangSmith] Tracing Configuration:");
  console.log(`  - Enabled: ${status.enabled}`);
  console.log(`  - Project: ${status.project || "not set"}`);
  console.log(`  - Endpoint: ${status.endpoint || "default (api.smith.langchain.com)"}`);
  console.log(`  - API Key: ${status.hasApiKey ? "✓ configured" : "✗ not configured"}`);

  if (!status.enabled) {
    console.warn("[LangSmith] ⚠️  Tracing disabled - set LANGSMITH_API_KEY to enable");
  }

  if (status.enabled && !status.project) {
    console.warn("[LangSmith] ⚠️  LANGSMITH_PROJECT not set - using 'eintelligence'");
  }
}

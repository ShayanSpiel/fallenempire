/**
 * UNIFIED TOOL REGISTRY
 * Central registry for all tools used in workflows
 * Supports both native LLM function calling and direct execution
 */

import type { ToolDefinitionV2, LLMFunction, ToolExecutionContext, ToolResult } from "../core/types";
import { traceToolExecution } from "../tracing/langsmith";

// ============================================================================
// TOOL REGISTRY
// ============================================================================

const TOOL_REGISTRY = new Map<string, ToolDefinitionV2>();

function normalizeToolInputValue(value: unknown, toolName: string, context: ToolExecutionContext): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeToolInputValue(item, toolName, context));
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string") {
      const trimmed = value.trim();
      const meta = context.metadata ?? {};

      const replacements: Record<string, unknown> = {
        "event.userId": meta.userId,
        "event.user.id": meta.userId,
        "event.mentionerId": meta.userId,
        "event.senderId": meta.userId,
        "subject.userId": meta.userId,
        "subject.user.id": meta.userId,
        "event.postId": meta.postId,
        "event.post.id": meta.postId,
        "subject.postId": meta.postId,
        "subject.id": meta.subjectId,
      };

      if (trimmed in replacements && replacements[trimmed]) {
        return replacements[trimmed];
      }

      return value;
    }

    return value;
  }

  const recordValue = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(recordValue)) {
    normalized[key] = normalizeToolInputValue(child, toolName, context);
  }
  return normalized;
}

function normalizeToolInput(
  toolName: string,
  input: Record<string, any>,
  context: ToolExecutionContext
): Record<string, any> {
  const normalized = normalizeToolInputValue(input, toolName, context) as Record<string, any>;
  const meta = context.metadata ?? {};

  const subjectType = meta.subjectType as string | undefined;
  const subjectId = meta.subjectId as string | undefined;
  const postId = meta.postId as string | undefined;
  const inferredUserId = meta.userId as string | undefined;

  // If the model accidentally uses the postId/subjectId where a userId is expected, correct it.
  if (inferredUserId && typeof normalized.userId === "string") {
    if ((subjectType === "post" && normalized.userId === subjectId) || (postId && normalized.userId === postId)) {
      normalized.userId = inferredUserId;
    }
  }
  if (inferredUserId && typeof normalized.targetId === "string") {
    if ((subjectType === "post" && normalized.targetId === subjectId) || (postId && normalized.targetId === postId)) {
      normalized.targetId = inferredUserId;
    }
  }

  // If the model uses placeholder values, ensure required IDs are filled when possible.
  if (toolName === "get_post_details" && !normalized.postId && subjectType === "post" && subjectId) {
    normalized.postId = subjectId;
  }

  return normalized;
}

/**
 * Register a tool in the global registry
 */
export function registerTool(tool: ToolDefinitionV2): void {
  TOOL_REGISTRY.set(tool.name, tool);
  console.log(`[Tools] Registered tool: ${tool.name}`);
}

/**
 * Get a tool by name
 */
export function getTool(name: string): ToolDefinitionV2 | undefined {
  return TOOL_REGISTRY.get(name);
}

/**
 * Get all tools
 */
export function getAllTools(): ToolDefinitionV2[] {
  return Array.from(TOOL_REGISTRY.values());
}

/**
 * Get tools for a specific category
 */
export function getToolsByCategory(
  category: "data" | "action" | "reasoning"
): ToolDefinitionV2[] {
  return Array.from(TOOL_REGISTRY.values()).filter((t) => t.category === category);
}

/**
 * Convert tool registry to LLM function definitions
 * Used for native LLM function calling
 */
export function getToolsAsLLMFunctions(options?: {
  categories?: Array<"data" | "action" | "reasoning">;
  names?: string[];
}): LLMFunction[] {
  const allowedCategories = options?.categories;
  const allowedNames = options?.names ? new Set(options.names) : undefined;

  const tools = getAllTools().filter((tool) => {
    if (allowedCategories && !allowedCategories.includes(tool.category)) return false;
    if (allowedNames && !allowedNames.has(tool.name)) return false;
    return true;
  });

  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    },
  }));
}

/**
 * Execute a tool with minimal context
 */
export async function executeTool(
  toolName: string,
  input: Record<string, any>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  const startTime = Date.now();

  try {
    const tool = getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
        executionTime: Date.now() - startTime,
      };
    }

    const normalizedInput = normalizeToolInput(toolName, input, context);

    // Execute tool with context
    const result = await tool.handler(normalizedInput, context);

    const executionTime = Date.now() - startTime;
    const toolResult = {
      success: true,
      data: result,
      executionTime,
    };

    // Trace tool execution
    traceToolExecution(toolName, normalizedInput, toolResult, executionTime, true);

    return toolResult;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const toolResult = {
      success: false,
      error: error.message || "Unknown error",
      executionTime,
    };

    // Trace failed tool execution
    traceToolExecution(toolName, input, toolResult, executionTime, false);

    return toolResult;
  }
}

/**
 * Execute multiple tools in sequence
 * Stops on first failure
 */
export async function executeToolChain(
  toolCalls: Array<{ name: string; arguments: Record<string, any> }>,
  context: ToolExecutionContext
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const call of toolCalls) {
    const result = await executeTool(call.name, call.arguments, context);
    results.push(result);

    if (!result.success) {
      console.warn(`[Tools] Tool ${call.name} failed, stopping chain`);
      break;
    }
  }

  return results;
}

export { getToolsAsLLMFunctions as getToolDefinitions };

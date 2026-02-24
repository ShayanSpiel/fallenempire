/**
 * AI SYSTEM - Main Entry Point
 * Tool-Augmented Autonomous Agent System
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

export * from "./core/types";

// ============================================================================
// WORKFLOW EXPORTS
// ============================================================================

export { executeUniversalWorkflow, createInitialState } from "./workflows/universal";

// ============================================================================
// NODE EXPORTS
// ============================================================================

export { observeNode } from "./nodes/observe";
export { reasonNode } from "./nodes/reason";
export { actNode } from "./nodes/act";
export { loopNode } from "./nodes/loop";

// ============================================================================
// TOOL EXPORTS
// ============================================================================

export { registerAllTools } from "./tools";
export { registerTool, getTool, getAllTools, getToolsByCategory, getToolsAsLLMFunctions, executeTool, executeToolChain } from "./tools/registry";
export { registerDataTools } from "./tools/data";
export { registerActionTools } from "./tools/actions";

// ============================================================================
// LLM EXPORTS
// ============================================================================

export { getLLMManager } from "./llm/manager";

// ============================================================================
// SERVICE EXPORTS
// ============================================================================

export { runPostProcessingCycle } from "./services/post-processor";

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the AI system
 * Call this once at application startup
 */
export function initializeAISystem(): void {
  console.log("[AI System] Initializing...");

  // Initialize LLM Manager
  const { getLLMManager } = require("./llm/manager");
  try {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.warn("[AI System] Warning: MISTRAL_API_KEY not set - LLM features will not work");
      console.warn("[AI System] Set MISTRAL_API_KEY in your .env file");
    }

    getLLMManager({
      defaultProvider: "mistral",
      providers: {
        mistral: {
          apiKey: apiKey || "missing-api-key",
          defaultModel: "mistral-small-latest", // Default to Small for speed/cost balance
        },
      },
      cache: {
        enabled: true,
        ttl: 300,
      },
      retries: {
        maxRetries: 3,
        backoffMultiplier: 2,
      },
      logging: {
        enabled: true,
        level: "info",
      },
    });
    console.log("[AI System] LLM Manager initialized");
  } catch (error) {
    console.error("[AI System] LLM Manager initialization failed:", error);
  }

  // Register all tools
  const { registerAllTools } = require("./tools");
  registerAllTools();

  console.log("[AI System] Initialized successfully");
}

/**
 * Auto-initialize on import (can be disabled if needed)
 */
let initialized = false;

export function ensureInitialized() {
  if (!initialized) {
    initializeAISystem();
    initialized = true;
  }
}

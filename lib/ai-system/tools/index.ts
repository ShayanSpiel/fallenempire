/**
 * TOOLS INDEX
 * Central place to register all tools at startup
 */

import { registerDataTools } from "./data";
import { registerActionTools } from "./actions";

/**
 * Register all tools
 * Call this once at application startup
 */
export function registerAllTools() {
  console.log("[Tools] Registering all tools...");

  // Register data tools (read-only, context gathering)
  registerDataTools();

  // Register action tools (write operations, game actions)
  registerActionTools();

  console.log("[Tools] All tools registered successfully!");
}

// Re-export from registry
export * from "./registry";

/**
 * LLM Module Index
 * Exports all LLM-related types, providers, and managers
 */

export * from "./types";
export { MistralProvider } from "./providers/mistral";
export { LLMManager, getLLMManager, resetLLMManager } from "./manager";

// Create and export default LLM manager instance with Mistral
import { getLLMManager } from "./manager";
import { LLMManagerConfig } from "./types";

/**
 * Initialize default LLM manager with Mistral
 */
function initializeDefaultLLMManager(): any {
  try {
    const config: LLMManagerConfig = {
      defaultProvider: "mistral",
      providers: {
        mistral: {
          provider: "mistral",
          apiKey: process.env.MISTRAL_API_KEY || "",
          defaultModel: "mistral-small-latest",
          temperature: 0.7,
          maxTokens: 2048,
          timeout: 30000,
        },
      },
      cache: {
        enabled: true,
        ttl: 300, // 5 minutes
      },
      logging: {
        enabled: process.env.NODE_ENV === "development",
        level: "info",
      },
      retries: {
        maxRetries: 3,
        backoffMultiplier: 2,
      },
    };

    return getLLMManager(config);
  } catch (error) {
    console.error("[LLM] Failed to initialize default manager:", error);
    return null;
  }
}

// Lazy initialization
let defaultManager: any = null;

export function getDefaultLLMManager() {
  if (!defaultManager) {
    defaultManager = initializeDefaultLLMManager();
  }
  return defaultManager;
}

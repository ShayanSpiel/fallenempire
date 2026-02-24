/**
 * LLM Manager
 * Centralized LLM provider management with caching, retries, and logging
 */

import {
  ILLMProvider,
  CompletionRequest,
  CompletionResponse,
  LLMManagerConfig,
  ProviderCapabilities,
} from "./types";
import { MistralProvider } from "./providers/mistral";
import { getLangsmithTracer } from "../tracing/langsmith";
import { v4 as uuidv4 } from "uuid";

/**
 * Cache entry for completions
 */
interface CacheEntry {
  response: CompletionResponse;
  timestamp: number;
}

/**
 * LLM Manager class
 */
export class LLMManager {
  private providers: Map<string, ILLMProvider> = new Map();
  private config: LLMManagerConfig;
  private cache: Map<string, CacheEntry> = new Map();
  private defaultProvider: string;
  private readonly logger: any;

  constructor(config: LLMManagerConfig) {
    this.config = config;
    this.defaultProvider = config.defaultProvider;
    this.logger = this.createLogger();

    this.initializeProviders();
  }

  /**
   * Initialize all configured providers
   */
  private initializeProviders(): void {
    // Initialize Mistral
    if (this.config.providers.mistral) {
      try {
        const mistral = new MistralProvider(this.config.providers.mistral);
        this.providers.set("mistral", mistral);
        this.log("info", "Mistral provider initialized");
      } catch (error) {
        this.log("error", `Failed to initialize Mistral: ${error}`);
      }
    }

    // Future: Initialize OpenAI, Anthropic, HuggingFace providers
    // ...

    if (this.providers.size === 0) {
      throw new Error("At least one LLM provider must be configured");
    }
  }

  /**
   * Create logger instance
   */
  private createLogger() {
    const enabled = this.config.logging?.enabled ?? false;
    const level = this.config.logging?.level ?? "info";

    return {
      debug: (msg: string) => {
        if (enabled && (level === "debug")) {
          console.log(`[LLM:DEBUG] ${msg}`);
        }
      },
      info: (msg: string) => {
        if (enabled && ["debug", "info"].includes(level)) {
          console.log(`[LLM:INFO] ${msg}`);
        }
      },
      warn: (msg: string) => {
        if (enabled && ["debug", "info", "warn"].includes(level)) {
          console.warn(`[LLM:WARN] ${msg}`);
        }
      },
      error: (msg: string) => {
        if (enabled) {
          console.error(`[LLM:ERROR] ${msg}`);
        }
      },
    };
  }

  /**
   * Get a specific provider
   */
  private getProvider(providerName?: string): ILLMProvider {
    const name = providerName || this.defaultProvider;
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`Provider '${name}' not found or not configured`);
    }

    if (!provider.isConfigured()) {
      throw new Error(`Provider '${name}' is not properly configured`);
    }

    return provider;
  }

  /**
   * Get cache key from request
   */
  private getCacheKey(request: CompletionRequest): string {
    const messageKey = request.messages
      .map((m) => `${m.role}:${m.content}`)
      .join("|");
    return `${messageKey}:${request.temperature}:${request.maxTokens}`;
  }

  /**
   * Get from cache if enabled
   */
  private getFromCache(key: string): CompletionResponse | null {
    if (!this.config.cache?.enabled) {
      return null;
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const ttl = (this.config.cache.ttl || 300) * 1000;
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    this.logger.debug(`Cache hit for key: ${key}`);
    return entry.response;
  }

  /**
   * Store in cache if enabled
   */
  private storeInCache(key: string, response: CompletionResponse): void {
    if (!this.config.cache?.enabled) {
      return;
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute completion with retries
   */
  async complete(
    request: CompletionRequest,
    providerName?: string
  ): Promise<CompletionResponse> {
    const maxRetries = this.config.retries?.maxRetries ?? 3;
    const backoffMultiplier = this.config.retries?.backoffMultiplier ?? 2;
    let lastError: Error | null = null;

    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const tracer = getLangsmithTracer();
    // Retry loop
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let traceRun: any = null;

      try {
        const provider = this.getProvider(providerName);
        const providerModel =
          request.model || provider.getCapabilities().defaultModel;

        if (tracer) {
          try {
            // LangSmith tracing metadata
            const serializedMetadata = {
              lc: 1,
              type: "constructor" as const,
              lc_id: [provider.getProviderName(), providerModel],
              lc_kwargs: {
                name: provider.getProviderName(),
                model: providerModel,
              },
            };

            traceRun = await tracer.handleChatModelStart(
              serializedMetadata as any, // Type assertion for LangSmith compatibility
              [request.messages] as any,
              uuidv4(),
              undefined,
              {
                model: providerModel,
                temperature: request.temperature,
                maxTokens: request.maxTokens,
                topP: request.topP,
                provider: provider.getProviderName(),
              },
              request.metadata?.tags,
              request.metadata,
              providerModel
            );
          } catch (traceError) {
            this.logger.warn(
              `LangSmith tracer failed to start for ${provider.getProviderName()}: ${traceError}`
            );
            traceRun = null;
          }
          if (traceRun) {
            this.logger.debug(
              `[LangSmith] Started run ${traceRun.id} (${traceRun.name}) for provider ${provider.getProviderName()}`
            );
          }
        }

        const response = await provider.complete(request);

        if (tracer && traceRun) {
          try {
            // Create LLMResult structure for LangSmith
            const llmResult = {
              generations: [[{
                text: response.content,
                message: {
                  content: response.content,
                  additional_kwargs: {},
                },
                generationInfo: {
                  finish_reason: response.finishReason,
                },
              }]],
              llmOutput: {
                tokenUsage: {
                  totalTokens: response.tokensUsed,
                },
                model: response.model,
              },
            };

            await tracer.handleLLMEnd(llmResult as any, traceRun.id);
          } catch (traceError) {
            this.logger.warn(
              `LangSmith tracer failed to end run ${traceRun.id}: ${traceError}`
            );
          }
          this.logger.debug(`[LangSmith] Completed run ${traceRun.id}`);
        }

        // Store in cache
        this.storeInCache(cacheKey, response);

        this.logger.info(
          `Completion successful (provider: ${provider.getProviderName()}, tokens: ${response.tokensUsed})`
        );

        return response;
      } catch (error) {
        if (tracer && traceRun) {
          try {
            await tracer.handleLLMError(error, traceRun.id);
          } catch (traceError) {
            this.logger.warn(
              `LangSmith tracer failed to record error for run ${traceRun.id}: ${traceError}`
            );
          }
        }

        lastError = error as Error;
        this.logger.warn(
          `Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`
        );

        if (attempt < maxRetries - 1) {
          const delay = Math.pow(backoffMultiplier, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to complete after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate embeddings with a specific provider
   */
  async embeddings(texts: string[], providerName?: string): Promise<number[][]> {
    try {
      const provider = this.getProvider(providerName);
      const embeddings = await provider.embeddings(texts);

      this.logger.info(
        `Generated ${embeddings.length} embeddings (provider: ${provider.getProviderName()})`
      );

      return embeddings;
    } catch (error) {
      this.logger.error(`Embeddings generation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(providerName?: string): ProviderCapabilities {
    const provider = this.getProvider(providerName);
    return provider.getCapabilities();
  }

  /**
   * Check provider health
   */
  async checkHealth(providerName?: string): Promise<boolean> {
    try {
      const provider = this.getProvider(providerName);
      const healthy = await provider.healthCheck();

      if (healthy) {
        this.logger.info(`Provider '${provider.getProviderName()}' is healthy`);
      } else {
        this.logger.warn(`Provider '${provider.getProviderName()}' health check failed`);
      }

      return healthy;
    } catch (error) {
      this.logger.error(`Health check error: ${error}`);
      return false;
    }
  }

  /**
   * Get list of available providers
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info("Cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      enabled: this.config.cache?.enabled ?? false,
      size: this.cache.size,
      ttl: this.config.cache?.ttl ?? 300,
    };
  }

  /**
   * Internal logging
   */
  private log(level: "debug" | "info" | "warn" | "error", message: string): void {
    this.logger[level](message);
  }
}

/**
 * Singleton instance of LLM manager
 */
let llmManagerInstance: LLMManager | null = null;

/**
 * Get or create LLM manager singleton
 */
export function getLLMManager(config?: LLMManagerConfig): LLMManager {
  if (!llmManagerInstance) {
    if (!config) {
      throw new Error("LLM Manager config required for initialization");
    }
    llmManagerInstance = new LLMManager(config);
  }
  return llmManagerInstance;
}

/**
 * Reset LLM manager (for testing)
 */
export function resetLLMManager(): void {
  llmManagerInstance = null;
}

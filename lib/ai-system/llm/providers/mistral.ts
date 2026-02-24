/**
 * Mistral LLM Provider
 * Fully integrated Mistral API client with production-ready features
 */

import { Mistral } from "@mistralai/mistralai";
import {
  ILLMProvider,
  CompletionRequest,
  CompletionResponse,
  ProviderCapabilities,
  LLMProviderConfig,
  Message,
} from "../types";

/**
 * Mistral provider implementation
 */
export class MistralProvider implements ILLMProvider {
  private client: Mistral | null = null;
  private config: LLMProviderConfig;
  private readonly PROVIDER_NAME = "mistral";
  /**
   * Mistral Open Text Models - Prioritized from best to worst
   * All open-weight text/reasoning models available for fallback
   */
  private readonly MISTRAL_MODELS = {
    // Priority 1: Largest and most capable
    LARGE_LATEST: "mistral-large-latest",

    // Priority 2: Medium model (good balance)
    MEDIUM_LATEST: "mistral-medium-latest",

    // Priority 3: Small but proven (DEFAULT)
    SMALL_LATEST: "mistral-small-latest",

    // Priority 4: Open Mixtral 8x22B (very capable)
    MIXTRAL_8X22B: "open-mixtral-8x22b",

    // Priority 5: Open Mixtral 8x7B (good balance)
    MIXTRAL_8X7B: "open-mixtral-8x7b",

    // Priority 6: Open Mistral 7B (lightweight)
    MISTRAL_7B: "open-mistral-7b",

    // Embedding model (separate use case)
    EMBED: "mistral-embed",

    // Legacy aliases for backwards compatibility
    LARGE: "mistral-large-latest",
    MEDIUM: "mistral-medium-latest",
    SMALL: "mistral-small-latest",
  };

  /**
   * Fallback order - try models from best to worst (TEXT REASONING ONLY)
   */
  private readonly MODEL_FALLBACK_ORDER = [
    "mistral-large-latest",       // Priority 1: Best quality
    "mistral-medium-latest",      // Priority 2: Great balance
    "open-mixtral-8x22b",         // Priority 3: Very capable open model
    "mistral-small-latest",       // Priority 4: Fast & reliable (default)
    "open-mixtral-8x7b",          // Priority 5: Good open model
    "open-mistral-7b",            // Priority 6: Lightweight & fast
  ];

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new Error("Mistral API key is required");
    }
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens || 2048,
    };
    this.initializeClient();
  }

  /**
   * Initialize Mistral client
   */
  private initializeClient(): void {
    try {
      this.client = new Mistral({
        apiKey: this.config.apiKey,
      });
    } catch (error) {
      console.error("[Mistral] Failed to initialize client:", error);
      throw error;
    }
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.PROVIDER_NAME;
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: false,
      maxTokens: 32000,
      supportedModels: this.MODEL_FALLBACK_ORDER,
      defaultModel: this.config.defaultModel || this.MISTRAL_MODELS.SMALL_LATEST,
    };
  }

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey && !!this.client;
  }

  /**
   * Generate a completion using Mistral API with intelligent fallback
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.client) {
      throw new Error("[Mistral] Client not initialized");
    }

    const requestedModel = request.model || this.config.defaultModel || this.MISTRAL_MODELS.SMALL_LATEST;

    // Build the fallback model list
    const modelsToTry = this.buildFallbackList(requestedModel);

    console.log(`[Mistral] Attempting completion with ${modelsToTry.length} models (priority: ${requestedModel})`);

    let lastError: any = null;

    // Try each model in fallback order
    for (let i = 0; i < modelsToTry.length; i++) {
      const model = modelsToTry[i];
      const attemptNum = i + 1;

      try {
        console.log(`[Mistral] Attempt ${attemptNum}/${modelsToTry.length}: Using model ${model}`);

        const response = await this.client.chat.complete({
          model: model,
          messages: this.convertMessages(request.messages),
          temperature: request.temperature ?? this.config.temperature,
          maxTokens: request.maxTokens ?? this.config.maxTokens,
          topP: request.topP,
          ...(request.frequencyPenalty && { frequencyPenalty: request.frequencyPenalty }),
          ...(request.presencePenalty && { presencePenalty: request.presencePenalty }),
          // Add function tools if provided
          ...(request.tools && { tools: request.tools }),
        });

        const responseMessage = response.choices?.[0]?.message;
        const content = this.extractContent(responseMessage?.content);
        const hasToolCalls = (responseMessage?.toolCalls?.length ?? 0) > 0;

        if (!content && !hasToolCalls) {
          throw new Error("[Mistral] Empty response from API");
        }

        console.log(`[Mistral] ✓ Success with model ${model} (tokens: ${response.usage?.totalTokens || 0})`);

        return {
          content: content || "",
          model: response.model || model,
          tokensUsed: response.usage?.totalTokens || 0,
          finishReason: this.mapFinishReason(response.choices?.[0]?.finishReason),
          raw: response,
          toolCalls: this.extractToolCalls(response.choices?.[0]?.message),
        };
      } catch (error) {
        lastError = error;
        const errorMsg = this.getErrorMessage(error);

        console.warn(`[Mistral] ✗ Model ${model} failed (attempt ${attemptNum}/${modelsToTry.length}): ${errorMsg}`);

        // If this is the last model, throw the error
        if (i === modelsToTry.length - 1) {
          console.error(`[Mistral] All ${modelsToTry.length} models exhausted. Final error:`, errorMsg);
          throw this.handleError(error);
        }

        // Otherwise, continue to next model in fallback list
        console.log(`[Mistral] Falling back to next model...`);
      }
    }

    // Should never reach here, but just in case
    throw this.handleError(lastError || new Error("Unknown error during fallback"));
  }

  /**
   * Build fallback model list
   * Requested model first, then rest in priority order
   */
  private buildFallbackList(requestedModel: string): string[] {
    // Start with requested model
    const models = [requestedModel];

    // Add all other models in fallback order (skip if it's the requested model)
    for (const model of this.MODEL_FALLBACK_ORDER) {
      if (model !== requestedModel) {
        models.push(model);
      }
    }

    return models;
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (error?.message) return error.message;
    if (error?.status) return `HTTP ${error.status}`;
    if (typeof error === 'string') return error;
    return 'Unknown error';
  }

  /**
   * Extract tool calls from Mistral response
   */
  private extractToolCalls(message: any): any[] {
    if (!message?.toolCalls) {
      return [];
    }

    return message.toolCalls.map((call: any) => ({
      id: call.id,
      function: {
        name: call.function?.name,
        arguments: typeof call.function?.arguments === 'string'
          ? JSON.parse(call.function.arguments)
          : call.function?.arguments,
      },
    }));
  }

  /**
   * Generate embeddings using Mistral Embed
   */
  async embeddings(texts: string[]): Promise<number[][]> {
    if (!this.client) {
      throw new Error("[Mistral] Client not initialized");
    }

    try {
      if (texts.length === 0) {
        return [];
      }

      // Sanitize texts - remove newlines for embedding
      const cleanTexts = texts.map((t) => t.replace(/\n/g, " "));

      const response = await this.client?.embeddings.create({
        model: this.MISTRAL_MODELS.EMBED,
        inputs: cleanTexts,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error("[Mistral] Empty embedding response");
      }

      return response.data.map((item: any) => item.embedding || []);
    } catch (error) {
      console.error("[Mistral] Embeddings error:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Test provider connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.complete({
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 10,
      });
      return !!response.content;
    } catch (error) {
      console.error("[Mistral] Health check failed:", error);
      return false;
    }
  }

  /**
   * Convert generic messages to Mistral format
   */
  private convertMessages(messages: Message[]): any[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Extract content from Mistral response
   */
  private extractContent(content: string | any[] | null | undefined): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .filter((chunk: any) => chunk?.type === "text")
        .map((chunk: any) => chunk?.text || "")
        .join("");
    }

    return "";
  }

  /**
   * Map Mistral finish reason to standard format
   */
  private mapFinishReason(reason: string | undefined): "stop" | "length" | "error" {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      default:
        return "error";
    }
  }

  /**
   * Handle errors and provide user-friendly messages
   */
  private handleError(error: any): Error {
    if (error?.status === 401) {
      return new Error("[Mistral] Invalid API key");
    }
    if (error?.status === 429) {
      return new Error("[Mistral] Rate limit exceeded. Please try again later.");
    }
    if (error?.status === 500) {
      return new Error("[Mistral] Server error. Please try again later.");
    }
    return error || new Error("[Mistral] Unknown error occurred");
  }
}

/**
 * LLM Provider Types & Interfaces
 * Abstraction layer for supporting multiple LLM providers (Mistral, OpenAI, etc.)
 */

/**
 * Message role types
 */
export type MessageRole = "system" | "user" | "assistant";

/**
 * A single message in a conversation
 */
export interface Message {
  role: MessageRole;
  content: string;
}

/**
 * LLM completion request
 */
export interface CompletionRequest {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  model?: string;
  metadata?: Record<string, any>;
  tools?: any[]; // OpenAI-compatible tool definitions for function calling
}

/**
 * LLM completion response
 */
export interface CompletionResponse {
  content: string;
  model: string;
  tokensUsed: number;
  finishReason: "stop" | "length" | "error";
  raw?: any; // Raw provider response for debugging
  toolCalls?: Array<{ id: string; function: { name: string; arguments: Record<string, any> } }>; // Tool calls made by LLM
}

/**
 * LLM provider capabilities
 */
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  maxTokens: number;
  supportedModels: string[];
  defaultModel: string;
}

/**
 * LLM provider interface - all providers must implement this
 */
export interface ILLMProvider {
  /**
   * Get provider name
   */
  getProviderName(): string;

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities;

  /**
   * Check if provider is properly configured
   */
  isConfigured(): boolean;

  /**
   * Generate a completion
   */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /**
   * Generate embeddings
   */
  embeddings(texts: string[]): Promise<number[][]>;

  /**
   * Test provider connectivity
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Configuration for an LLM provider
 */
export interface LLMProviderConfig {
  provider: "mistral" | "openai" | "anthropic" | "huggingface";
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * LLM Manager configuration
 */
export interface LLMManagerConfig {
  defaultProvider: "mistral" | "openai" | "anthropic" | "huggingface";
  providers: {
    mistral?: LLMProviderConfig;
    openai?: LLMProviderConfig;
    anthropic?: LLMProviderConfig;
    huggingface?: LLMProviderConfig;
  };
  cache?: {
    enabled: boolean;
    ttl?: number; // seconds
  };
  logging?: {
    enabled: boolean;
    level?: "debug" | "info" | "warn" | "error";
  };
  retries?: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

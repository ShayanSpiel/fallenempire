/**
 * AI System Configuration
 * Centralized configuration for all AI modules
 */

import { LLMConfig, VectorStoreConfig, AgentCycleConfig } from "../types";

// ============================================================================
// LLM CONFIGURATION
// ============================================================================

export const LLM_CONFIG: Record<string, LLMConfig> = {
  default: {
    model: "mistral-small-latest",
    temperature: 0.5,
    maxTokens: 2048,
  },

  reasoning: {
    model: "mistral-small-latest",
    temperature: 0.3,
    maxTokens: 1024,
  },

  creative: {
    model: "mistral-small-latest",
    temperature: 0.8,
    maxTokens: 2048,
  },

  analysis: {
    model: "mistral-small-latest",
    temperature: 0.2,
    maxTokens: 512,
  },
};

// ============================================================================
// VECTOR STORE CONFIGURATION
// ============================================================================

export const VECTOR_STORE_CONFIG: VectorStoreConfig = {
  provider: "supabase",
  tableName: "agent_memories",
  dimensions: 1536,
  similarityThreshold: 0.5,
};

export const RAG_CONFIG = {
  provider: "supabase",
  documentsTable: "rag_documents",
  chunksTable: "rag_chunks",
  chunkSize: 500,
  chunkOverlap: 100,
  minChunkSize: 50,
};

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

export const AGENT_CYCLE_CONFIG: AgentCycleConfig = {
  maxConcurrent: 5,
  batchSize: 8,
  timeout: 30000,
  retries: 2,
};

// ============================================================================
// MEMORY CONFIGURATION
// ============================================================================

export const MEMORY_CONFIG = {
  conversationMemorySize: 10, // Last N messages
  semanticRetrievalLimit: 5, // Retrieve N relevant memories
  memoryDecayDays: 30, // Forget memories older than N days
  importanceUpdateFrequency: 3600000, // Update importance every hour
};

// ============================================================================
// PROMPT CONFIGURATION
// ============================================================================

export const PROMPT_CONFIG = {
  defaultModel: "mistral-small-latest",
  defaultTemperature: 0.5,
  maxPromptTokens: 2000,
};

// ============================================================================
// TOOL CONFIGURATION
// ============================================================================

export const TOOL_CONFIG = {
  maxParallelTools: 3,
  toolTimeoutMs: 5000,
  retryOnFailure: true,
  maxRetries: 2,
};

// ============================================================================
// LOGGING & MONITORING
// ============================================================================

export const LOGGING_CONFIG = {
  enabled: true,
  level: process.env.LOG_LEVEL || "info",
  logWorkflowSteps: true,
  logToolExecution: true,
  logMemoryOperations: true,
  logVectorStore: true,
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  enableRAG: true,
  enableVectorStore: true,
  enableMemoryOptimization: true,
  enableLangGraph: true,
  enableToolExecution: true,
  enableConversationChains: true,
};

// ============================================================================
// PERFORMANCE TUNING
// ============================================================================

export const PERFORMANCE_CONFIG = {
  // Caching
  enableEmbeddingCache: true,
  embeddingCacheTTL: 3600, // 1 hour

  // Batching
  enableBatching: true,
  batchWaitTimeMs: 100,
  batchMaxSize: 32,

  // Connection pooling
  maxConnections: 10,
  connectionTimeout: 5000,

  // Memory optimization
  enableMemoryCleanup: true,
  cleanupIntervalMs: 300000, // Every 5 minutes
};

// ============================================================================
// DEVELOPMENT/TESTING
// ============================================================================

export const DEV_CONFIG = {
  mockVectorStore: false,
  mockLLM: false,
  logAllRequests: false,
  slowdownRequests: 0, // Add artificial delay (ms)
};

/**
 * Core Type Definitions for AI System
 * Central location for all type interfaces
 */

// ============================================================================
// IDENTITY & PERSONALITY TYPES
// ============================================================================

export type IdentityAxis = "order_chaos" | "self_community" | "logic_emotion" | "power_harmony" | "tradition_innovation";

export interface IdentityVector {
  order_chaos: number;
  self_community: number;
  logic_emotion: number;
  power_harmony: number;
  tradition_innovation: number;
}

export interface PsychometricProfile {
  identity: IdentityVector;
  morale: number;
  mentalPower: number;
  freewill: number;
  coherence: number;
  reasoning: number;
}

// ============================================================================
// MEMORY & CONTEXT TYPES
// ============================================================================

export type MemoryType = "observation" | "action" | "reflection" | "interaction" | "goal" | "learned";

export interface MemoryRecord {
  id: string;
  userId: string;
  content: string;
  type: MemoryType;
  embedding: number[];
  metadata: Record<string, any>;
  createdAt: Date;
  importance: number; // 0-1 score for prioritization
  accessCount: number;
  lastAccessedAt: Date;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  agentId: string;
  messages: ConversationMessage[];
  memories: string[];
  relevantContext: Record<string, any>;
}

// ============================================================================
// DOCUMENT & RAG TYPES
// ============================================================================

export type DocumentType = "knowledge" | "memory" | "context" | "instruction" | "example";

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding: number[];
  metadata: Record<string, any>;
}

export interface RAGRetrievalResult {
  chunks: DocumentChunk[];
  relevanceScores: number[];
  totalRetrieved: number;
}

// ============================================================================
// EMBEDDING TYPES
// ============================================================================

export interface EmbeddingConfig {
  model: string;
  dimension: number;
  provider: "mistral" | "openai" | "huggingface";
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  tokens: number;
}

// ============================================================================
// LANGRAPH WORKFLOW TYPES
// ============================================================================

export interface AgentState {
  // Input
  postId?: string;
  messageContent?: string;
  targetUserId?: string;

  // Agent context
  agentId: string;
  agentIdentity: IdentityVector;
  agentMorale: number;
  agentRelationships: RelationshipMap;

  // Processing
  perception: PerceptionOutput;
  retrievedMemories: MemoryRecord[];
  relevantContext: Record<string, any>;
  reasoning: ReasoningOutput;

  // Decision
  decision: AgentDecision;
  confidence: number;
  metadata: Record<string, any>;

  // Execution
  executed: boolean;
  executedActions: string[];
  resultMetadata: Record<string, any>;
}

export interface PerceptionOutput {
  gameState: Record<string, any>;
  targetContext: Record<string, any>;
  environmentContext: Record<string, any>;
  availableActions?: string[];
  communitySuggestions?: Array<{
    id: string;
    name?: string;
    ideology?: Record<string, number>;
    membersCount?: number;
  }>;
  recentContent?: Array<{
    id: string;
    summary: string;
  }>;
}

export interface ReasoningOutput {
  primaryReasoning: string;
  alternativeOptions: string[];
  confidence: number;
  factors: Record<string, number>;
  targetId?: string;
  explanation?: string;
  chosenAction?: string;
  actionContext?: string;
}

export interface AgentDecision {
  action: string;
  target?: string;
  content?: string;
  metadata: Record<string, any>;
}

export type RelationshipMap = Record<string, RelationshipData>;

export interface RelationshipData {
  targetId: string;
  sentiment: number;
  trust: number;
  interactions: number;
  lastInteraction: Date;
}

// ============================================================================
// TOOL TYPES
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, any>; // JSONSchema
  handler: (input: Record<string, any>) => Promise<any>;
}

export interface ToolResult {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

// ============================================================================
// PROMPT TYPES
// ============================================================================

export type PromptTemplate = string | ((input: Record<string, any>) => string);

export interface PromptDefinition {
  name: string;
  template: PromptTemplate;
  variables: string[];
  model?: string;
  temperature?: number;
}

export interface PromptResult {
  prompt: string;
  model: string;
  temperature: number;
}

// ============================================================================
// LLM TYPES
// ============================================================================

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokens: {
    input: number;
    output: number;
  };
  stopReason: string;
}

// ============================================================================
// ORCHESTRATION TYPES
// ============================================================================

export interface AgentCycleConfig {
  maxConcurrent: number;
  batchSize: number;
  timeout: number;
  retries: number;
}

export interface AgentCycleResult {
  agentId: string;
  success: boolean;
  duration: number;
  actionsExecuted: number;
  memory: string;
  error?: string;
}

// ============================================================================
// VECTOR STORE TYPES
// ============================================================================

export interface VectorStoreConfig {
  provider: "supabase" | "pinecone" | "weaviate";
  tableName: string;
  dimensions: number;
  similarityThreshold: number;
}

export interface VectorSearchQuery {
  embedding: number[];
  limit: number;
  threshold?: number;
  filters?: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, any>;
  content?: string;
}

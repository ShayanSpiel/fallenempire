/**
 * UNIFIED WORKFLOW SYSTEM - Core Types
 * Central types for Observe > Reason > Act > Loop pattern
 */

import type { IdentityVector, MemoryRecord } from "../types";

// ============================================================================
// SCOPE TYPES
// ============================================================================

export type TriggerType = "event" | "schedule";
export type EventType =
  | "chat"
  | "comment"
  | "mention"
  | "post"
  | "law_proposal"
  | "battle"
  | "relationship_change";
export type ScheduleType =
  | "agent_cycle"
  | "relationship_sync"
  | "memory_cleanup"
  | "token_reset";

export interface WorkflowTrigger {
  type: TriggerType;
  event?: EventType;
  schedule?: ScheduleType;
  timestamp: Date;
  isResponse?: boolean; // For loop detection - is this a response to previous action?
}

export interface Actor {
  id: string;
  type: "agent" | "user";
  profile?: Record<string, any>;
}

export interface Subject {
  id: string;
  type: "post" | "comment" | "community" | "user" | "proposal" | "battle";
  data?: Record<string, any>;
}

export interface DataScopeConfig {
  posts?: {
    filter: "all" | "following" | "community" | "personal";
    limit: number;
  };
  messages?: {
    conversationId: string;
    limit: number;
  };
  memories?: {
    userId: string;
    relevant: boolean;
    limit?: number;
  };
  relationships?: {
    userId: string;
  };
  communities?: {
    filter: "joined" | "suggested" | "all";
    limit: number;
  };
  battleData?: {
    filter: "involved" | "community" | "recent";
    limit: number;
  };
}

export interface SocialGraphScope {
  following?: boolean;
  followers?: boolean;
  communityIds?: string[];
  alliedCommunities?: boolean;
  enemyCommunities?: boolean;
}

export interface WorkflowScope {
  // WHO triggered this?
  trigger: WorkflowTrigger;

  // WHO is performing the action?
  actor: Actor;

  // WHAT is the target/subject?
  subject?: Subject;

  // WHAT data is visible?
  dataScope: DataScopeConfig;

  // WHERE in the social graph?
  socialGraph?: SocialGraphScope;

  // CONTEXT
  conversationId?: string;
  contextData?: Record<string, any>;
}

// ============================================================================
// LOOP TYPES
// ============================================================================

export type LoopContinueReason =
  | "goal_achieved"
  | "goal_not_met"
  | "new_info"
  | "tool_failure"
  | "low_confidence"
  | "user_persistence";

export interface LoopHistory {
  iteration: number;
  observation: WorkflowObservation | null;
  reasoning: WorkflowReasoning | null;
  action: WorkflowAction | null;
  result: WorkflowResult | null;
  timestamp: Date;
}

export interface LoopState {
  iteration: number;
  maxIterations: number;
  history: LoopHistory[];
  shouldContinue: boolean;
  continueReason?: LoopContinueReason;
  heatCostPerIteration: number; // Cost to execute another loop
}

// ============================================================================
// WORKFLOW STATE & STEPS
// ============================================================================

export interface WorkflowObservation {
  posts: any[];
  messages: any[];
  memories: MemoryRecord[];
  relationships: Record<string, any>;
  communities: any[];
  battleData?: any[];
  contextSummary: string;
  timestamp: Date;
}

export interface LLMToolCall {
  id: string;
  function: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface LLMToolResult {
  tool_call_id: string;
  content: string;
}

export interface WorkflowReasoning {
  observation: string; // What did I observe?
  thinkingProcess: string; // How am I reasoning about this?
  toolCalls: LLMToolCall[]; // Tools I need to call
  toolResults: LLMToolResult[]; // Results from tools
  decision: string; // What should I do?
  confidence: number; // 0-1 confidence in decision
  alternativeOptions: string[];
  factors: Record<string, number>; // Weighted factors in decision
  explanation: string; // Why this decision?
}

export interface WorkflowAction {
  type: string; // REPLY, LIKE, COMMENT, FOLLOW, JOIN_COMMUNITY, ATTACK, etc.
  target?: string; // Target entity ID
  content?: string; // Action content (for posts/comments)
  metadata: Record<string, any>;
  goalAchieved?: boolean; // Did this action achieve the goal?
}

export interface WorkflowResult {
  success: boolean;
  actionId?: string;
  error?: string;
  heatCost: number;
  coherenceImpact: number;
  executionTime: number;
}

export interface WorkflowState {
  // Scope & Trigger
  scope: WorkflowScope;

  // Actor state
  actorIdentity?: IdentityVector;
  actorMorale?: number;
  actorCoherence?: number;
  actorHeat?: number;
  actorRage?: number;
  actorCommunityId?: string | null;

  // Current step
  step: "observe" | "reason" | "act" | "loop_check" | "complete";

  // Step results
  observation?: WorkflowObservation;
  reasoning?: WorkflowReasoning;
  action?: WorkflowAction;
  result?: WorkflowResult;

  // Loop tracking
  loop: LoopState;

  // Global state
  startTime: Date;
  executedActions: string[]; // Track all actions executed in this workflow
  errors: Array<{ step: string; error: string; timestamp: Date }>;
  metadata: Record<string, any>;
}

// ============================================================================
// NODE TYPES
// ============================================================================

export type WorkflowNode = "observe" | "reason" | "act" | "loop";

export interface WorkflowNodeHandler {
  name: WorkflowNode;
  execute(state: WorkflowState): Promise<Partial<WorkflowState>>;
}

// ============================================================================
// TOOL TYPES (LLM NATIVE FUNCTION CALLING)
// ============================================================================

export interface LLMFunction {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required: string[];
    };
  };
}

// ============================================================================
// TOOL CONTEXT (Replaces WorkflowScope for tools)
// ============================================================================

export interface ToolExecutionContext {
  agentId: string;
  triggerId?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

export interface ToolDefinitionV2 {
  name: string;
  category: "data" | "action" | "reasoning";
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
  handler: (input: Record<string, any>, context: ToolExecutionContext) => Promise<any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

// ============================================================================
// ORCHESTRATOR TYPES
// ============================================================================

export interface WorkflowOrchestratorConfig {
  maxIterations: number;
  heatCostPerIteration: number;
  enableLooping: boolean;
  enableToolCalling: boolean;
  toolExecutionTimeout: number;
  maxToolCallsPerReasoning: number;
}

export interface WorkflowExecutionResult {
  success: boolean;
  state: WorkflowState;
  duration: number;
  executedActions: string[];
  errors: string[];
}

// ============================================================================
// TRIGGER REGISTRY TYPES
// ============================================================================

export interface ScopeBuilder {
  buildScope(context: Record<string, any>): Promise<WorkflowScope>;
}

export interface TriggerHandler {
  trigger: TriggerType;
  event?: EventType;
  schedule?: ScheduleType;
  scopeBuilder: ScopeBuilder;
  handler?: (context: Record<string, any>) => Promise<void>;
}

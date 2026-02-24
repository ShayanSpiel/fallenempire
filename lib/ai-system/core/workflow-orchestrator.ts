/**
 * WORKFLOW ORCHESTRATOR
 * Central engine that coordinates all workflow nodes
 * Implements Observe > Reason > Act > Loop pattern
 */

import type {
  WorkflowState,
  WorkflowScope,
  WorkflowOrchestratorConfig,
  WorkflowExecutionResult,
} from "./types";
import { observeNode } from "../nodes/observe";
import { reasonNode } from "../nodes/reason";
import { actNode } from "../nodes/act";
import { loopNode } from "../nodes/loop";
import {
  startWorkflowTrace,
  endWorkflowTrace,
  traceWorkflowExecution,
  traceWorkflowError,
  logTracingConfig,
  isLangSmithEnabled,
  withLangSmithTraceContext,
} from "../tracing/langsmith";
import { debug, info } from "../../logger";

// ============================================================================
// WORKFLOW ORCHESTRATOR
// ============================================================================

export class WorkflowOrchestrator {
  private config: WorkflowOrchestratorConfig;

  constructor(config: Partial<WorkflowOrchestratorConfig> = {}) {
    this.config = {
      maxIterations: config.maxIterations || 3,
      heatCostPerIteration: config.heatCostPerIteration || 5,
      enableLooping: config.enableLooping !== false,
      enableToolCalling: config.enableToolCalling !== false,
      toolExecutionTimeout: config.toolExecutionTimeout || 30000,
      maxToolCallsPerReasoning: config.maxToolCallsPerReasoning || 5,
    };
  }

  /**
   * Execute workflow starting from scope
   */
  async execute(scope: WorkflowScope): Promise<WorkflowExecutionResult> {
    return await withLangSmithTraceContext(async () => {
      const startTime = Date.now();
      const traceId = await startWorkflowTrace(scope);

      // Initialize workflow state
      let state = this.initializeState(scope);

      debug(
        "Orchestrator",
        `Starting workflow for ${scope.trigger.type}:${scope.trigger.event || scope.trigger.schedule}`
      );
      debug("Orchestrator", `Scope:\n${getScopeSummary(scope)}`);

      // Execute workflow loop
      while (state.step !== "complete") {
        try {
          state = await this.executeStep(state, traceId);
        } catch (error: any) {
          debug("Orchestrator", `Error in step ${state.step}:`, error);
          if (traceId) traceWorkflowError(traceId, state.step, error.message);
          state = {
            ...state,
            step: "complete",
            errors: [
              ...state.errors,
              {
                step: state.step,
                error: error.message,
                timestamp: new Date(),
              },
            ],
          };
        }

        // Safety check
        if (!state.step || state.step === "complete") {
          break;
        }
      }

      const duration = Date.now() - startTime;
      const result: WorkflowExecutionResult = {
        success: state.errors.length === 0,
        state,
        duration,
        executedActions: state.executedActions,
        errors: state.errors.map((e) => e.error),
      };

      // End trace with final metrics
      endWorkflowTrace(traceId, result.success, duration, state.executedActions.length);

      // Log final execution metrics
      if (traceId) {
        traceWorkflowExecution(traceId, {
          scope,
          result,
          config: this.config,
        });
      }

      debug("Orchestrator", `Workflow completed in ${result.duration}ms`);
      debug("Orchestrator", `Executed ${state.executedActions.length} actions`);
      if (result.errors.length > 0) {
        debug("Orchestrator", `Errors: ${result.errors.join(", ")}`);
      }

      return result;
    });
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(state: WorkflowState, traceId: string | null): Promise<WorkflowState> {
    const stepStartTime = Date.now();

    debug("Step", `Executing: ${state.step} (iteration ${state.loop.iteration}/${state.loop.maxIterations})`);

    let stepUpdate: Partial<WorkflowState>;

    switch (state.step) {
      case "observe":
        stepUpdate = await observeNode(state);
        break;

      case "reason":
        stepUpdate = await reasonNode(state);
        break;

      case "act":
        stepUpdate = await actNode(state);
        break;

      case "loop_check":
        stepUpdate = await loopNode(state);
        break;

      default:
        throw new Error(`Unknown step: ${state.step}`);
    }

    const duration = Date.now() - stepStartTime;
    debug("Step", `${state.step} completed in ${duration}ms`);

    // Merge step update into state
    return {
      ...state,
      ...stepUpdate,
    };
  }

  /**
   * Initialize workflow state from scope
   */
  private initializeState(scope: WorkflowScope): WorkflowState {
    return {
      scope,
      step: "observe",
      loop: {
        iteration: 1,
        maxIterations: this.config.maxIterations,
        history: [],
        shouldContinue: true,
        heatCostPerIteration: this.config.heatCostPerIteration,
      },
      executedActions: [],
      errors: [],
      startTime: new Date(),
      metadata: {
        config: this.config,
        orchestratorVersion: "2.0",
      },
    };
  }
}

/**
 * Create a new orchestrator
 */
export function createOrchestrator(
  config?: Partial<WorkflowOrchestratorConfig>
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(config);
}

/**
 * Simple helper to execute workflow immediately
 */
export async function executeWorkflow(
  scope: WorkflowScope,
  config?: Partial<WorkflowOrchestratorConfig>
): Promise<WorkflowExecutionResult> {
  const orchestrator = createOrchestrator(config);
  return orchestrator.execute(scope);
}

/**
 * Get scope summary for logging
 */
function getScopeSummary(scope: WorkflowScope): string {
  const lines = [
    `Trigger: ${scope.trigger.type}:${scope.trigger.event || scope.trigger.schedule}`,
    `Actor: ${scope.actor.type} ${scope.actor.id}`,
    `Subject: ${scope.subject?.type || "none"} ${scope.subject?.id || ""}`,
    `Data Scope: ${Object.keys(scope.dataScope)
      .filter((k) => scope.dataScope[k as keyof typeof scope.dataScope])
      .join(", ")}`,
  ];

  return lines.join("\n");
}

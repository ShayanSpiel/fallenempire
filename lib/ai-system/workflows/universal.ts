/**
 * UNIVERSAL WORKFLOW
 * ONE workflow that handles ALL trigger types and scenarios
 * Observe → Reason → Act → Loop pattern with tool-augmented reasoning
 */

import type { WorkflowState } from "../core/types";
import { observeNode } from "../nodes/observe";
import { reasonNode } from "../nodes/reason";
import { actNode } from "../nodes/act";
import { loopNode } from "../nodes/loop";
import { startWorkflowTrace, endWorkflowTrace, withLangSmithTraceContext } from "../tracing/langsmith";

/**
 * Execute universal workflow
 * This single workflow handles:
 * - Chat messages (DMs, group chats, mentions)
 * - Battle events (started, ending, attacks)
 * - Schedule events (market checks, maintenance, community activities)
 * - Governance events (proposals, votes)
 * - Any other trigger type!
 */
export async function executeUniversalWorkflow(state: WorkflowState): Promise<WorkflowState> {
  return await withLangSmithTraceContext(async () => {
    console.log(
      `[UniversalWorkflow] Starting workflow for ${state.scope.trigger.type}:${state.scope.trigger.event || state.scope.trigger.schedule}`
    );
    console.log(`[UniversalWorkflow] Agent: ${state.scope.actor.id}`);

    // Start LangSmith trace (root run)
    const traceId = await startWorkflowTrace(state.scope);

    let currentState = state;

    // Main workflow loop
    let loopCount = 0;
    const maxLoopSafety = 50; // Hard limit to prevent infinite loops

    while (currentState.step !== "complete" && loopCount < maxLoopSafety) {
      loopCount++;
      console.log(
        `[UniversalWorkflow] Step: ${currentState.step}, Iteration: ${currentState.loop.iteration}, Loop: ${loopCount}`
      );

      try {
        let nextState: Partial<WorkflowState>;

        switch (currentState.step) {
          case "observe":
            nextState = await observeNode(currentState);
            break;

          case "reason":
            nextState = await reasonNode(currentState);
            break;

          case "act":
            nextState = await actNode(currentState);
            break;

          case "loop_check":
            nextState = await loopNode(currentState);
            break;

          default:
            console.error(`[UniversalWorkflow] Unknown step: ${currentState.step}`);
            nextState = { step: "complete" };
        }

        // Merge next state with current state
        currentState = {
          ...currentState,
          ...nextState,
        };

        // Safety: prevent infinite loops
        if (currentState.loop.iteration > currentState.loop.maxIterations + 1) {
          console.error(`[UniversalWorkflow] Emergency stop: exceeded max iterations`);
          currentState.step = "complete";
          currentState.errors.push({
            step: "workflow",
            error: "Exceeded maximum iterations",
            timestamp: new Date(),
          });
        }
      } catch (error: any) {
        console.error(`[UniversalWorkflow] Error in step ${currentState.step}:`, error);
        currentState.step = "complete";
        currentState.errors.push({
          step: currentState.step,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }

    // Check if we hit the safety limit
    if (loopCount >= maxLoopSafety) {
      console.error(`[UniversalWorkflow] SAFETY STOP: Hit maximum loop count (${maxLoopSafety})`);
      currentState.step = "complete";
      currentState.errors.push({
        step: "workflow",
        error: `Safety stop: exceeded ${maxLoopSafety} workflow loops`,
        timestamp: new Date(),
      });
    }

    console.log(`[UniversalWorkflow] Workflow complete (${loopCount} loops)`);
    console.log(`[UniversalWorkflow] Total iterations: ${currentState.loop.iteration}`);
    console.log(`[UniversalWorkflow] Actions executed: ${currentState.executedActions.join(", ")}`);
    console.log(`[UniversalWorkflow] Errors: ${currentState.errors.length}`);

    // End LangSmith trace with summary
    const duration = Date.now() - currentState.startTime.getTime();
    endWorkflowTrace(traceId, currentState.errors.length === 0, duration, currentState.executedActions.length, {
      totalIterations: currentState.loop.iteration,
      finalAction: currentState.executedActions[currentState.executedActions.length - 1],
      errorCount: currentState.errors.length,
      actionsList: currentState.executedActions,
    });

    return currentState;
  });
}

/**
 * Create initial workflow state from trigger
 */
export function createInitialState(scope: any): WorkflowState {
  return {
    scope,
    step: "observe",
    startTime: new Date(),
    executedActions: [],
    errors: [],
    metadata: {},
    loop: {
      iteration: 1,
      maxIterations: 10, // Allow up to 10 iterations for complex multi-step workflows
      history: [],
      shouldContinue: true,
      heatCostPerIteration: 2,
    },
  };
}

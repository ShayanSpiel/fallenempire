/**
 * LOOP NODE - Multi-Step Plan Management
 * Controls workflow iteration and decides whether to continue
 * Handles multi-step plans, error recovery, and goal achievement
 */

import type { WorkflowState, LoopContinueReason } from "../core/types";
import { getTool } from "../tools/registry";
import { startNodeTrace, endNodeTrace } from "../tracing/langsmith";

export async function loopNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const nodeTraceId = await startNodeTrace("loop", state);

  // Check if should continue looping
  const shouldContinue = checkLoopCondition(state);

  console.log(`[Loop] Iteration ${state.loop.iteration}/${state.loop.maxIterations}`);
  console.log(`[Loop] Continue: ${shouldContinue.continue}, Reason: ${shouldContinue.reason}`);

  if (shouldContinue.continue) {
    const nextIteration = state.loop.iteration + 1;

    console.log(`[Loop] Continuing to iteration ${nextIteration}`);
    console.log(`[Loop] Reason: ${shouldContinue.reason}`);

    // Add loop history entry
    const historyEntry = {
      iteration: state.loop.iteration,
      observation: state.observation || null,
      reasoning: state.reasoning || null,
      action: state.action || null,
      result: state.result || null,
      timestamp: new Date(),
    };

    // Check if we have a plan with remaining steps
    const plan = state.action?.metadata?.plan || [];
    const currentStepIndex = state.loop.iteration - 1; // Step executed this iteration (0-indexed)
    const nextStepIndex = currentStepIndex + 1;
    const nextStep = Array.isArray(plan) ? plan[nextStepIndex] : undefined;
    const canExecuteNextStep = Boolean(nextStep && isExecutableActionStep(nextStep));

    if (nextStep) {
      console.log(`[Loop] Executing next plan step ${nextStepIndex + 1}/${plan.length}: ${nextStep.tool}`);
    }

    // End node trace - continuing to next iteration
    endNodeTrace(nodeTraceId, {
      continue: true,
      reason: shouldContinue.reason,
      next_iteration: nextIteration,
      next_step: shouldContinue.reason === "tool_failure" ? "reason" :
                 (shouldContinue.reason === "new_info" && canExecuteNextStep ? "act" : "observe"),
      has_next_plan_step: !!nextStep,
    });

    return {
      step:
        shouldContinue.reason === "tool_failure"
          ? "reason"
          : shouldContinue.reason === "new_info" && canExecuteNextStep
            ? "act"
            : "observe",
      loop: {
        ...state.loop,
        iteration: nextIteration,
        history: [...state.loop.history, historyEntry],
        continueReason: shouldContinue.reason,
        shouldContinue: true,
      },
      // Reset for next iteration (but keep plan). If we have a concrete next plan step,
      // execute it directly without another Observe/Reason cycle to avoid extra LLM tokens.
      // IMPORTANT: Preserve observation on tool_failure so AI can retry with context!
      observation: (shouldContinue.reason === "new_info" && nextStep) || shouldContinue.reason === "tool_failure"
        ? state.observation
        : undefined,
      reasoning:
        shouldContinue.reason === "new_info" && canExecuteNextStep
          ? {
              observation: state.observation?.contextSummary || "No observation",
              thinkingProcess: "Following multi-step plan (no re-reasoning needed).",
              toolCalls: [],
              toolResults: [],
              decision: nextStep.tool,
              confidence: state.reasoning?.confidence ?? 0.7,
              alternativeOptions: [],
              factors: {},
              explanation: `Executing planned step ${nextStepIndex + 1}/${plan.length}: ${nextStep.description || nextStep.tool}`,
            }
          : undefined,
      action:
        shouldContinue.reason === "new_info" && canExecuteNextStep
          ? buildActionFromPlanStep(state, nextStep, plan)
          : state.action
            ? {
                ...state.action,
                metadata: {
                  ...state.action.metadata,
                  currentPlanStep: nextStepIndex + 1,
                },
              }
            : undefined,
      result: undefined,
      metadata: {
        ...state.metadata,
        lastLoopReason: shouldContinue.reason,
        loopIterationStartTime: Date.now(),
        nextPlanStep: nextStep,
      },
    };
  } else {
    // No more iterations, complete workflow
    console.log(`[Loop] Workflow complete. Reason: ${shouldContinue.reason}`);

    // End node trace - workflow complete
    endNodeTrace(nodeTraceId, {
      continue: false,
      reason: shouldContinue.reason,
      total_iterations: state.loop.iteration,
      goal_achieved: state.action?.goalAchieved || false,
    });

    const historyEntry = {
      iteration: state.loop.iteration,
      observation: state.observation || null,
      reasoning: state.reasoning || null,
      action: state.action || null,
      result: state.result || null,
      timestamp: new Date(),
    };

    return {
      step: "complete",
      loop: {
        ...state.loop,
        history: [...state.loop.history, historyEntry],
        shouldContinue: false,
        continueReason: shouldContinue.reason,
      },
      metadata: {
        ...state.metadata,
        completionReason: shouldContinue.reason,
        totalIterations: state.loop.iteration,
        finalGoalAchieved: state.action?.goalAchieved || false,
      },
    };
  }
}

/**
 * Check if workflow should continue looping
 */
function checkLoopCondition(
  state: WorkflowState
): { continue: boolean; reason: LoopContinueReason } {
  // 1. Check max iterations
  if (state.loop.iteration >= state.loop.maxIterations) {
    console.log(`[Loop] Max iterations reached (${state.loop.maxIterations})`);
    return { continue: false, reason: "goal_not_met" };
  }

  // 2. Check heat threshold (agent needs cooldown)
  if ((state.actorHeat || 0) >= 80) {
    console.log(`[Loop] Heat too high (${state.actorHeat}), agent needs cooldown`);
    return { continue: false, reason: "goal_not_met" };
  }

  // 3. Check if goal achieved
  console.log(`[Loop] Checking goal achieved: ${state.action?.goalAchieved}`);
  if (state.action?.goalAchieved === true) {
    console.log(`[Loop] Goal achieved!`);
    return { continue: false, reason: "goal_achieved" };
  }

  // 4. Check for multi-step plan
  const plan = state.action?.metadata?.plan || [];
  const hasMorePlanSteps =
    Array.isArray(plan) && plan.length > 0 && state.loop.iteration < plan.length;

  if (hasMorePlanSteps) {
    console.log(`[Loop] Multi-step plan detected. Step ${state.loop.iteration}/${plan.length}`);
    return { continue: true, reason: "new_info" };
  }

  // 5. Check if action failed
  if (state.result && !state.result.success) {
    console.log(`[Loop] Action failed: ${state.result.error}`);

    // If we can retry, continue
    if (state.loop.iteration < state.loop.maxIterations) {
      return { continue: true, reason: "tool_failure" };
    }

    return { continue: false, reason: "tool_failure" };
  }

  // 6. Check low confidence (might need more reasoning)
  if ((state.reasoning?.confidence || 0) < 0.4) {
    console.log(`[Loop] Low confidence (${state.reasoning?.confidence})`);

    if (state.loop.iteration < state.loop.maxIterations) {
      return { continue: true, reason: "low_confidence" };
    }
  }

  // 7. Check for user persistence (escalating rejections)
  if (state.scope.trigger.isResponse && state.action?.type === "decline") {
    console.log(`[Loop] User persisted after decline, escalating`);

    if (state.loop.iteration < state.loop.maxIterations) {
      return { continue: true, reason: "user_persistence" };
    }
  }

  // 8. Default: goal achieved or no reason to continue
  console.log(`[Loop] No reason to continue. Completing workflow.`);
  console.log(`[Loop] Final state check - goalAchieved: ${state.action?.goalAchieved}, result: ${state.result?.success}, plan: ${state.action?.metadata?.plan?.length || 0}`);
  return { continue: false, reason: "goal_not_met" };
}

function buildActionFromPlanStep(state: WorkflowState, planStep: any, fullPlan: any[]): any {
  const toolName = String(planStep?.tool || "");
  const args = (planStep?.args || {}) as Record<string, any>;

  // Only execute plan steps that are valid ACTION tools; otherwise force replanning.
  const tool = getTool(toolName);
  if (!tool || tool.category !== "action") {
    return state.action;
  }

  return {
    type: toolName,
    target: args.userId || args.user_id || args.postId || args.post_id || args.battleId || args.battle_id || args.communityId || args.community_id,
    content: args.content || args.message,
    metadata: {
      ...(state.action?.metadata || {}),
      args,
      plan: fullPlan,
    },
    goalAchieved: false,
  };
}

function isExecutableActionStep(planStep: any): boolean {
  const toolName = String(planStep?.tool || "");
  if (!toolName) return false;
  const tool = getTool(toolName);
  return Boolean(tool && tool.category === "action");
}

/**
 * EXAMPLE WORKFLOWS
 *
 * Example 1: Multi-Step Resource Management
 * ==========================================
 * Trigger: Schedule - market check
 * Iteration 1:
 *   Observe: Minimal context
 *   Reason: "Health low, need food. Plan: [buy_item, consume_item]"
 *   Act: buy_item("food", 10) → FAILED (insufficient gold)
 *   Loop: Action failed → continue with replanning
 *
 * Iteration 2:
 *   Observe: Re-observe
 *   Reason: "Buy failed. Need gold first. Plan: [do_work, buy_item, consume_item]"
 *   Act: do_work("mining") → SUCCESS (earned 50 gold)
 *   Loop: Plan has more steps (2 remaining) → continue
 *
 * Iteration 3:
 *   Observe: Skip (plan execution)
 *   Reason: Execute next plan step
 *   Act: buy_item("food", 10) → SUCCESS
 *   Loop: Plan has more steps (1 remaining) → continue
 *
 * Iteration 4:
 *   Observe: Skip (plan execution)
 *   Reason: Execute next plan step
 *   Act: consume_item("food", 10) → SUCCESS
 *   Loop: Plan complete, goal achieved → STOP
 *
 * Example 2: Battle with Context Memory
 * ======================================
 * Trigger: Message - "Fight in battle_123!"
 * Iteration 1:
 *   Observe: Minimal context (message from leader)
 *   Reason: Tools called: [get_battle_details, check_relationship, get_my_stats]
 *           "Leader I trust, battle vs enemy, but low energy. Plan: [consume_item, join_battle, reply]"
 *   Act: consume_item("food", 5) → FAILED (no food in inventory)
 *   Loop: Action failed → continue with replanning
 *
 * Iteration 2:
 *   Observe: Re-observe
 *   Reason: "No food. Need to buy first. Plan: [buy_item, consume_item, join_battle, reply]"
 *   Act: buy_item("food", 5) → SUCCESS
 *   Loop: Plan has 3 more steps → continue
 *
 * Iteration 3:
 *   Act: consume_item("food", 5) → SUCCESS
 *   Loop: Plan has 2 more steps → continue
 *
 * Iteration 4:
 *   Act: join_battle(123, 80) → SUCCESS
 *   Loop: Plan has 1 more step → continue
 *
 * Iteration 5:
 *   Act: reply(conversationId, "DONE! Crushed them!") → SUCCESS
 *   Loop: Plan complete → STOP
 *
 * Example 3: Escalating Rejection
 * ================================
 * Trigger: Message - "Join my community"
 * Iteration 1:
 *   Observe: Minimal context
 *   Reason: Tools: [get_user_profile, check_relationship, check_coherence]
 *           "Enemy with bad history and incompatible ideology. Decline level 1."
 *   Act: send_message(userId, "No thanks") → SUCCESS
 *   Loop: Decline action, but might get response → continue (user_persistence check)
 *
 * [New message arrives: "Come on, it'll be fun!"]
 * Trigger marked as isResponse=true
 *
 * Iteration 2:
 *   Observe: New message detected
 *   Reason: "User persisted. Escalate to level 2."
 *   Act: send_message(userId, "I don't like you. Fuck off.") → SUCCESS
 *   Loop: Escalation, check for more persistence
 *
 * [New message: "Why are you being rude?"]
 *
 * Iteration 3 (MAX):
 *   Observe: Another persistence
 *   Reason: Tools: [search_memories("user")]
 *           "Final escalation with detailed reasoning from memory."
 *   Act: send_message(userId, "You attacked us before, hypocrite. Bye.") → SUCCESS
 *   Loop: Max iterations reached → STOP
 */

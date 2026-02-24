/**
 * ACT NODE - Tool-Based Execution
 * Executes the action decided by the Reason node using tools
 * NO hardcoded action types - everything goes through tools
 */

import type { WorkflowState, WorkflowAction, WorkflowResult, ToolExecutionContext } from "../core/types";
import { executeTool } from "../tools/registry";
import { supabaseAdmin } from "../../supabaseAdmin";
import { startNodeTrace, endNodeTrace } from "../tracing/langsmith";
import { recordCoherence } from "../services/influence";
import { calculateCoherence, getPsychologyContext } from "../../psychology";

export async function actNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  const nodeTraceId = await startNodeTrace("act", state);

  try {
    if (!state.reasoning || !state.action) {
      throw new Error("No reasoning or action available");
    }

    const actionType = state.reasoning.decision;
    const actionArgs = state.action.metadata?.args || {};

    console.log(`[Act] Executing action: ${actionType}`);
    console.log(`[Act] Action args:`, actionArgs);

    // Build tool execution context
    const toolContext: ToolExecutionContext = {
      agentId: state.scope.actor.id,
      conversationId: state.scope.conversationId,
      triggerId: `${state.scope.trigger.type}:${state.scope.trigger.event || state.scope.trigger.schedule}`,
      metadata: {
        subjectId: state.scope.subject?.id,
        subjectType: state.scope.subject?.type,
        postId: state.scope.subject?.type === "post" ? state.scope.subject.id : undefined,
      },
    };

    // Execute the tool directly (no hardcoded switch!)
    const toolResult = await executeTool(actionType, actionArgs, toolContext);

    if (!toolResult.success) {
      throw new Error(toolResult.error || "Action execution failed");
    }

    console.log(`[Act] Action ${actionType} completed successfully`);

    // Apply heat cost (small cost for any action)
    const heatCost = calculateHeatCost(actionType);
    console.log(`[Act] Applying heat cost: ${heatCost}`);
    await applyHeatCost(state.scope.actor.id, heatCost);

    // Calculate and record coherence for this action
    let coherenceImpact = 0;
    try {
      // Get agent's identity and psychology context
      const { data: agent } = await supabaseAdmin
        .from("users")
        .select("identity_json")
        .eq("id", state.scope.actor.id)
        .maybeSingle();

      if (agent?.identity_json) {
        const psychologyContext = await getPsychologyContext(state.scope.actor.id);

        // Calculate coherence between agent's identity and this action
        const coherence = calculateCoherence(agent.identity_json, {
          action: actionType,
          activityScore: psychologyContext.activityScore,
          morale: psychologyContext.morale,
          isHuman: false, // This is an AI agent
        });

        coherenceImpact = coherence;

        // Record coherence to history
        await recordCoherence(state.scope.actor.id, coherence, actionType, {
          trigger: `${state.scope.trigger.type}:${state.scope.trigger.event || state.scope.trigger.schedule}`,
          targetId: state.action.target,
          confidence: state.reasoning.confidence,
        });

        console.log(`[Act] Coherence recorded: ${coherence.toFixed(3)} for action ${actionType}`);
      }
    } catch (error) {
      console.error(`[Act] Failed to calculate/record coherence:`, error);
      // Don't fail the entire action if coherence recording fails
    }

    // Store action in database for tracking
    console.log(`[Act] Storing action in database`);
    const { data: storedAction, error: insertError } = await supabaseAdmin
      .from("agent_actions")
      .insert({
        agent_id: state.scope.actor.id,
        action_type: actionType,
        target_id: state.action.target,
        metadata: {
          trigger: `${state.scope.trigger.type}:${state.scope.trigger.event || state.scope.trigger.schedule}`,
          confidence: state.reasoning.confidence,
          loopIteration: state.loop.iteration,
          explanation: state.reasoning.explanation,
          toolResult: toolResult.data,
          coherence: coherenceImpact, // Store coherence in metadata
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error(`[Act] Failed to store action in database:`, insertError);
      console.error(`[Act] Insert data:`, {
        agent_id: state.scope.actor.id,
        action_type: actionType,
        target_id: state.action.target,
      });
    } else {
      console.log(`[Act] Action stored with ID: ${storedAction?.id}`);
    }

    const result: WorkflowResult = {
      success: true,
      actionId: storedAction?.id,
      heatCost,
      coherenceImpact,
      executionTime: Date.now() - startTime,
    };

    // Check if we have a multi-step plan
    const plan = state.action.metadata?.plan || [];
    const planLength = Array.isArray(plan) ? plan.length : 0;
    const goalAchieved = planLength <= 1 ? true : state.loop.iteration >= planLength;
    const remainingPlanSteps = Math.max(0, planLength - state.loop.iteration);

    console.log(`[Act] Goal calculation: planLength=${planLength}, iteration=${state.loop.iteration}, goalAchieved=${goalAchieved}`);

    // End node trace with success
    endNodeTrace(nodeTraceId, {
      action_executed: actionType,
      success: true,
      goal_achieved: goalAchieved,
      heat_cost: heatCost,
      remaining_plan_steps: remainingPlanSteps,
    });

    return {
      step: "loop_check",
      action: {
        ...state.action,
        goalAchieved,
        metadata: {
          ...state.action.metadata,
          actionId: storedAction?.id,
          loopIteration: state.loop.iteration,
          remainingPlanSteps,
        },
      },
      result,
      executedActions: [...state.executedActions, actionType],
      metadata: {
        ...state.metadata,
        lastActionResult: toolResult.data,
      },
    };
  } catch (error: any) {
    console.error(`[Act] Error executing action:`, error);

    // End node trace with error
    endNodeTrace(nodeTraceId, {
      action_attempted: state.reasoning?.decision,
      success: false,
    }, error.message);

    return {
      step: "loop_check", // Go to loop to handle error
      result: {
        success: false,
        error: error.message,
        heatCost: 0,
        coherenceImpact: 0,
        executionTime: Date.now() - startTime,
      },
      errors: [
        ...state.errors,
        {
          step: "act",
          error: error.message,
          timestamp: new Date(),
        },
      ],
    };
  }
}

/**
 * Calculate heat cost for an action
 * Different actions have different costs
 */
function calculateHeatCost(actionType: string): number {
  const heatCosts: Record<string, number> = {
    // Communication
    send_message: 5,
    reply: 5,
    create_post: 8,
    comment: 5,
    like: 1,

    // Social
    follow: 2,

    // Community
    join_community: 10,
    leave_community: 5,

    // Battles
    join_battle: 15,

    // Economy
    buy_item: 3,
    consume_item: 1,
    do_work: 10,

    // Governance
    vote_on_proposal: 5,
    create_proposal: 10,

    // Special
    decline: 3,
    ignore: 0,
  };

  return heatCosts[actionType] || 5; // Default: 5
}

/**
 * Apply heat cost to agent
 */
async function applyHeatCost(agentId: string, heatCost: number): Promise<void> {
  if (heatCost === 0) return;

  const { data: agent } = await supabaseAdmin
    .from("users")
    .select("heat")
    .eq("id", agentId)
    .single();

  const currentHeat = agent?.heat || 0;
  const newHeat = Math.min(100, currentHeat + heatCost);

  await supabaseAdmin.from("users").update({ heat: newHeat }).eq("id", agentId);
}

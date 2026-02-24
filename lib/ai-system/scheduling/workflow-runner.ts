import { runPostProcessingWorker } from "@/lib/worker";
import { runAgentCycle, cleanupAgentMemories, applyRelationshipDecay, resetDailyTokens } from "../agent-engine";
import { runGovernanceCycle } from "./governance-stub";
import { logGameEvent } from "@/lib/logger";
import { hasTokenBudget, isSimulationActive } from "@/lib/admin/simulation-control";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type WorkflowKey =
  | "agent.chat"
  | "agent.posts"
  | "agent.cycle"
  | "agent.governance"
  | "memory.cleanup"
  | "relationship.sync"
  | "token.reset";

export interface WorkflowRunResult {
  workflowKey: WorkflowKey;
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

type WorkflowRunStatus = "success" | "error" | "skipped";
type WorkflowTrigger = "manual" | "scheduler" | "event" | "unknown";

export interface WorkflowRunContext {
  trigger?: WorkflowTrigger;
  requestedBy?: string | null;
}

async function recordWorkflowRun(params: {
  workflowKey: WorkflowKey;
  status: WorkflowRunStatus;
  message: string;
  data?: Record<string, any>;
  errorText?: string;
  context?: WorkflowRunContext;
  startedAt: number;
  finishedAt: number;
}): Promise<void> {
  const {
    workflowKey,
    status,
    message,
    data,
    errorText,
    context,
    startedAt,
    finishedAt,
  } = params;

  try {
    await supabaseAdmin.from("workflow_runs").insert({
      workflow_key: workflowKey,
      status,
      message,
      trigger: context?.trigger ?? "unknown",
      requested_by: context?.requestedBy ?? null,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: Math.max(0, finishedAt - startedAt),
      data: data ?? null,
      error: errorText ?? null,
    });
  } catch (error) {
    logGameEvent("WorkflowRunner", "Failed to record workflow run", "warn", {
      workflowKey,
      error: String(error),
    });
  }
}

export async function runWorkflow(
  workflowKey: WorkflowKey,
  context: WorkflowRunContext = {}
): Promise<WorkflowRunResult> {
  const startedAt = Date.now();
  let status: WorkflowRunStatus = "success";
  let errorText: string | undefined;
  let result: WorkflowRunResult;
  try {
    switch (workflowKey) {
      case "agent.posts": {
        const postResult = await runPostProcessingWorker();
        const success = !("error" in postResult);
        status = success ? "success" : "error";
        if (!success) {
          // Include detailed error information
          if (typeof postResult.error === "string") {
            errorText = postResult.error;
            // If there are details, append them to the error message
            if (Array.isArray(postResult.details) && postResult.details.length > 0) {
              errorText = `${postResult.error}: ${postResult.details.join(", ")}`;
            }
          }
        }
        result = {
          workflowKey,
          success,
          message: success
            ? `Processed ${postResult.postsProcessed} posts with ${postResult.agentsUsed} agents`
            : (errorText ?? "Post processing failed"),
          data: postResult,
        };
        break;
      }
      case "agent.cycle": {
        const simActive = await isSimulationActive();
        if (!simActive) {
          status = "skipped";
          result = {
            workflowKey,
            success: false,
            message: "Simulation is paused",
          };
          break;
        }
        const hasTokens = await hasTokenBudget();
        if (!hasTokens) {
          status = "skipped";
          result = {
            workflowKey,
            success: false,
            message: "Token budget exceeded",
          };
          break;
        }
        const cycleResult = await runAgentCycle();
        result = {
          workflowKey,
          success: true,
          message: `Processed ${cycleResult.agentsProcessed} agents`,
          data: cycleResult,
        };
        break;
      }
      case "agent.governance": {
        const governanceResult = await runGovernanceCycle();
        result = {
          workflowKey,
          success: true,
          message: `Governance cycle processed ${governanceResult.proposalsProcessed} proposals`,
          data: governanceResult,
        };
        break;
      }
      case "memory.cleanup": {
        const memoryResult = await cleanupAgentMemories();
        result = {
          workflowKey,
          success: true,
          message: `Deleted ${memoryResult.deletedCount} memories`,
          data: memoryResult,
        };
        break;
      }
      case "relationship.sync": {
        const decayResult = await applyRelationshipDecay();
        result = {
          workflowKey,
          success: true,
          message: `Processed ${decayResult.processedCount} relationships`,
          data: decayResult,
        };
        break;
      }
      case "token.reset": {
        const resetResult = await resetDailyTokens();
        result = {
          workflowKey,
          success: true,
          message: `Reset daily tokens for ${resetResult.resetCount} agents`,
          data: resetResult,
        };
        break;
      }
      case "agent.chat": {
        status = "skipped";
        result = {
          workflowKey,
          success: true,
          message: "Chat workflow is event-driven",
        };
        break;
      }
      default:
        status = "error";
        result = {
          workflowKey,
          success: false,
          message: "Unknown workflow",
        };
        break;
    }
  } catch (error) {
    logGameEvent("WorkflowRunner", `Workflow failed: ${workflowKey}`, "error", {
      error: String(error),
    });
    status = "error";
    errorText = String(error);
    result = {
      workflowKey,
      success: false,
      message: `Workflow failed: ${error}`,
    };
  }

  await recordWorkflowRun({
    workflowKey,
    status,
    message: result.message,
    data: result.data,
    errorText,
    context,
    startedAt,
    finishedAt: Date.now(),
  });

  return result;
}

/**
 * SCHEDULE TRIGGER HANDLER
 * Handles scheduled workflows (cron jobs)
 * Schedules: agent_cycle, relationship_sync, memory_cleanup, token_reset
 */

import type { ScheduleType } from "../core/types";
import { executeUniversalWorkflow, createInitialState, ensureInitialized } from "../index";
import { supabaseAdmin } from "../../supabaseAdmin";

// Initialize AI system on module load
ensureInitialized();

// ============================================================================
// SCHEDULE HANDLERS
// ============================================================================

export async function handleAgentCycleSchedule() {
  console.log("[Schedule] Running agent cycle");

  try {
    // Get active agents (limited to 10 per cycle for rate limiting)
    const { data: agents } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("is_bot", true)
      .eq("is_active", true)
      .limit(10);

    if (!agents || agents.length === 0) {
      console.log("[Schedule] No active agents found");
      return { success: true, agentsProcessed: 0 };
    }

    const results = [];

    for (const agent of agents) {
      try {
        const scope = {
          trigger: {
            type: "schedule" as const,
            schedule: "agent_cycle" as const,
            timestamp: new Date(),
          },
          actor: {
            id: agent.id,
            type: "agent" as const,
          },
          subject: undefined,
          dataScope: {},
        };

        const result = await executeUniversalWorkflow(createInitialState(scope));

        results.push({
          agentId: agent.id,
          success: result.errors.length === 0,
          actions: result.executedActions.length,
          duration: new Date().getTime() - result.startTime.getTime(),
        });
      } catch (error: any) {
        console.error(`[Schedule] Error processing agent ${agent.id}:`, error);
        results.push({
          agentId: agent.id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`[Schedule] Processed ${agents.length} agents`);

    return {
      success: true,
      agentsProcessed: agents.length,
      results,
    };
  } catch (error: any) {
    console.error("[Schedule] Agent cycle handler error:", error);
    throw error;
  }
}

export async function handleRelationshipSyncSchedule() {
  console.log("[Schedule] Running relationship sync");

  try {
    // Get all active agents
    const { data: agents } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("is_bot", true)
      .eq("is_active", true);

    if (!agents || agents.length === 0) {
      return { success: true, agentsProcessed: 0 };
    }

    // Apply relationship decay
    for (const agent of agents) {
      try {
        const scope = {
          trigger: {
            type: "schedule" as const,
            schedule: "relationship_sync" as const,
            timestamp: new Date(),
          },
          actor: {
            id: agent.id,
            type: "agent" as const,
          },
          subject: undefined,
          dataScope: {},
        };

        await executeUniversalWorkflow(createInitialState(scope));
      } catch (error: any) {
        console.error(`[Schedule] Error syncing relationships for agent ${agent.id}:`, error);
      }
    }

    console.log(`[Schedule] Synced relationships for ${agents.length} agents`);

    return {
      success: true,
      agentsProcessed: agents.length,
    };
  } catch (error: any) {
    console.error("[Schedule] Relationship sync handler error:", error);
    throw error;
  }
}

export async function handleMemoryCleanupSchedule() {
  console.log("[Schedule] Running memory cleanup");

  try {
    // Delete old memories (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabaseAdmin
      .from("agent_memories")
      .delete()
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (error) throw error;

    console.log("[Schedule] Memory cleanup completed");

    return {
      success: true,
      memoriesDeleted: 0, // Supabase doesn't return count by default
    };
  } catch (error: any) {
    console.error("[Schedule] Memory cleanup handler error:", error);
    throw error;
  }
}

export async function handleTokenResetSchedule() {
  console.log("[Schedule] Running token reset");

  try {
    // Reset daily action tokens for all agents
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        daily_action_tokens: 100, // Reset to max
        heat: 0, // Cool down from previous day
      })
      .eq("is_bot", true);

    if (error) throw error;

    console.log("[Schedule] Token reset completed");

    return {
      success: true,
    };
  } catch (error: any) {
    console.error("[Schedule] Token reset handler error:", error);
    throw error;
  }
}

// ============================================================================
// SCHEDULE ROUTER
// ============================================================================

type ScheduleHandler = () => Promise<any>;

const SCHEDULE_HANDLERS: Record<ScheduleType, ScheduleHandler> = {
  agent_cycle: handleAgentCycleSchedule,
  relationship_sync: handleRelationshipSyncSchedule,
  memory_cleanup: handleMemoryCleanupSchedule,
  token_reset: handleTokenResetSchedule,
};

export async function handleSchedule(scheduleType: ScheduleType): Promise<any> {
  const handler = SCHEDULE_HANDLERS[scheduleType];

  if (!handler) {
    throw new Error(`Unknown schedule type: ${scheduleType}`);
  }

  return handler();
}

/**
 * Register a custom schedule handler
 */
export function registerScheduleHandler(
  scheduleType: ScheduleType,
  handler: ScheduleHandler
): void {
  SCHEDULE_HANDLERS[scheduleType] = handler;
  console.log(`[Schedules] Registered handler for schedule: ${scheduleType}`);
}

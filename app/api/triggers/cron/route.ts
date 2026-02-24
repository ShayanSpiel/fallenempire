/**
 * UNIFIED SCHEDULE TRIGGER ENDPOINT
 * Handles scheduled workflow executions
 * Called by external cron service (e.g., Vercel Cron, GitHub Actions, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { executeUniversalWorkflow, createInitialState, ensureInitialized } from "@/lib/ai-system";
import type { ScheduleType } from "@/lib/ai-system/core/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Initialize on import
ensureInitialized();

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const secret = request.headers.get("authorization")?.split(" ")[1];
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get schedule type from query params
    const scheduleType = request.nextUrl.searchParams.get("schedule") as ScheduleType | null;

    if (!scheduleType) {
      return NextResponse.json(
        { error: "Missing schedule parameter" },
        { status: 400 }
      );
    }

    const validSchedules: ScheduleType[] = [
      "agent_cycle",
      "relationship_sync",
      "memory_cleanup",
      "token_reset",
    ];

    if (!validSchedules.includes(scheduleType)) {
      return NextResponse.json(
        { error: `Unknown schedule type: ${scheduleType}` },
        { status: 400 }
      );
    }

    console.log(`[Cron] Executing schedule: ${scheduleType}`);

    // Get active agents for scheduled tasks
    const { data: agents } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("is_agent", true)
      .eq("is_active", true)
      .limit(20); // Process up to 20 agents per cron job

    const results = [];

    for (const agent of agents || []) {
      try {
        const scope = {
          trigger: {
            type: "schedule" as const,
            schedule: scheduleType,
            timestamp: new Date(),
          },
          actor: {
            id: agent.id,
            type: "agent" as const,
          },
          subject: undefined,
          dataScope: {},
        };

        const workflowResult = await executeUniversalWorkflow(createInitialState(scope));

        results.push({
          agentId: agent.id,
          success: workflowResult.errors.length === 0,
          actions: workflowResult.executedActions,
          iterations: workflowResult.loop.iteration,
        });
      } catch (error: any) {
        results.push({
          agentId: agent.id,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      schedule: scheduleType,
      agentsProcessed: agents?.length || 0,
      results,
    });
  } catch (error: any) {
    console.error("[Cron] Route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Example requests:
 *
 * GET /api/triggers/cron?schedule=agent_cycle
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * GET /api/triggers/cron?schedule=relationship_sync
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * GET /api/triggers/cron?schedule=memory_cleanup
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * GET /api/triggers/cron?schedule=token_reset
 * Headers: Authorization: Bearer <CRON_SECRET>
 */

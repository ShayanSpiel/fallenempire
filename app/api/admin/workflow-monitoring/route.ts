/**
 * ADMIN WORKFLOW MONITORING ENDPOINT
 * Provides workflow execution history, metrics, and real-time status
 * Requires admin authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Verify admin access
async function verifyAdmin(request: NextRequest): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Check if user is admin
  const { data: adminUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", user.id)
    .eq("is_admin", true)
    .single();

  return adminUser ? user.id : null;
}

// GET: Fetch workflow execution history
export async function GET(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Fetch workflow execution logs from agent_actions table
    let query = supabaseAdmin
      .from("agent_actions")
      .select(
        `
        id,
        agent_id,
        action_type,
        target_id,
        scope_trigger,
        metadata,
        created_at
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (agentId) {
      query = query.eq("agent_id", agentId);
    }

    const { data: actions, count } = await query;

    // Fetch agent names for better visibility
    const agentIds = new Set((actions || []).map((a) => a.agent_id));
    const { data: agents } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .in("id", Array.from(agentIds));

    const agentMap = new Map(agents?.map((a) => [a.id, a.username]) || []);

    // Enrich action data with agent names
    const enrichedActions = (actions || []).map((action) => ({
      ...action,
      agentName: agentMap.get(action.agent_id) || "Unknown Agent",
    }));

    return NextResponse.json({
      success: true,
      data: enrichedActions,
      pagination: {
        offset,
        limit,
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
    });
  } catch (error: any) {
    console.error("[Admin] Workflow history error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch workflow history" },
      { status: 500 }
    );
  }
}

// POST: Get workflow statistics
export async function POST(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, agentId, timeRange = "24h" } = body;

    if (action === "stats") {
      // Get workflow statistics
      const timeAgo = getTimeAgo(timeRange);

      // Count executions by agent
      const { data: executions } = await supabaseAdmin
        .from("agent_actions")
        .select("agent_id, action_type", { count: "exact" })
        .gte("created_at", timeAgo.toISOString())
        .order("created_at", { ascending: false });

      // Calculate stats
      const stats = {
        totalExecutions: executions?.length || 0,
        byAgent: {} as Record<string, number>,
        byAction: {} as Record<string, number>,
        timeline: getTimelineData(executions || [], timeRange),
      };

      for (const exec of executions || []) {
        stats.byAgent[exec.agent_id] = (stats.byAgent[exec.agent_id] || 0) + 1;
        stats.byAction[exec.action_type] =
          (stats.byAction[exec.action_type] || 0) + 1;
      }

      return NextResponse.json({
        success: true,
        timeRange,
        stats,
      });
    } else if (action === "agent-health") {
      // Get health metrics for a specific agent
      const { data: agent } = await supabaseAdmin
        .from("users")
        .select("id, username, heat, morale, coherence, is_active")
        .eq("id", agentId)
        .single();

      if (!agent) {
        return NextResponse.json(
          { error: "Agent not found" },
          { status: 404 }
        );
      }

      // Get recent action count
      const { data: recentActions, count: actionCount } = await supabaseAdmin
        .from("agent_actions")
        .select("*", { count: "exact" })
        .eq("agent_id", agentId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return NextResponse.json({
        success: true,
        agent: {
          ...agent,
          recentActionsCount: actionCount || 0,
          status: agent.is_active ? "active" : "inactive",
          healthScore: calculateHealthScore(agent),
        },
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Admin] Workflow stats error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}

// PUT: Control workflow execution
export async function PUT(request: NextRequest) {
  try {
    const adminId = await verifyAdmin(request);
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, agentId, targetState } = body;

    if (action === "pause") {
      // Pause agent activities
      await supabaseAdmin
        .from("users")
        .update({ is_active: false })
        .eq("id", agentId);

      return NextResponse.json({
        success: true,
        message: `Agent ${agentId} paused`,
      });
    } else if (action === "resume") {
      // Resume agent activities
      await supabaseAdmin
        .from("users")
        .update({ is_active: true })
        .eq("id", agentId);

      return NextResponse.json({
        success: true,
        message: `Agent ${agentId} resumed`,
      });
    } else if (action === "reset-heat") {
      // Reset agent heat
      await supabaseAdmin
        .from("users")
        .update({ heat: 0 })
        .eq("id", agentId);

      return NextResponse.json({
        success: true,
        message: `Heat reset for agent ${agentId}`,
      });
    } else if (action === "reset-tokens") {
      // Reset daily action tokens
      await supabaseAdmin
        .from("users")
        .update({ daily_action_tokens: 100 })
        .eq("id", agentId);

      return NextResponse.json({
        success: true,
        message: `Tokens reset for agent ${agentId}`,
      });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Admin] Workflow control error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to control workflow" },
      { status: 500 }
    );
  }
}

// Helper functions
function getTimeAgo(timeRange: string): Date {
  const now = new Date();
  switch (timeRange) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

function getTimelineData(executions: any[], timeRange: string): any[] {
  const timeline: Record<string, number> = {};

  for (const exec of executions) {
    let bucket = "";
    const date = new Date(exec.created_at);

    if (timeRange === "1h") {
      bucket = date.toISOString().substring(0, 13); // Hour granularity
    } else if (timeRange === "24h") {
      bucket = date.toISOString().substring(0, 13); // Hour granularity
    } else {
      bucket = date.toISOString().substring(0, 10); // Day granularity
    }

    timeline[bucket] = (timeline[bucket] || 0) + 1;
  }

  return Object.entries(timeline)
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

function calculateHealthScore(agent: any): number {
  let score = 100;

  // Deduct for heat
  score -= Math.min(50, (agent.heat || 0) * 0.5);

  // Deduct for low morale
  if ((agent.morale || 50) < 30) {
    score -= 20;
  }

  // Deduct for low coherence
  if ((agent.coherence || 50) < 30) {
    score -= 20;
  }

  // Deduct if inactive
  if (!agent.is_active) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

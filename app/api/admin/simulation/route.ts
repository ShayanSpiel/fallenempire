/**
 * Admin API: Simulation Control
 * Manage global AI simulation settings and trigger universal workflows
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getSimulationStats,
  setSimulationActive,
  pauseSimulationUntil,
  resumeSimulation,
  updateSimulationSettings,
} from "@/lib/admin/simulation-control";
import { logGameEvent } from "@/lib/logger";
import { ensureInitialized, executeUniversalWorkflow, createInitialState } from "@/lib/ai-system";
import { assertAdmin } from "@/lib/admin/api-auth";

export async function GET(request: NextRequest) {
  try {
    const { error } = await assertAdmin(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    // Get simulation stats
    if (action === "stats") {
      const stats = await getSimulationStats();
      return NextResponse.json(stats || {});
    }

    // Get workflow execution stats
    if (action === "workflow_stats") {
      const { data: stats, error } = await supabaseAdmin
        .from("agent_actions")
        .select("action_type, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Aggregate stats
      const actionCounts: Record<string, number> = {};
      stats?.forEach((action: any) => {
        actionCounts[action.action_type] = (actionCounts[action.action_type] || 0) + 1;
      });

      return NextResponse.json({
        totalActions: stats?.length || 0,
        actionCounts,
        recentActions: stats?.slice(0, 10),
      });
    }

    // Get background job status
    if (action === "jobs") {
      const { data: jobs, error } = await supabaseAdmin.rpc(
        "get_simulation_stats"
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(jobs?.[0] || {});
    }

    // Get relationship statistics
    if (action === "relationships") {
      const { data: stats, error } = await supabaseAdmin.rpc(
        "get_relationship_statistics"
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ statistics: stats || [] });
    }

    // Get goal statistics
    if (action === "goals") {
      const { data: stats, error } = await supabaseAdmin.rpc(
        "get_goal_statistics"
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ statistics: stats || [] });
    }

    // Get top agents
    if (action === "top_agents") {
      const limit = searchParams.get("limit") || "10";
      const { data: agents, error } = await supabaseAdmin.rpc(
        "get_top_agents",
        { p_limit: parseInt(limit) }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ agents: agents || [] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    logGameEvent("AdminAPI", "Error in simulation GET", "error", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error } = await assertAdmin(request);
    if (error) return error;

    const body = await request.json();
    const { action, ...params } = body;

    // Enable/disable simulation
    if (action === "set_active") {
      const success = await setSimulationActive(params.active);
      return NextResponse.json({
        success,
        message: params.active ? "Simulation enabled" : "Simulation disabled",
      });
    }

    // Pause simulation
    if (action === "pause") {
      const until = new Date(params.until_timestamp);
      const success = await pauseSimulationUntil(until);
      return NextResponse.json({
        success,
        message: `Simulation paused until ${until.toISOString()}`,
      });
    }

    // Resume simulation
    if (action === "resume") {
      const success = await resumeSimulation();
      return NextResponse.json({
        success,
        message: "Simulation resumed",
      });
    }

    // Update settings
    if (action === "update_settings") {
      const { batch_size, max_concurrent, token_budget, cost_limit } = params;
      const updates: any = {};

      if (batch_size !== undefined) updates.batch_size = batch_size;
      if (max_concurrent !== undefined) updates.max_concurrent = max_concurrent;
      if (token_budget !== undefined)
        updates.global_token_budget = token_budget;
      if (cost_limit !== undefined) updates.cost_limit = cost_limit;

      const success = await updateSimulationSettings(updates);

      logGameEvent("AdminAPI", "Simulation settings updated", "info", {
        updates,
      });

      return NextResponse.json({
        success,
        message: "Settings updated",
        updated: updates,
      });
    }

    // NEW: Trigger post processing with universal workflow
    if (action === "process_posts") {
      ensureInitialized(); // Ensure tools are registered

      const postLimit = params.postLimit || 5;
      const agentLimit = params.agentLimit || 5;

      // Get recent posts
      const { data: posts, error: postsError } = await supabaseAdmin
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(postLimit);

      if (postsError) {
        return NextResponse.json({ error: postsError.message }, { status: 500 });
      }

      // Get active agents
      const { data: agents, error: agentsError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("is_agent", true)
        .eq("is_active", true)
        .limit(agentLimit);

      if (agentsError) {
        return NextResponse.json({ error: agentsError.message }, { status: 500 });
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      // Process each post with each agent using universal workflow
      for (const post of posts || []) {
        for (const agent of agents || []) {
          try {
            const scope = {
              trigger: {
                type: "event" as const,
                event: "post" as const,
                timestamp: new Date(),
              },
              actor: {
                id: agent.id,
                type: "agent" as const,
              },
              subject: {
                id: post.id,
                type: "post" as const,
                data: {
                  author_id: post.author_id,
                  content: post.content,
                  community_id: post.community_id,
                },
              },
            };

            const workflowResult = await executeUniversalWorkflow(createInitialState(scope));

            results.push({
              agentId: agent.id,
              postId: post.id,
              success: workflowResult.errors.length === 0,
              actions: workflowResult.executedActions,
              iterations: workflowResult.loop.iteration,
            });

            if (workflowResult.errors.length === 0) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch (error: any) {
            errorCount++;
            results.push({
              agentId: agent.id,
              postId: post.id,
              success: false,
              error: error.message,
            });
          }
        }
      }

      logGameEvent("AdminAPI", "Post processing completed", "info", {
        postsProcessed: posts?.length || 0,
        agentsUsed: agents?.length || 0,
        successCount,
        errorCount,
      });

      return NextResponse.json({
        success: true,
        message: `Processed ${posts?.length || 0} posts with ${agents?.length || 0} agents`,
        stats: {
          postsProcessed: posts?.length || 0,
          agentsUsed: agents?.length || 0,
          totalWorkflows: results.length,
          successCount,
          errorCount,
        },
        results: results.slice(0, 20), // Return first 20 results
      });
    }

    // NEW: Trigger battle processing
    if (action === "process_battles") {
      ensureInitialized();

      const { data: battles, error: battlesError } = await supabaseAdmin
        .from("battles")
        .select("*")
        .eq("status", "active")
        .limit(5);

      if (battlesError) {
        return NextResponse.json({ error: battlesError.message }, { status: 500 });
      }

      const { data: agents, error: agentsError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("is_agent", true)
        .eq("is_active", true)
        .limit(params.agentLimit || 10);

      if (agentsError) {
        return NextResponse.json({ error: agentsError.message }, { status: 500 });
      }

      const results = [];
      let successCount = 0;

      for (const battle of battles || []) {
        for (const agent of agents || []) {
          try {
            const scope = {
              trigger: {
                type: "event" as const,
                event: "battle" as const,
                timestamp: new Date(),
              },
              actor: {
                id: agent.id,
                type: "agent" as const,
              },
              subject: {
                id: battle.id,
                type: "battle" as const,
                data: {
                  community1_id: battle.community1_id,
                  community2_id: battle.community2_id,
                  status: battle.status,
                },
              },
            };

            const workflowResult = await executeUniversalWorkflow(createInitialState(scope));

            results.push({
              agentId: agent.id,
              battleId: battle.id,
              success: workflowResult.errors.length === 0,
              actions: workflowResult.executedActions,
            });

            if (workflowResult.errors.length === 0) successCount++;
          } catch (error: any) {
            results.push({
              agentId: agent.id,
              battleId: battle.id,
              success: false,
              error: error.message,
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${battles?.length || 0} battles`,
        stats: {
          battlesProcessed: battles?.length || 0,
          agentsUsed: agents?.length || 0,
          successCount,
        },
        results,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    logGameEvent("AdminAPI", "Error in simulation POST", "error", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

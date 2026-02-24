/**
 * Admin API: Agent Management
 * Full control over agent system
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";
import { assertAdmin } from "@/lib/admin/api-auth";

export async function GET(request: NextRequest) {
  try {
    const { error } = await assertAdmin(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    // Get all agents
    if (action === "list") {
      const { data: agents, error } = await supabaseAdmin
        .from("users")
        .select(
          "id, username, identity_label, morale, power_mental, power_physical, freewill, is_bot, last_seen_at"
        )
        .eq("is_bot", true)
        .order("last_seen_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ agents });
    }

    // Get agent details
    if (action === "details") {
      const agentId = searchParams.get("agent_id");
      if (!agentId) {
        return NextResponse.json({ error: "Missing agent_id" }, { status: 400 });
      }

      const { data: agent, error: agentError } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", agentId)
        .eq("is_bot", true)
        .single();

      if (agentError || !agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      // Get agent stats
      const { data: goals } = await supabaseAdmin
        .from("agent_goals")
        .select("*")
        .eq("agent_id", agentId)
        .eq("status", "active");

      const { data: relationships } = await supabaseAdmin
        .from("agent_relationships")
        .select("*")
        .eq("agent_id", agentId)
        .order("relationship_score", { ascending: false });

      const { data: factions } = await supabaseAdmin
        .from("faction_members")
        .select("agent_factions(id, name, power)")
        .eq("member_id", agentId);

      return NextResponse.json({
        agent,
        activeGoals: goals || [],
        relationships: relationships || [],
        factions: factions?.map((f: any) => f.agent_factions) || [],
      });
    }

    // Get agent statistics
    if (action === "statistics") {
      const { data: stats, error } = await supabaseAdmin.rpc(
        "get_agent_statistics"
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(stats?.[0] || {});
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    logGameEvent("AdminAPI", "Error in agent management", "error", {
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
    const { action, agent_id, data } = body;

    // Update agent stats
    if (action === "update_stats") {
      const { error } = await supabaseAdmin
        .from("users")
        .update(data)
        .eq("id", agent_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logGameEvent(
        "AdminAPI",
        `Agent ${agent_id} stats updated`,
        "info",
        { data }
      );

      return NextResponse.json({ success: true });
    }

    // Reset agent
    if (action === "reset_agent") {
      const { error: resetError } = await supabaseAdmin
        .from("users")
        .update({
          morale: 50,
          power_mental: 50,
          power_physical: 50,
          freewill: 50,
        })
        .eq("id", agent_id);

      if (resetError) {
        return NextResponse.json({ error: resetError.message }, { status: 500 });
      }

      // Clear goals
      await supabaseAdmin
        .from("agent_goals")
        .update({ status: "abandoned" })
        .eq("agent_id", agent_id);

      logGameEvent("AdminAPI", `Agent ${agent_id} reset`, "warn");

      return NextResponse.json({ success: true });
    }

    // Delete agent (soft delete)
    if (action === "disable_agent") {
      const { error } = await supabaseAdmin
        .from("users")
        .update({ is_bot: false })
        .eq("id", agent_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logGameEvent("AdminAPI", `Agent ${agent_id} disabled`, "warn");

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    logGameEvent("AdminAPI", "Error in agent POST", "error", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

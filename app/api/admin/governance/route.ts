/**
 * Admin API: Governance Management
 * Manage laws, proposals, factions
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

    // Get proposals in community (or all if no community specified)
    if (action === "proposals") {
      const communityId = searchParams.get("community_id");

      // If no community specified, get all proposals
      if (!communityId) {
        const { data: proposals, error } = await supabaseAdmin
          .from("community_proposals")
          .select("id, community_id, law_type, status, created_at, proposer_id")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ proposals: proposals || [] });
      }

      const { data: proposals, error } = await supabaseAdmin.rpc(
        "get_community_proposals",
        { p_community_id: communityId }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ proposals: proposals || [] });
    }

    // Get factions in community
    if (action === "factions") {
      const communityId = searchParams.get("community_id");
      if (!communityId) {
        return NextResponse.json(
          { error: "Missing community_id" },
          { status: 400 }
        );
      }

      const { data: factions, error } = await supabaseAdmin.rpc(
        "get_community_factions",
        { p_community_id: communityId }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ factions: factions || [] });
    }

    // Get proposal details with votes
    if (action === "proposal_details") {
      const proposalId = searchParams.get("proposal_id");
      if (!proposalId) {
        return NextResponse.json(
          { error: "Missing proposal_id" },
          { status: 400 }
        );
      }

      const { data: proposal, error: propError } = await supabaseAdmin
        .from("community_proposals")
        .select("*")
        .eq("id", proposalId)
        .single();

      if (propError || !proposal) {
        return NextResponse.json(
          { error: "Proposal not found" },
          { status: 404 }
        );
      }

      const { data: votes, error: voteError } = await supabaseAdmin
        .from("proposal_votes")
        .select("user_id, vote")
        .eq("proposal_id", proposalId);

      if (voteError) {
        return NextResponse.json({ error: voteError.message }, { status: 500 });
      }

      const yesCount = votes?.filter((v) => v.vote === "yes").length || 0;
      const noCount = votes?.filter((v) => v.vote === "no").length || 0;

      return NextResponse.json({
        proposal,
        votes: {
          total: votes?.length || 0,
          yes: yesCount,
          no: noCount,
          percentage: votes && votes.length > 0 ? (yesCount / votes.length) * 100 : 0,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    logGameEvent("AdminAPI", "Error in governance GET", "error", {
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

    // Resolve proposal manually (admin override)
    if (action === "resolve_proposal") {
      const { proposal_id, passed } = params;

      const { error } = await supabaseAdmin.rpc("resolve_proposal", {
        p_proposal_id: proposal_id,
        p_passed: passed,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logGameEvent(
        "AdminAPI",
        `Proposal ${proposal_id} resolved: ${passed ? "PASSED" : "REJECTED"}`,
        "warn"
      );

      return NextResponse.json({
        success: true,
        message: `Proposal ${passed ? "passed" : "rejected"}`,
      });
    }

    // Create faction (admin)
    if (action === "create_faction") {
      const { community_id, leader_id, name, ideology } = params;

      const { data, error } = await supabaseAdmin
        .from("agent_factions")
        .insert({
          community_id,
          leader_id,
          name,
          ideology,
          power: 10,
        })
        .select();

      if (error || !data) {
        return NextResponse.json({ error: error?.message }, { status: 500 });
      }

      logGameEvent("AdminAPI", `Faction "${name}" created`, "info");

      return NextResponse.json({
        success: true,
        faction: data[0],
      });
    }

    // Add member to faction (admin)
    if (action === "add_faction_member") {
      const { faction_id, member_id } = params;

      const { error } = await supabaseAdmin.rpc("join_faction", {
        p_faction_id: faction_id,
        p_member_id: member_id,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logGameEvent(
        "AdminAPI",
        `Member added to faction ${faction_id}`,
        "info"
      );

      return NextResponse.json({
        success: true,
        message: "Member added to faction",
      });
    }

    // Update faction power (admin)
    if (action === "update_faction_power") {
      const { faction_id, delta } = params;

      const { data, error } = await supabaseAdmin.rpc(
        "update_faction_power",
        {
          p_faction_id: faction_id,
          p_delta: delta,
        }
      );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      logGameEvent(
        "AdminAPI",
        `Faction ${faction_id} power updated by ${delta}`,
        "info"
      );

      return NextResponse.json({
        success: true,
        new_power: data,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    logGameEvent("AdminAPI", "Error in governance POST", "error", {
      error: err.message,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

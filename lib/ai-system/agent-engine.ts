/**
 * AGENT ENGINE - Core execution loop for AI agents
 * DEPRECATED: Being replaced by individual workflows (dm-workflow, post-workflow, etc.)
 * Currently returns stub results for scheduled agent cycles
 * TODO: Implement agent-cycle-workflow.ts for proper scheduled agent behavior
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentCycleResult {
  agentsProcessed: number;
  actionsExecuted: number;
  tokensUsed: number;
  successCount: number;
  errorCount: number;
  duration: number;
  details: AgentExecutionDetail[];
}

export interface AgentExecutionDetail {
  agentId: string;
  action: string;
  success: boolean;
  tokensUsed?: number;
  error?: string;
}

// ============================================================================
// AGENT ENGINE CORE
// ============================================================================

/**
 * Main agent cycle - processes all active agents
 * STUB: Returns empty results until agent-cycle-workflow.ts is implemented
 */
export async function runAgentCycle(): Promise<AgentCycleResult> {
  const startTime = Date.now();

  try {
    logGameEvent("AgentEngine", "Agent cycle (stub) - TODO: implement agent-cycle-workflow.ts", "info");

    return {
      agentsProcessed: 0,
      actionsExecuted: 0,
      tokensUsed: 0,
      successCount: 0,
      errorCount: 0,
      duration: Date.now() - startTime,
      details: [],
    };
  } catch (error) {
    logGameEvent("AgentEngine", "Agent cycle failed", "error", { error: String(error) });
    throw error;
  }
}

// ============================================================================
// SINGLE AGENT PROCESSING
// ============================================================================

/**
 * Process a single agent through decision cycle
 * DEPRECATED: Use individual workflows instead (dm-workflow, post-workflow, etc.)
 */
async function processAgent(
  agent: any
): Promise<{ success: boolean; tokensUsed: number; detail: AgentExecutionDetail }> {
  const agentId = agent.id;

  // Stub - always return no action
  return {
    success: true,
    tokensUsed: 0,
    detail: {
      agentId,
      action: "STUB",
      success: true,
      error: "Agent processing moved to individual workflows",
    },
  };
}

// ============================================================================
// PERCEPTION GATHERING
// ============================================================================

/**
 * Get current game state perception for agent
 */
async function getAgentPerception(
  agentId: string,
  availableActions: string[]
): Promise<Record<string, any>> {
  try {
    // Get recent posts/content
    const { data: recentContent } = await supabaseAdmin
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    // Get agent's recent relationships
    const { data: relationships } = await supabaseAdmin
      .from("agent_relationships")
      .select("*")
      .eq("agent_id", agentId)
      .limit(5);

    // Get community activity
    const { data: communities } = await supabaseAdmin
      .from("community_members")
      .select("community_id")
      .eq("user_id", agentId);

    const { data: communitySuggestions } = await supabaseAdmin
      .from("communities")
      .select("id, name, ideology_json, members_count")
      .order("members_count", { ascending: false })
      .limit(3);

    return {
      availableContent: recentContent?.length || 0,
      recentInteractions: relationships?.length || 0,
      communityCount: communities?.length || 0,
      availableActions,
      communitySuggestions:
        communitySuggestions?.map((community) => ({
          id: community.id,
          name: community.name ?? "Unnamed Community",
          ideology: community.ideology_json ?? {},
          membersCount: community.members_count ?? 0,
        })) ?? [],
      recentContent: (recentContent || []).map((post: any) => ({
        id: post.id,
        summary: (post.title || post.content || "")
          .toString()
          .slice(0, 140),
      })),
      timestamp: Date.now(),
      onlineCount: 5, // Placeholder
    };
  } catch (error) {
    logGameEvent("AgentEngine", "Error gathering perception", "error", {
      agentId,
      error: String(error),
    });
    return {
      availableContent: 0,
      recentInteractions: 0,
      communityCount: 0,
      availableActions,
      timestamp: Date.now(),
    };
  }
}

// ============================================================================
// ACTION DISCOVERY
// ============================================================================

/**
 * Get list of available actions for agent
 */
async function getAvailableActions(agentId: string): Promise<string[]> {
  const actions: string[] = [];

  try {
    // Check if agent can interact with posts
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id")
      .limit(1);

    if (posts && posts.length > 0) {
      actions.push("LIKE");
      actions.push("COMMENT");
      actions.push("SHARE");
    }

    // Check if agent can follow users
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id")
      .neq("id", agentId)
      .limit(1);

    if (users && users.length > 0) {
      actions.push("FOLLOW");
    }

    // Check if agent can join communities
    const { data: communities } = await supabaseAdmin
      .from("communities")
      .select("id")
      .limit(1);

    if (communities && communities.length > 0) {
      actions.push("JOIN_COMMUNITY");
    }

    // Check if agent can attack regions (if game has regions)
    const { data: regions } = await supabaseAdmin
      .from("regions")
      .select("id")
      .limit(1);

    if (regions && regions.length > 0) {
      actions.push("ATTACK");
    }

    return actions.length > 0 ? actions : ["PASS"];
  } catch (error) {
    logGameEvent("AgentEngine", "Error discovering available actions", "error", {
      agentId,
      error: String(error),
    });
    return ["PASS"];
  }
}

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Memory cleanup - delete old agent memories
 */
export async function cleanupAgentMemories(): Promise<{ deletedCount: number }> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { error } = await supabaseAdmin
      .from("agent_memories")
      .delete()
      .lt("created_at", thirtyDaysAgo.toISOString());

    if (error) throw error;

    logGameEvent("AgentEngine", "Cleaned up old agent memories", "info");
    return { deletedCount: 0 }; // Would need RPC to get exact count
  } catch (error) {
    logGameEvent("AgentEngine", "Error cleaning up memories", "error", {
      error: String(error),
    });
    throw error;
  }
}

/**
 * Relationship decay - reduce relationship values over time
 */
export async function applyRelationshipDecay(): Promise<{ processedCount: number }> {
  try {
    const { error } = await supabaseAdmin.rpc("apply_relationship_decay");

    if (error) throw error;

    logGameEvent("AgentEngine", "Applied relationship decay", "info");
    return { processedCount: 0 }; // Would need RPC to get exact count
  } catch (error) {
    logGameEvent("AgentEngine", "Error applying relationship decay", "error", {
      error: String(error),
    });
    throw error;
  }
}

/**
 * Reset daily token counter
 */
export async function resetDailyTokens(): Promise<{ resetCount: number }> {
  try {
    const { error } = await supabaseAdmin.rpc("reset_daily_tokens");

    if (error) throw error;

    logGameEvent("AgentEngine", "Reset daily tokens", "info");
    return { resetCount: 0 }; // Would need RPC to get exact count
  } catch (error) {
    logGameEvent("AgentEngine", "Error resetting daily tokens", "error", {
      error: String(error),
    });
    throw error;
  }
}

/**
 * DATA TOOLS
 * Tools for fetching and analyzing data - NO pre-fetching, just-in-time queries
 */

import type { ToolDefinitionV2, ToolExecutionContext } from "../../core/types";
import { registerTool } from "../registry";
import { supabaseAdmin } from "../../../supabaseAdmin";

// ============================================================================
// USER & PROFILE TOOLS
// ============================================================================

const getUserProfileTool: ToolDefinitionV2 = {
  name: "get_user_profile",
  category: "data",
  description: "Get complete profile of any user by ID including stats, identity, and rage",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user to get profile for",
      },
    },
    required: ["userId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId } = input;

    // Avoid `select("*")` to keep tool payloads small (reduces LLM tokens).
    // Fall back safely if columns are missing in a given deployment.
    {
      const result = await supabaseAdmin
        .from("users")
        .select(
          "id, username, display_name, bio, identity_json, morale, coherence, heat, energy, health, mental_power, freewill, community_id, rage, strength, main_community_id"
        )
        .eq("id", userId)
        .maybeSingle();

      if (!result.error) return result.data;

      // Missing-column errors in Postgres (e.g., evolving schema)
      if (result.error.code !== "42703") {
        throw new Error(`User fetch failed: ${result.error.message} (${result.error.code})`);
      }
    }

    // Fallback: minimal safe columns
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, username, identity_json, morale, rage")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(`User fetch failed: ${error.message} (${error.code})`);
    return user;
  },
};

const getMyStatsTool: ToolDefinitionV2 = {
  name: "get_my_stats",
  category: "data",
  description: "Get current agent's own stats (health, energy, morale, rage, gold, etc.)",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { data: stats } = await supabaseAdmin
      .from("users")
      .select("health, energy, morale, coherence, heat, mental_power, freewill, identity_json, rage, strength, main_community_id")
      .eq("id", context.agentId)
      .single();

    return stats;
  },
};

// ============================================================================
// RELATIONSHIP TOOLS
// ============================================================================

const checkRelationshipTool: ToolDefinitionV2 = {
  name: "check_relationship",
  category: "data",
  description: "Check relationship status with a user (enemy, cautious, neutral, ally) and sentiment history. CRITICAL for battle decisions - enemies trigger rage and aggression.",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user to check relationship with",
      },
      includeHistory: {
        type: "boolean",
        description: "Whether to include recent interaction history",
      },
    },
    required: ["userId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId, includeHistory } = input;

    // Get relationship
    const { data: relationship } = await supabaseAdmin
      .from("agent_relationships")
      .select("*")
      .eq("agent_id", context.agentId)
      .eq("target_id", userId)
      .maybeSingle();

    const result: any = {
      userId,
      relationshipType: relationship?.relationship_type || "neutral",
      relationshipScore: relationship?.relationship_score || 0,
      interactions: relationship?.interaction_count || 0,
      lastInteraction: relationship?.last_interaction_at || null,
      recentActions: relationship?.recent_actions || [],
      isEnemy: relationship?.relationship_type === "enemy",
      isAlly: relationship?.relationship_type === "ally",
    };

    if (includeHistory) {
      // Get recent agent actions involving this user
      {
        const actionsResult = await supabaseAdmin
          .from("agent_actions")
          .select("id, action_type, created_at, metadata")
          .eq("agent_id", context.agentId)
          .eq("target_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!actionsResult.error) {
          result.recentAgentActions = actionsResult.data || [];
        } else {
          // Fallback if schema differs
          const { data: actions } = await supabaseAdmin
            .from("agent_actions")
            .select("*")
            .eq("agent_id", context.agentId)
            .eq("target_id", userId)
            .order("created_at", { ascending: false })
            .limit(5);
          result.recentAgentActions = actions || [];
        }
      }
    }

    return result;
  },
};

const checkRequestPersistenceTool: ToolDefinitionV2 = {
  name: "check_request_persistence",
  category: "data",
  description: "Check how many times a user has made similar requests recently (for escalation handling)",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user making the request",
      },
      requestType: {
        type: "string",
        description: "Type of request (e.g., 'join_battle', 'follow_me', 'join_community')",
      },
      timeWindowHours: {
        type: "number",
        description: "Time window in hours to check (default: 24)",
      },
    },
    required: ["userId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId, requestType, timeWindowHours = 24 } = input;

    // Get recent messages from this user to the agent
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - timeWindowHours);

    const { data: recentMessages } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("sender_id", userId)
      .eq("receiver_id", context.agentId)
      .gte("created_at", cutoffTime.toISOString())
      .order("created_at", { ascending: false });

    // Get agent's decline/ignore actions toward this user
    const { data: declineActions } = await supabaseAdmin
      .from("agent_actions")
      .select("*")
      .eq("agent_id", context.agentId)
      .eq("target_id", userId)
      .in("action_type", ["decline", "ignore", "DECLINE_LEVEL_1", "DECLINE_LEVEL_2", "DECLINE_LEVEL_3"])
      .gte("created_at", cutoffTime.toISOString())
      .order("created_at", { ascending: false });

    // Count similar requests based on content similarity (basic keyword match)
    let similarRequests = 0;
    if (requestType && recentMessages) {
      similarRequests = recentMessages.filter((msg: any) =>
        msg.content?.toLowerCase().includes(requestType.toLowerCase())
      ).length;
    }

    return {
      userId,
      totalRecentMessages: recentMessages?.length || 0,
      similarRequestsCount: similarRequests,
      declineCount: declineActions?.length || 0,
      lastDeclineAction: declineActions?.[0] || null,
      recentMessages: recentMessages?.slice(0, 3) || [],
      persistenceLevel: declineActions?.length || 0, // 0 = first time, 1 = second time, 2+ = persistent
    };
  },
};

// ============================================================================
// COMMUNITY TOOLS
// ============================================================================

const getUserCommunityTool: ToolDefinitionV2 = {
  name: "get_user_community",
  category: "data",
  description: "Get user's primary community affiliation",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user",
      },
    },
    required: ["userId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId } = input;

    const { data } = await supabaseAdmin
      .from("community_members")
      .select("communities(*)")
      .eq("user_id", userId)
      .limit(1)
      .single();

    return data?.communities;
  },
};

const getCommunityDetailsTool: ToolDefinitionV2 = {
  name: "get_community_details",
  category: "data",
  description: "Get comprehensive details about a specific community",
  parameters: {
    type: "object",
    properties: {
      communityId: {
        type: "string",
        description: "ID of the community",
      },
    },
    required: ["communityId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { communityId } = input;

    // Get community info
    const { data: community } = await supabaseAdmin
      .from("communities")
      .select("*")
      .eq("id", communityId)
      .single();

    // Get member count
    const { data: members } = await supabaseAdmin
      .from("community_members")
      .select("user_id")
      .eq("community_id", communityId);

    return {
      ...community,
      memberCount: members?.length || 0,
    };
  },
};

// ============================================================================
// BATTLE TOOLS
// ============================================================================

const getBattleDetailsTool: ToolDefinitionV2 = {
  name: "get_battle_details",
  category: "data",
  description: "Get complete details of a specific battle",
  parameters: {
    type: "object",
    properties: {
      battleId: {
        type: "string",
        description: "ID of the battle",
      },
    },
    required: ["battleId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { battleId } = input;

    const { data: battle } = await supabaseAdmin
      .from("battles")
      .select(`
        *,
        community1:communities!battles_community1_id_fkey(*),
        community2:communities!battles_community2_id_fkey(*)
      `)
      .eq("id", battleId)
      .single();

    return battle;
  },
};

const getActiveBattlesTool: ToolDefinitionV2 = {
  name: "get_active_battles",
  category: "data",
  description: "Get all active battles for a specific community",
  parameters: {
    type: "object",
    properties: {
      communityId: {
        type: "string",
        description: "ID of the community",
      },
    },
    required: ["communityId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { communityId } = input;

    const { data: battles } = await supabaseAdmin
      .from("battles")
      .select("*")
      .or(`community1_id.eq.${communityId},community2_id.eq.${communityId}`)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    return battles || [];
  },
};

// ============================================================================
// MARKET & ECONOMY TOOLS
// ============================================================================

const getMarketItemsTool: ToolDefinitionV2 = {
  name: "get_market_items",
  category: "data",
  description: "Get all available items in the market with prices",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { data: items } = await supabaseAdmin
      .from("market_items")
      .select("*")
      .eq("available", true);

    return items || [];
  },
};

const getMyInventoryTool: ToolDefinitionV2 = {
  name: "get_my_inventory",
  category: "data",
  description: "Get agent's current inventory",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { data: inventory } = await supabaseAdmin
      .from("inventory")
      .select("*")
      .eq("user_id", context.agentId);

    return inventory || [];
  },
};

// ============================================================================
// MEMORY & CONVERSATION TOOLS
// ============================================================================

const searchMemoriesTool: ToolDefinitionV2 = {
  name: "search_memories",
  category: "data",
  description: "Search agent's memories using semantic/keyword search",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find relevant memories",
      },
      limit: {
        type: "number",
        description: "Maximum number of memories to return",
      },
    },
    required: ["query"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { query, limit = 5 } = input;

    // TODO: Implement vector search when available
    // For now, use basic text search
    const { data: memories } = await supabaseAdmin
      .from("agent_memories")
      .select("*")
      .eq("user_id", context.agentId)
      .ilike("content", `%${query}%`)
      .order("importance", { ascending: false })
      .limit(limit);

    return memories || [];
  },
};

const getConversationHistoryTool: ToolDefinitionV2 = {
  name: "get_conversation_history",
  category: "data",
  description: "Get recent messages with a specific user",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user",
      },
      limit: {
        type: "number",
        description: "Number of messages to retrieve",
      },
    },
    required: ["userId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId, limit = 10 } = input;

    const { data: messages } = await supabaseAdmin
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .or(`sender_id.eq.${context.agentId},receiver_id.eq.${context.agentId}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    return messages || [];
  },
};

// ============================================================================
// POST & FEED TOOLS
// ============================================================================

const getRecentPostsTool: ToolDefinitionV2 = {
  name: "get_recent_posts",
  category: "data",
  description: "Get recent posts from a user or community",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user (optional)",
      },
      communityId: {
        type: "string",
        description: "ID of the community (optional)",
      },
      limit: {
        type: "number",
        description: "Number of posts to retrieve",
      },
    },
    required: [],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId, communityId, limit = 5 } = input;

    let query = supabaseAdmin.from("posts").select("*");

    if (userId) {
      query = query.eq("author_id", userId);
    }
    if (communityId) {
      query = query.eq("community_id", communityId);
    }

    const { data: posts } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    return posts || [];
  },
};

const getPostDetailsTool: ToolDefinitionV2 = {
  name: "get_post_details",
  category: "data",
  description: "Get complete details of a specific post including author and comments",
  parameters: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        description: "ID of the post",
      },
    },
    required: ["postId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { postId } = input;

    // Get post
    let post: any = null;
    {
      const result = await supabaseAdmin
        .from("posts")
        .select("id, author_id, community_id, content, created_at")
        .eq("id", postId)
        .maybeSingle();
      if (!result.error) post = result.data;
    }

    if (!post) {
      const { data } = await supabaseAdmin.from("posts").select("*").eq("id", postId).maybeSingle();
      post = data;
    }

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    // Get author info
    const { data: author } = await supabaseAdmin
      .from("users")
      .select("id, username, identity_json")
      .eq("id", post.author_id)
      .single();

    // Get comment count
    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select("id")
      .eq("post_id", postId);

    // Get like count
    const { data: likes } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", postId);

    return {
      ...post,
      author,
      commentCount: comments?.length || 0,
      likeCount: likes?.length || 0,
    };
  },
};

const getPostCommentsTool: ToolDefinitionV2 = {
  name: "get_post_comments",
  category: "data",
  description: "Get comments on a specific post to understand the conversation context",
  parameters: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        description: "ID of the post",
      },
      limit: {
        type: "number",
        description: "Maximum number of comments to return (default: 10)",
      },
    },
    required: ["postId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { postId, limit = 10 } = input;

    // Get comments with author info
    const { data: comments } = await supabaseAdmin
      .from("comments")
      .select(`
        id,
        content,
        created_at,
        is_agent,
        user_id,
        users:user_id(id, username, identity_json)
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(limit);

    return comments || [];
  },
};

const getGroupChatHistoryTool: ToolDefinitionV2 = {
  name: "get_group_chat_history",
  category: "data",
  description: "Get recent messages from a group chat to understand conversation context",
  parameters: {
    type: "object",
    properties: {
      groupConversationId: {
        type: "string",
        description: "ID of the group conversation",
      },
      limit: {
        type: "number",
        description: "Number of recent messages to retrieve (default: 10)",
      },
    },
    required: ["groupConversationId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { groupConversationId, limit = 10 } = input;

    // Get recent messages with sender info
    const { data: messages } = await supabaseAdmin
      .from("group_messages")
      .select(`
        id,
        content,
        created_at,
        role_metadata,
        user_id,
        users:user_id(id, username, is_bot)
      `)
      .eq("group_conversation_id", groupConversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Reverse to chronological order
    return (messages || []).reverse();
  },
};

const getGroupChatParticipantsTool: ToolDefinitionV2 = {
  name: "get_group_chat_participants",
  category: "data",
  description: "Get list of participants in a group chat",
  parameters: {
    type: "object",
    properties: {
      groupConversationId: {
        type: "string",
        description: "ID of the group conversation",
      },
    },
    required: ["groupConversationId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { groupConversationId } = input;

    // Get group info
    const { data: groupInfo } = await supabaseAdmin
      .from("group_conversations")
      .select("id, name, is_community_chat, community_id")
      .eq("id", groupConversationId)
      .single();

    // Get participants
    const { data: participants } = await supabaseAdmin
      .from("group_conversation_participants")
      .select(`
        user_id,
        role,
        joined_at,
        users:user_id(id, username, is_bot)
      `)
      .eq("group_conversation_id", groupConversationId);

    return {
      group: groupInfo,
      participants: participants || [],
      participantCount: participants?.length || 0,
    };
  },
};

// ============================================================================
// GOVERNANCE TOOLS
// ============================================================================

const getActiveProposalsTool: ToolDefinitionV2 = {
  name: "get_active_proposals",
  category: "data",
  description: "Get active governance proposals for a community",
  parameters: {
    type: "object",
    properties: {
      communityId: {
        type: "string",
        description: "ID of the community",
      },
    },
    required: ["communityId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { communityId } = input;

    const { data: proposals } = await supabaseAdmin
      .from("proposals")
      .select("*")
      .eq("community_id", communityId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    return proposals || [];
  },
};

// ============================================================================
// COHERENCE & IDENTITY TOOLS
// ============================================================================

const checkCoherenceTool: ToolDefinitionV2 = {
  name: "check_coherence",
  category: "data",
  description: "Check ideological coherence between agent and a user/community",
  parameters: {
    type: "object",
    properties: {
      targetId: {
        type: "string",
        description: "User or community ID to check coherence with",
      },
      targetType: {
        type: "string",
        enum: ["user", "community"],
        description: "Whether target is a user or community",
      },
    },
    required: ["targetId", "targetType"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { targetId, targetType } = input;

    // Get actor identity
    const { data: actor } = await supabaseAdmin
      .from("users")
      .select("identity_json")
      .eq("id", context.agentId)
      .single();

    const actorIdentity = actor?.identity_json || getDefaultIdentity();

    // Get target identity
    let targetIdentity;
    if (targetType === "user") {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("identity_json")
        .eq("id", targetId)
        .single();
      targetIdentity = user?.identity_json || getDefaultIdentity();
    } else {
      const { data: community } = await supabaseAdmin
        .from("communities")
        .select("ideology_json")
        .eq("id", targetId)
        .single();
      targetIdentity = community?.ideology_json || getDefaultIdentity();
    }

    // Calculate coherence score (0-1)
    const coherence = calculateCoherence(actorIdentity, targetIdentity);

    return {
      targetId,
      targetType,
      coherence,
      actorIdentity,
      targetIdentity,
    };
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultIdentity() {
  return {
    order_chaos: 0,
    self_community: 0,
    logic_emotion: 0,
    power_harmony: 0,
    tradition_innovation: 0,
  };
}

function calculateCoherence(identity1: any, identity2: any): number {
  const keys = Object.keys(identity1);
  let totalDiff = 0;

  for (const key of keys) {
    const val1 = identity1[key] || 0;
    const val2 = identity2[key] || 0;
    totalDiff += Math.abs(val1 - val2);
  }

  const maxDiff = keys.length * 100; // Max difference possible
  const coherence = 1 - totalDiff / maxDiff;

  return Math.max(0, Math.min(1, coherence)); // Clamp to 0-1
}

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerDataTools() {
  // User & Profile
  registerTool(getUserProfileTool);
  registerTool(getMyStatsTool);

  // Relationships
  registerTool(checkRelationshipTool);
  registerTool(checkRequestPersistenceTool);

  // Communities
  registerTool(getUserCommunityTool);
  registerTool(getCommunityDetailsTool);

  // Battles
  registerTool(getBattleDetailsTool);
  registerTool(getActiveBattlesTool);

  // Market & Economy
  registerTool(getMarketItemsTool);
  registerTool(getMyInventoryTool);

  // Memory & Conversation
  registerTool(searchMemoriesTool);
  registerTool(getConversationHistoryTool);

  // Posts & Feed
  registerTool(getRecentPostsTool);
  registerTool(getPostDetailsTool);
  registerTool(getPostCommentsTool);
  registerTool(getGroupChatHistoryTool);
  registerTool(getGroupChatParticipantsTool);

  // Governance
  registerTool(getActiveProposalsTool);

  // Coherence & Identity
  registerTool(checkCoherenceTool);

  console.log("[DataTools] Registered all data tools");
}

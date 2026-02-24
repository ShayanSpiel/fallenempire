/**
 * OBSERVE NODE - MINIMAL CONTEXT
 * Gathers ONLY essential situational awareness (who, what, when)
 * NO pre-fetching of data - that's done by AI via tools during reasoning
 */

import type { WorkflowState } from "../core/types";
import { supabaseAdmin } from "../../supabaseAdmin";
import { startNodeTrace, endNodeTrace } from "../tracing/langsmith";

export async function observeNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const startTime = Date.now();
  const nodeTraceId = await startNodeTrace("observe", state);

  try {
    // 1. Get basic actor state (identity, morale, energy, etc.)
    const actorData = await fetchActorState(state.scope.actor.id);

    // 2. Check community membership if this is a post/comment mention
    const communityContext = await fetchCommunityContext(state);

    // 3. Build minimal context summary
    const contextSummary = buildMinimalContextSummary(state, communityContext);

    console.log(`[Observe] Minimal observation complete for ${state.scope.actor.id}`);
    console.log(`[Observe] Trigger: ${state.scope.trigger.type}:${state.scope.trigger.event || state.scope.trigger.schedule}`);
    console.log(`[Observe] Actor state: morale=${actorData.morale}, energy=${actorData.energy}, heat=${actorData.heat}, rage=${actorData.rage}`);
    console.log(`[Observe] Subject: ${state.scope.subject ? `${state.scope.subject.type}:${state.scope.subject.id}` : 'none'}`);
    console.log(`[Observe] Feed: ${communityContext.feedType}`);
    console.log(`[Observe] Subject data:`, JSON.stringify(state.scope.subject?.data || {}, null, 2));
    if (communityContext.communityId && communityContext.feedType === "community") {
      console.log(`[Observe] Community: ${communityContext.communityName}, isMember=${communityContext.isMember}, mentionerIsMember=${communityContext.mentionerIsMember}`);
    }
    console.log(`[Observe] Context summary length: ${contextSummary.length} chars`);

    // End node trace
    endNodeTrace(nodeTraceId, {
      context_summary_length: contextSummary.length,
      context_summary: contextSummary,
      actor_morale: actorData.morale,
      actor_heat: actorData.heat,
    });

    return {
      step: "reason",
      observation: {
        posts: [], // Empty - will be fetched by AI if needed
        messages: [], // Empty - will be fetched by AI if needed
        memories: [], // Empty - will be fetched by AI if needed
        relationships: {}, // Empty - will be fetched by AI if needed
        communities: [], // Empty - will be fetched by AI if needed
        contextSummary,
        timestamp: new Date(),
      },
      actorIdentity: actorData.identity,
      actorMorale: actorData.morale,
      actorCoherence: actorData.coherence,
      actorHeat: actorData.heat,
      actorRage: actorData.rage,
      actorCommunityId: actorData.communityId,
      metadata: {
        ...state.metadata,
        mentalPower: actorData.mentalPower,
        freewill: actorData.freewill,
        energy: actorData.energy,
        observeTime: Date.now() - startTime,
      },
    };
  } catch (error: any) {
    console.error(`[Observe] Error during observation:`, error);
    endNodeTrace(nodeTraceId, {}, error.message);
    return {
      step: "complete",
      errors: [
        ...state.errors,
        {
          step: "observe",
          error: error.message,
          timestamp: new Date(),
        },
      ],
    };
  }
}

/**
 * Fetch minimal actor state (identity, morale, etc.)
 * This is the ONLY data we pre-fetch
 */
async function fetchActorState(actorId: string) {
  // Try with full column set first, fall back to minimal if needed
  let actor: any = null;
  let error: any = null;

  {
    const result = await supabaseAdmin
      .from("users")
      .select(
        "id, identity_json, morale, energy, mental_power, power_mental, freewill, coherence, rage, main_community_id"
      )
      .eq("id", actorId)
      .maybeSingle();
    actor = result.data;
    error = result.error;
  }

  // If specific column error, try with minimal safe columns
  if (error && error.code === "42703") {
    console.warn(`[Observe] Column error, retrying with minimal columns:`, error.message);
    {
      const result = await supabaseAdmin
        .from("users")
        .select("id, identity_json, morale, coherence")
        .eq("id", actorId)
        .maybeSingle();

      actor = result.data;
      error = result.error;
    }
  }

  if (error) {
    console.error(`[Observe] Supabase error fetching actor ${actorId}:`, error);
    throw new Error(`Actor fetch failed: ${error.message} (${error.code})`);
  }

  if (!actor) {
    console.error(`[Observe] Actor returned null for ID: ${actorId}`);
    throw new Error(`Actor not found: ${actorId}`);
  }

  return {
    identity: actor.identity_json || getDefaultIdentity(),
    morale: actor.morale ?? 50,
    coherence: actor.coherence ?? 50,
    heat: 0, // Heat is not stored in database, always 0
    energy: (actor as any).energy ?? 50,
    health: (actor as any).health ?? 100,
    mentalPower: (actor as any).mental_power || (actor as any).power_mental || 50,
    freewill: (actor as any).freewill ?? 50,
    rage: (actor as any).rage ?? 0,
    communityId: (actor as any).main_community_id ?? null,
  };
}

/**
 * Fetch community context if this is a community post/comment mention
 */
async function fetchCommunityContext(state: WorkflowState): Promise<{
  communityId: string | null;
  communityName: string | null;
  isMember: boolean;
  mentionerIsMember: boolean;
  feedType: string;
}> {
  const subject = state.scope.subject;
  const feed_type =
    subject?.data?.feed_type ||
    (subject?.data?.conversation_type === "direct" ? "direct" : "world");
  const community_id = subject?.data?.community_id;

  // Not a community post
  if (!subject || subject.type !== "post" || feed_type !== "community" || !community_id) {
    return {
      communityId: null,
      communityName: null,
      isMember: false,
      mentionerIsMember: false,
      feedType: feed_type,
    };
  }

  // Fetch community name
  const { data: community } = await supabaseAdmin
    .from("communities")
    .select("name")
    .eq("id", community_id)
    .maybeSingle();

  // Check if agent is a member
  const { data: agentMembership } = await supabaseAdmin
    .from("community_members")
    .select("id")
    .eq("community_id", community_id)
    .eq("user_id", state.scope.actor.id)
    .maybeSingle();

  // Check if mentioner is a member
  const mentionerId = subject.data?.mentioner_id;
  let mentionerIsMember = false;
  if (mentionerId) {
    const { data: mentionerMembership } = await supabaseAdmin
      .from("community_members")
      .select("id")
      .eq("community_id", community_id)
      .eq("user_id", mentionerId)
      .maybeSingle();
    mentionerIsMember = !!mentionerMembership;
  }

  return {
    communityId: community_id,
    communityName: community?.name || "Unknown Community",
    isMember: !!agentMembership,
    mentionerIsMember,
    feedType: feed_type,
  };
}

/**
 * Build minimal context summary - just the trigger facts
 * NO data fetching, just describe what happened
 */
function buildMinimalContextSummary(state: WorkflowState, communityContext: {
  communityId: string | null;
  communityName: string | null;
  isMember: boolean;
  mentionerIsMember: boolean;
  feedType: string;
}): string {
  const trigger = state.scope.trigger;
  const subject = state.scope.subject;

  const lines = [
    "=== SITUATION ===",
    "",
    `TRIGGER: ${trigger.type}:${trigger.event || trigger.schedule}`,
    `TIME: ${trigger.timestamp.toISOString()}`,
    `FEED: ${communityContext.feedType.toUpperCase()}`,
    "",
  ];

  // Add feed-specific context
  if (subject?.data?.conversation_type === "direct") {
    lines.push("=== DIRECT MESSAGE ===");
    lines.push("This is a private one-on-one chat.");
    lines.push("Respond using direct message tools.");
    lines.push("");
  } else if (communityContext.feedType === "world" && subject?.type === "post") {
    lines.push("=== WORLD FEED ===");
    lines.push("This is a PUBLIC post visible to everyone.");
    lines.push("Anyone can see and interact with this post.");
    lines.push("");
  } else if (communityContext.feedType === "followers" && subject?.type === "post") {
    lines.push("=== FOLLOWERS FEED ===");
    lines.push("This is a FRIENDS-ONLY post visible only to followers.");
    lines.push("Only people following the poster can see this.");
    lines.push("");
  }

  // Add community context if it's a community post
  if (communityContext.communityId && communityContext.feedType === "community") {
    lines.push("=== COMMUNITY CONTEXT ===");
    lines.push(`COMMUNITY: ${communityContext.communityName} (ID: ${communityContext.communityId})`);
    if (communityContext.isMember) {
      lines.push("⭐ YOU ARE A MEMBER OF THIS COMMUNITY");
      if (communityContext.mentionerIsMember) {
        lines.push("⭐ THE PERSON WHO MENTIONED YOU IS ALSO A MEMBER");
        lines.push("");
        lines.push("IMPORTANT: This is your COMMUNITY MEMBER asking for help.");
        lines.push("As a community member, you should:");
        lines.push("  - Prioritize helping fellow members");
        lines.push("  - Consider community goals and battles");
        lines.push("  - If declining, give a SPECIFIC reason related to:");
        lines.push("    * Disagreement with community strategy");
        lines.push("    * Personal conflict with leadership");
        lines.push("    * Low morale or energy preventing participation");
        lines.push("    * Political/ideological differences");
        lines.push("  - DO NOT use generic excuses like 'other priorities'");
      } else {
        lines.push("⚠️ The person who mentioned you is NOT a member");
      }
    } else {
      lines.push("ℹ️ You are NOT a member of this community");
      if (communityContext.mentionerIsMember) {
        lines.push("ℹ️ The person who mentioned you IS a member");
      }
    }
    lines.push("");
  }

  // Add subject info if available
  if (subject) {
    lines.push(`SUBJECT TYPE: ${subject.type}`);
    lines.push(`SUBJECT ID: ${subject.id}`);

    // Add subject data if available (from trigger)
    if (subject.data) {
      // Handle comment mentions specially
      if (subject.data.is_comment_mention && subject.data.comment_id) {
        lines.push(`MENTION TYPE: Comment on a post`);
        lines.push(`COMMENT ID: ${subject.data.comment_id}`);
        lines.push(`POST ID: ${subject.id}`);
        if (subject.data.content) {
          lines.push(`COMMENT CONTENT: "${subject.data.content.substring(0, 100)}${subject.data.content.length > 100 ? '...' : ''}"`);
        }
        if (subject.data.mentioner_username) {
          lines.push(`MENTIONED BY: @${subject.data.mentioner_username} (ID: ${subject.data.mentioner_id})`);
        } else if (subject.data.mentioner_id) {
          lines.push(`MENTIONED BY: ${subject.data.mentioner_id}`);
        }
        lines.push("");
        lines.push("TIP: Use get_post_details and get_post_comments to understand the full conversation context");
        lines.push("IMPORTANT: When responding with a comment, @ mention the person back using @username");
      }
      // Handle group chat mentions
      else if (subject.data.conversation_type === "group" && subject.data.group_conversation_id) {
        lines.push(`MENTION TYPE: Group chat message`);
        lines.push(`GROUP CHAT ID: ${subject.data.group_conversation_id}`);
        if (subject.data.content) {
          lines.push(`MESSAGE: "${subject.data.content.substring(0, 100)}${subject.data.content.length > 100 ? '...' : ''}"`);
        }
        if (subject.data.sender_username) {
          lines.push(`FROM: @${subject.data.sender_username} (ID: ${subject.data.sender_id})`);
        } else if (subject.data.sender_id) {
          lines.push(`FROM USER: ${subject.data.sender_id}`);
        }
        lines.push("");
        lines.push("TIP: Use get_group_chat_history and get_group_chat_participants to see who's in the chat and understand context");
        lines.push("IMPORTANT: When responding in a group chat, @ mention people by username using @username");
      }
      // Handle DM mentions
      else if (subject.data.conversation_type === "direct") {
        lines.push(`MENTION TYPE: Direct message`);
        if (subject.data.content) {
          lines.push(`MESSAGE: "${subject.data.content.substring(0, 100)}${subject.data.content.length > 100 ? '...' : ''}"`);
        }
        if (subject.data.sender_username) {
          lines.push(`FROM: @${subject.data.sender_username} (ID: ${subject.data.sender_id})`);
        } else if (subject.data.sender_id) {
          lines.push(`FROM USER: ${subject.data.sender_id}`);
        }
      }
      // Handle regular post mentions and chat events
      else {
        if (subject.data.content) {
          lines.push(`CONTENT: "${subject.data.content.substring(0, 100)}${subject.data.content.length > 100 ? '...' : ''}"`);
        }
        if (subject.data.sender_username) {
          lines.push(`FROM: @${subject.data.sender_username} (ID: ${subject.data.sender_id})`);
        } else if (subject.data.sender_id) {
          lines.push(`FROM USER: ${subject.data.sender_id}`);
        }
        if (subject.data.author_id) {
          lines.push(`AUTHOR: ${subject.data.author_id}`);
        }
        if (subject.data.mentioner_username) {
          lines.push(`MENTIONED BY: @${subject.data.mentioner_username} (ID: ${subject.data.mentioner_id})`);
        } else if (subject.data.mentioner_id) {
          lines.push(`MENTIONED BY: ${subject.data.mentioner_id}`);
        }
        if (subject.data.is_comment_mention === false) {
          lines.push("");
          lines.push("IMPORTANT: When responding to a post mention, add a comment using the 'comment' tool and @ mention the person using @username");
        }
      }
    }
    lines.push("");
  }

  lines.push("AVAILABLE ACTIONS:");
  lines.push("  - Use data tools to gather context (get_user_profile, check_relationship, get_battle_details, etc.)");
  lines.push("  - Use action tools to respond (send_message, join_battle, buy_item, etc.)");
  lines.push("  - Analyze and decide what to do based on your identity and goals");

  return lines.join("\n");
}

/**
 * Get default identity vector
 */
function getDefaultIdentity() {
  return {
    order_chaos: 0,
    self_community: 0,
    logic_emotion: 0,
    power_harmony: 0,
    tradition_innovation: 0,
  };
}

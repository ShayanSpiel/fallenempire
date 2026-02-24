/**
 * EVENT TRIGGER HANDLER
 * Handles incoming events and executes workflows
 * Events: chat, comment, mention, post, law_proposal, battle, etc.
 */

import type { EventType } from "../core/types";
import { executeUniversalWorkflow, createInitialState, ensureInitialized } from "../index";
import { supabaseAdmin } from "../../supabaseAdmin";

// Initialize AI system on module load
ensureInitialized();

// ============================================================================
// EVENT HANDLERS
// ============================================================================

export async function handleChatEvent(context: {
  agentId: string;
  userId: string;
  message: string;
  conversationId: string;
  isResponse?: boolean;
}) {
  console.log(`[Event] Chat message from ${context.userId} to agent ${context.agentId}`);

  try {
    // Fetch sender's username for context
    const { data: sender } = await supabaseAdmin
      .from("users")
      .select("username")
      .eq("id", context.userId)
      .single();

    const senderUsername = sender?.username || "unknown_user";

    const scope = {
      trigger: {
        type: "event" as const,
        event: "chat" as const,
        timestamp: new Date(),
        isResponse: context.isResponse,
      },
      actor: {
        id: context.agentId,
        type: "agent" as const,
      },
      subject: {
        id: context.userId,
        type: "user" as const,
        data: {
          content: context.message,
          sender_id: context.userId,
          sender_username: senderUsername,
          conversation_type: "direct",
          feed_type: "direct",
        },
      },
      dataScope: {},
      conversationId: context.conversationId,
    };

    const result = await executeUniversalWorkflow(createInitialState(scope));

    return {
      success: result.errors.length === 0,
      actions: result.executedActions,
      duration: new Date().getTime() - result.startTime.getTime(),
      errors: result.errors,
    };
  } catch (error: any) {
    console.error("[Event] Chat handler error:", error);
    throw error;
  }
}

export async function handleCommentEvent(context: {
  postId: string;
  agentId: string;
  commenterId: string;
  commentText?: string;
  isResponse?: boolean;
}) {
  console.log(`[Event] Comment on post ${context.postId} from ${context.commenterId}`);

  try {
    const scope = {
      trigger: {
        type: "event" as const,
        event: "comment" as const,
        timestamp: new Date(),
        isResponse: context.isResponse,
      },
      actor: {
        id: context.agentId,
        type: "agent" as const,
      },
      subject: {
        id: context.postId,
        type: "post" as const,
        data: { commenterId: context.commenterId, content: context.commentText },
      },
      dataScope: {},
    };

    const result = await executeUniversalWorkflow(createInitialState(scope));

    return {
      success: result.errors.length === 0,
      actions: result.executedActions,
      duration: new Date().getTime() - result.startTime.getTime(),
      errors: result.errors,
    };
  } catch (error: any) {
    console.error("[Event] Comment handler error:", error);
    throw error;
  }
}

export async function handleMentionEvent(context: {
  mentionedAgentId: string;
  mentionerUserId: string;
  // Context type - determines how the mention is handled
  postId?: string;          // For post mentions AND comment mentions
  commentId?: string;       // For comment mentions (distinguishes from post mentions)
  conversationId?: string;  // For DM mentions
  groupConversationId?: string; // For group chat mentions
  messageId?: string;       // For message mentions (DM or group)
  messageContent?: string;  // Message content (for DMs and groups)
  mentionText?: string;     // Mention text (for posts and comments)
  isResponse?: boolean;
}) {
  console.log(`[Event] Agent ${context.mentionedAgentId} mentioned by ${context.mentionerUserId}`);

  try {
    // Fetch mentioner's username for context
    const { data: mentioner } = await supabaseAdmin
      .from("users")
      .select("username")
      .eq("id", context.mentionerUserId)
      .single();

    const mentionerUsername = mentioner?.username || "unknown_user";

    // Determine the subject based on context type
    let subjectId: string;
    let subjectType: "post" | "user" | "message";
    let subjectData: Record<string, any>;
    let conversationId: string | undefined;

    if (context.postId && context.commentId) {
      // Comment mention on a post - fetch feed context
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("feed_type, community_id")
        .eq("id", context.postId)
        .maybeSingle();

      subjectId = context.postId;
      subjectType = "post";
      subjectData = {
        mentioner_id: context.mentionerUserId,
        mentioner_username: mentionerUsername,
        content: context.mentionText,
        comment_id: context.commentId,
        is_comment_mention: true,
        feed_type: post?.feed_type || "world",
        community_id: post?.community_id || null,
      };
    } else if (context.postId) {
      // Post mention (original post, not a comment) - fetch feed context
      const { data: post } = await supabaseAdmin
        .from("posts")
        .select("feed_type, community_id")
        .eq("id", context.postId)
        .maybeSingle();

      subjectId = context.postId;
      subjectType = "post";
      subjectData = {
        mentioner_id: context.mentionerUserId,
        mentioner_username: mentionerUsername,
        content: context.mentionText,
        is_comment_mention: false,
        feed_type: post?.feed_type || "world",
        community_id: post?.community_id || null,
      };
    } else if (context.conversationId) {
      // DM mention
      subjectId = context.mentionerUserId;
      subjectType = "user";
      subjectData = {
        content: context.messageContent,
        message_id: context.messageId,
        sender_id: context.mentionerUserId,
        sender_username: mentionerUsername,
        conversation_type: "direct"
      };
      conversationId = context.conversationId;
    } else if (context.groupConversationId) {
      // Group chat mention
      subjectId = context.mentionerUserId;
      subjectType = "user";
      subjectData = {
        content: context.messageContent,
        message_id: context.messageId,
        sender_id: context.mentionerUserId,
        sender_username: mentionerUsername,
        group_conversation_id: context.groupConversationId,
        conversation_type: "group"
      };
      conversationId = context.groupConversationId;
    } else {
      throw new Error("Invalid mention context - must have postId, conversationId, or groupConversationId");
    }

    const scope = {
      trigger: {
        type: "event" as const,
        event: "mention" as const,
        timestamp: new Date(),
        isResponse: context.isResponse,
      },
      actor: {
        id: context.mentionedAgentId,
        type: "agent" as const,
      },
      subject: {
        id: subjectId,
        type: subjectType,
        data: subjectData,
      },
      dataScope: {},
      conversationId,
    };

    const result = await executeUniversalWorkflow(createInitialState(scope));

    return {
      success: result.errors.length === 0,
      actions: result.executedActions,
      duration: new Date().getTime() - result.startTime.getTime(),
      errors: result.errors,
    };
  } catch (error: any) {
    console.error("[Event] Mention handler error:", error);
    throw error;
  }
}

export async function handlePostEvent(context: {
  postId: string;
  authorId: string;
  content: string;
  communityId?: string;
}) {
  console.log(`[Event] New post ${context.postId} from ${context.authorId}`);

  // For now, posts don't trigger agent workflows directly
  // But they're observed in other workflows
  return { success: true };
}

export async function handleLawProposalEvent(context: {
  proposalId: string;
  communityId: string;
  proposerId: string;
  content: string;
}) {
  console.log(`[Event] Law proposal in community ${context.communityId}`);

  // TODO: Implement governance workflow
  return { success: true };
}

export async function handleBattleEvent(context: {
  battleId: string;
  attackerCommunityId: string;
  defenderCommunityId: string;
  type: string;
}) {
  console.log(`[Event] Battle between ${context.attackerCommunityId} and ${context.defenderCommunityId}`);

  // TODO: Implement battle response workflow
  return { success: true };
}

// ============================================================================
// EVENT ROUTER
// ============================================================================

type EventHandler = (context: Record<string, any>) => Promise<any>;

const EVENT_HANDLERS: Record<EventType, EventHandler> = {
  chat: handleChatEvent as EventHandler,
  comment: handleCommentEvent as EventHandler,
  mention: handleMentionEvent as EventHandler,
  post: handlePostEvent as EventHandler,
  law_proposal: handleLawProposalEvent as EventHandler,
  battle: handleBattleEvent as EventHandler,
  relationship_change: async () => ({ success: true }), // Not implemented yet
};

export async function handleEvent(
  eventType: EventType,
  context: Record<string, any>
): Promise<any> {
  const handler = EVENT_HANDLERS[eventType];

  if (!handler) {
    throw new Error(`Unknown event type: ${eventType}`);
  }

  return handler(context);
}

/**
 * Register a custom event handler
 */
export function registerEventHandler(
  eventType: EventType,
  handler: EventHandler
): void {
  EVENT_HANDLERS[eventType] = handler;
  console.log(`[Events] Registered handler for event: ${eventType}`);
}

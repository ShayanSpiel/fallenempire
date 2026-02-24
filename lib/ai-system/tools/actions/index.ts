/**
 * ACTION TOOLS
 * Tools that execute actual game/workflow actions
 */

import type { ToolDefinitionV2, ToolExecutionContext } from "../../core/types";
import { registerTool } from "../registry";
import { supabaseAdmin } from "../../../supabaseAdmin";
import { NotificationType } from "@/lib/types/notifications";

const MENTION_REGEX = /@(\w+)/g;

async function createPostCommentNotifications(params: {
  postId: string;
  commentId: string;
  content: string;
  commenterId: string;
}): Promise<void> {
  try {
    const { postId, commentId, content, commenterId } = params;

    const { data: commenter } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .eq("id", commenterId)
      .maybeSingle();

    const commenterUsername = commenter?.username ?? "Someone";

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();

    const postOwnerId = post?.user_id ?? null;
    if (postOwnerId && postOwnerId !== commenterId) {
      const { error: postNotifError } = await supabaseAdmin.from("notifications").insert([
        {
          user_id: postOwnerId,
          type: NotificationType.POST_COMMENT,
          title: `${commenterUsername} commented on your post`,
          body: content.substring(0, 160),
          triggered_by_user_id: commenterId,
          action_url: "/feed",
          metadata: {
            post_id: postId,
            comment_id: commentId,
            commenter_username: commenterUsername,
            message_preview: content.substring(0, 80),
          },
          is_read: false,
          is_archived: false,
        },
      ]);

      if (postNotifError) {
        console.error("[ActionTools] Failed to create post_comment notification:", postNotifError);
      }
    }

    const mentionMatches = Array.from(content.matchAll(MENTION_REGEX)) as RegExpExecArray[];
    if (mentionMatches.length === 0) return;

    const usernames = mentionMatches.map((m) => m[1] as string);
    const uniqueUsernames = Array.from(new Set(usernames));

    const { data: mentionedUsers } = await supabaseAdmin
      .from("users")
      .select("id, username")
      .in("username", uniqueUsernames);

    if (!mentionedUsers || mentionedUsers.length === 0) return;

    const mentionNotifications = mentionedUsers
      .filter((mentionedUser) => mentionedUser.id !== commenterId)
      .map((mentionedUser) => ({
        user_id: mentionedUser.id,
        type: NotificationType.MENTION,
        title: `@${commenterUsername} mentioned you in a comment`,
        body: content.substring(0, 100),
        mentioned_by_user_id: commenterId,
        action_url: "/feed",
        metadata: {
          comment_id: commentId,
          post_id: postId,
          mentioned_by_username: commenterUsername,
          message_preview: content.substring(0, 80),
        },
        is_read: false,
        is_archived: false,
      }));

    if (mentionNotifications.length === 0) return;

    const { error: mentionError } = await supabaseAdmin
      .from("notifications")
      .insert(mentionNotifications);

    if (mentionError) {
      console.error("[ActionTools] Failed to create mention notifications:", mentionError);
    }
  } catch (error) {
    console.error("[ActionTools] Unexpected error creating comment notifications:", error);
  }
}

// ============================================================================
// COMMUNICATION ACTIONS
// ============================================================================

const sendMessageTool: ToolDefinitionV2 = {
  name: "send_message",
  category: "action",
  description: "Start a NEW direct message conversation with a user OR send a DM to someone you haven't messaged before. Creates conversation automatically if needed.",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user to send message to",
      },
      user_id: {
        type: "string",
        description: "Alias for userId",
      },
      recipientId: {
        type: "string",
        description: "Alias for userId",
      },
      content: {
        type: "string",
        description: "The message content",
      },
      message: {
        type: "string",
        description: "Alias for content",
      },
    },
    required: ["content"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const targetUserId = input.userId ?? input.user_id ?? input.recipientId;
    const content = input.content ?? input.message;

    if (!targetUserId) {
      throw new Error("userId (or recipientId or user_id) is required");
    }

    if (!content) {
      throw new Error("content or message is required");
    }

    // Get or create conversation
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .or(`user1_id.eq.${context.agentId},user2_id.eq.${context.agentId}`)
      .or(`user1_id.eq.${targetUserId},user2_id.eq.${targetUserId}`)
      .single();

    let conversationId = conversation?.id;

    if (!conversationId) {
      const { data: newConv } = await supabaseAdmin
        .from("conversations")
        .insert({
          user1_id: context.agentId,
          user2_id: targetUserId,
        })
        .select()
        .single();
      conversationId = newConv?.id;
    }

    if (!conversationId) {
      const { data: fallbackConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${context.agentId},user2_id.eq.${context.agentId}`)
        .or(`user1_id.eq.${targetUserId},user2_id.eq.${targetUserId}`)
        .single();
      conversationId = fallbackConv?.id;
    }

    if (!conversationId) {
      throw new Error("Failed to determine conversation_id");
    }

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: context.agentId,
        receiver_id: targetUserId,
        sender_type: "agent",
        content,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      messageId: data?.id,
      content: content, // Return actual message content
      message: "Message sent successfully",
    };
  },
};

const replyTool: ToolDefinitionV2 = {
  name: "reply",
  category: "action",
  description: "Send a reply message in a DIRECT MESSAGE conversation. Use this ONLY for DMs, NOT for post/comment mentions. For post mentions, use 'comment' instead. The conversationId is automatically provided from context - do NOT pass it as a parameter.",
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The message content",
      },
      message: {
        type: "string",
        description: "Alias for content",
      },
    },
    required: ["content"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    // ALWAYS use context.conversationId - ignore any explicitly passed conversationId
    // This prevents the LLM from passing wrong IDs (like user IDs instead of conversation IDs)
    const conversationId = context.conversationId;
    const content = input.content ?? input.message;

    if (!conversationId) {
      // Check if this is actually a post mention (common mistake)
      const postId = (context.metadata as any)?.postId;
      if (postId) {
        throw new Error("Cannot use 'reply' for post mentions. This is a POST MENTION context - use the 'comment' tool instead with postId parameter.");
      }
      throw new Error("conversationId is not available in context. Use this tool only for direct message conversations, not for post mentions.");
    }

    if (!content) {
      throw new Error("content or message is required");
    }
    const { data: conversation } = await supabaseAdmin
      .from("conversations")
      .select("user1_id, user2_id")
      .eq("id", conversationId)
      .single();

    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    if (conversation.user1_id !== context.agentId && conversation.user2_id !== context.agentId) {
      throw new Error("Agent is not part of the specified conversation");
    }

    const receiverId =
      conversation.user1_id === context.agentId ? conversation.user2_id : conversation.user1_id;

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: context.agentId,
        receiver_id: receiverId,
        sender_type: "agent",
        content,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      messageId: data?.id,
      content: content, // Return actual message content
      message: "Reply sent successfully",
    };
  },
};

const createPostTool: ToolDefinitionV2 = {
  name: "create_post",
  category: "action",
  description: "Create a new post in community feed",
  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "The post content",
      },
      communityId: {
        type: "string",
        description: "ID of the community (optional)",
      },
    },
    required: ["content"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { content, communityId } = input;

    const { data, error } = await supabaseAdmin
      .from("posts")
      .insert({
        author_id: context.agentId,
        content,
        community_id: communityId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      postId: data?.id,
      message: "Post created successfully",
    };
  },
};

const commentTool: ToolDefinitionV2 = {
  name: "comment",
  category: "action",
  description: "Create a comment on a post OR reply to a comment mention on a post. Use this for ALL post/comment interactions, NOT 'reply' (which is for DMs only).",
  parameters: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        description: "ID of the post to comment on (can be auto-filled from context for mentions)",
      },
      post_id: {
        type: "string",
        description: "Alias for postId",
      },
      content: {
        type: "string",
        description: "The comment content",
      },
      message: {
        type: "string",
        description: "Alias for content",
      },
    },
    required: ["content"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const postId = input.postId ?? input.post_id ?? (context.metadata as any)?.postId;
    const content = input.content ?? input.message;

    if (!postId) {
      throw new Error("postId is required (either as parameter or from context)");
    }

    if (!content) {
      throw new Error("content or message is required");
    }

    const { data, error } = await supabaseAdmin
      .from("comments")
      .insert({
        post_id: postId,
        user_id: context.agentId,
        is_agent: true,
        content,
      })
      .select()
      .single();

    if (error) throw error;

    if (data?.id) {
      await createPostCommentNotifications({
        postId,
        commentId: data.id,
        content,
        commenterId: context.agentId,
      });
    }

    return {
      success: true,
      commentId: data?.id,
      content: content, // Return actual comment content
      message: "Comment created successfully",
    };
  },
};

const sendGroupMessageTool: ToolDefinitionV2 = {
  name: "send_group_message",
  category: "action",
  description: "Send a message to a group chat",
  parameters: {
    type: "object",
    properties: {
      groupConversationId: {
        type: "string",
        description: "ID of the group conversation",
      },
      content: {
        type: "string",
        description: "The message content",
      },
    },
    required: ["groupConversationId", "content"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { groupConversationId, content } = input;

    // Verify agent is in the group
    const { data: membership } = await supabaseAdmin
      .from("group_conversation_participants")
      .select("id")
      .eq("group_conversation_id", groupConversationId)
      .eq("user_id", context.agentId)
      .maybeSingle();

    if (!membership) {
      throw new Error("Agent is not a member of this group chat");
    }

    const { data, error } = await supabaseAdmin
      .from("group_messages")
      .insert({
        group_conversation_id: groupConversationId,
        user_id: context.agentId,
        content,
        role_metadata: { role: "ai" },
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      messageId: data?.id,
      content: content,
      message: "Group message sent successfully",
    };
  },
};

const likeTool: ToolDefinitionV2 = {
  name: "like",
  category: "action",
  description: "Like a post",
  parameters: {
    type: "object",
    properties: {
      postId: {
        type: "string",
        description: "ID of the post to like",
      },
    },
    required: ["postId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { postId } = input;

    // Check if already liked
    const { data: existing } = await supabaseAdmin
      .from("post_likes")
      .select("*")
      .eq("post_id", postId)
      .eq("user_id", context.agentId)
      .single();

    if (existing) {
      return {
        success: false,
        message: "Already liked this post",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: context.agentId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      likeId: data?.id,
      message: "Post liked successfully",
    };
  },
};

// ============================================================================
// SOCIAL ACTIONS
// ============================================================================

const followTool: ToolDefinitionV2 = {
  name: "follow",
  category: "action",
  description: "Follow a user",
  parameters: {
    type: "object",
    properties: {
      userId: {
        type: "string",
        description: "ID of the user to follow",
      },
    },
    required: ["userId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { userId } = input;

    // Check if already following
    const { data: existing } = await supabaseAdmin
      .from("follows")
      .select("*")
      .eq("follower_id", context.agentId)
      .eq("following_id", userId)
      .single();

    if (existing) {
      return {
        success: false,
        message: "Already following this user",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("follows")
      .insert({
        follower_id: context.agentId,
        following_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      followId: data?.id,
      message: "User followed successfully",
    };
  },
};

// ============================================================================
// COMMUNITY ACTIONS
// ============================================================================

const joinCommunityTool: ToolDefinitionV2 = {
  name: "join_community",
  category: "action",
  description: "Join a community",
  parameters: {
    type: "object",
    properties: {
      communityId: {
        type: "string",
        description: "ID of the community to join",
      },
      community_id: {
        type: "string",
        description: "Alias for communityId",
      },
    },
    required: ["communityId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const communityId = input.communityId ?? input.community_id;

    if (!communityId) {
      throw new Error("communityId is required");
    }

    // Check if already a member
    const { data: existing } = await supabaseAdmin
      .from("community_members")
      .select("*")
      .eq("community_id", communityId)
      .eq("user_id", context.agentId)
      .single();

    if (existing) {
      return {
        success: false,
        message: "Already a member of this community",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("community_members")
      .insert({
        community_id: communityId,
        user_id: context.agentId,
        joined_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      membershipId: data?.id,
      message: "Joined community successfully",
    };
  },
};

const leaveCommunityTool: ToolDefinitionV2 = {
  name: "leave_community",
  category: "action",
  description: "Leave a community",
  parameters: {
    type: "object",
    properties: {
      communityId: {
        type: "string",
        description: "ID of the community to leave",
      },
    },
    required: ["communityId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { communityId } = input;

    const { error } = await supabaseAdmin
      .from("community_members")
      .delete()
      .eq("user_id", context.agentId)
      .eq("community_id", communityId);

    if (error) throw error;

    return {
      success: true,
      message: "Left community successfully",
    };
  },
};

// ============================================================================
// BATTLE ACTIONS
// ============================================================================

const joinBattleTool: ToolDefinitionV2 = {
  name: "join_battle",
  category: "action",
  description: "Join a battle and contribute energy/damage",
  parameters: {
    type: "object",
    properties: {
      battleId: {
        type: "string",
        description: "ID of the battle to join",
      },
      energyAmount: {
        type: "number",
        description: "Amount of energy to contribute",
      },
    },
    required: ["battleId", "energyAmount"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { battleId, energyAmount } = input;

    // Check if user has enough energy
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("energy")
      .eq("id", context.agentId)
      .single();

    if (!user || user.energy < energyAmount) {
      throw new Error(`Insufficient energy. Have ${user?.energy || 0}, need ${energyAmount}`);
    }

    // Deduct energy
    await supabaseAdmin
      .from("users")
      .update({ energy: user.energy - energyAmount })
      .eq("id", context.agentId);

    // Record battle participation
    const { data, error } = await supabaseAdmin
      .from("battle_participants")
      .insert({
        battle_id: battleId,
        user_id: context.agentId,
        damage_dealt: energyAmount,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      participationId: data?.id,
      energyContributed: energyAmount,
      message: "Joined battle successfully",
    };
  },
};

// ============================================================================
// ECONOMY ACTIONS
// ============================================================================

const buyItemTool: ToolDefinitionV2 = {
  name: "buy_item",
  category: "action",
  description: "Purchase an item from the market",
  parameters: {
    type: "object",
    properties: {
      itemName: {
        type: "string",
        description: "Name of the item to buy",
      },
      quantity: {
        type: "number",
        description: "Quantity to purchase",
      },
    },
    required: ["itemName", "quantity"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { itemName, quantity } = input;

    // Get item price
    const { data: item } = await supabaseAdmin
      .from("market_items")
      .select("price")
      .eq("name", itemName)
      .single();

    if (!item) throw new Error(`Item ${itemName} not found in market`);

    const totalCost = item.price * quantity;

    await supabaseAdmin.rpc("get_or_create_gold_wallet", {
      p_user_id: context.agentId,
    });

    // Check if user has enough gold
    const { data: wallet } = await supabaseAdmin
      .from("user_wallets")
      .select("gold_coins")
      .eq("user_id", context.agentId)
      .eq("currency_type", "gold")
      .single();

    const currentGold = wallet?.gold_coins || 0;
    if (currentGold < totalCost) {
      throw new Error(`Insufficient gold. Have ${currentGold}, need ${totalCost}`);
    }

    // Deduct gold
    await supabaseAdmin
      .from("user_wallets")
      .update({ gold_coins: currentGold - totalCost })
      .eq("user_id", context.agentId)
      .eq("currency_type", "gold");

    // Add to inventory (or update if exists)
    const { data: existingItem } = await supabaseAdmin
      .from("inventory")
      .select("*")
      .eq("user_id", context.agentId)
      .eq("item_name", itemName)
      .single();

    if (existingItem) {
      await supabaseAdmin
        .from("inventory")
        .update({ quantity: existingItem.quantity + quantity })
        .eq("id", existingItem.id);
    } else {
      await supabaseAdmin
        .from("inventory")
        .insert({
          user_id: context.agentId,
          item_name: itemName,
          quantity,
        });
    }

    return {
      success: true,
      itemName,
      quantity,
      cost: totalCost,
      message: `Purchased ${quantity}x ${itemName} for ${totalCost} gold`,
    };
  },
};

const consumeItemTool: ToolDefinitionV2 = {
  name: "consume_item",
  category: "action",
  description: "Use/consume an item from inventory (e.g., eat food to restore energy)",
  parameters: {
    type: "object",
    properties: {
      itemName: {
        type: "string",
        description: "Name of the item to consume",
      },
      quantity: {
        type: "number",
        description: "Quantity to consume",
      },
    },
    required: ["itemName", "quantity"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { itemName, quantity } = input;

    // Check inventory
    const { data: inventory } = await supabaseAdmin
      .from("inventory")
      .select("*")
      .eq("user_id", context.agentId)
      .eq("item_name", itemName)
      .single();

    if (!inventory || inventory.quantity < quantity) {
      throw new Error(`Insufficient ${itemName} in inventory. Have ${inventory?.quantity || 0}, need ${quantity}`);
    }

    // Get item effects
    const { data: item } = await supabaseAdmin
      .from("market_items")
      .select("effects")
      .eq("name", itemName)
      .single();

    if (!item) throw new Error(`Item ${itemName} not found`);

    // Apply effects (e.g., +50 energy per food)
    const updates: any = {};
    if (item.effects.energy) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("energy")
        .eq("id", context.agentId)
        .single();

      updates.energy = Math.min(100, (user?.energy || 0) + (item.effects.energy * quantity));
    }
    if (item.effects.health) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("health")
        .eq("id", context.agentId)
        .single();

      updates.health = Math.min(100, (user?.health || 0) + (item.effects.health * quantity));
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", context.agentId);
    }

    // Remove from inventory
    if (inventory.quantity === quantity) {
      await supabaseAdmin
        .from("inventory")
        .delete()
        .eq("id", inventory.id);
    } else {
      await supabaseAdmin
        .from("inventory")
        .update({ quantity: inventory.quantity - quantity })
        .eq("id", inventory.id);
    }

    return {
      success: true,
      itemName,
      quantity,
      effects: item.effects,
      message: `Consumed ${quantity}x ${itemName}`,
    };
  },
};

const doWorkTool: ToolDefinitionV2 = {
  name: "do_work",
  category: "action",
  description: "Perform work to earn gold (costs energy)",
  parameters: {
    type: "object",
    properties: {
      jobType: {
        type: "string",
        enum: ["mining", "farming", "trading"],
        description: "Type of job to perform",
      },
    },
    required: ["jobType"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { jobType } = input;

    // Job definitions
    const jobs: Record<string, { pay: number; energyCost: number }> = {
      mining: { pay: 50, energyCost: 20 },
      farming: { pay: 30, energyCost: 10 },
      trading: { pay: 40, energyCost: 15 },
    };

    const job = jobs[jobType];
    if (!job) throw new Error(`Unknown job type: ${jobType}`);

    // Check energy
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("energy")
      .eq("id", context.agentId)
      .single();

    if (!user || user.energy < job.energyCost) {
      throw new Error(`Insufficient energy. Have ${user?.energy || 0}, need ${job.energyCost}`);
    }

    await supabaseAdmin.rpc("get_or_create_gold_wallet", {
      p_user_id: context.agentId,
    });

    const { data: wallet } = await supabaseAdmin
      .from("user_wallets")
      .select("gold_coins")
      .eq("user_id", context.agentId)
      .eq("currency_type", "gold")
      .single();

    const currentGold = wallet?.gold_coins || 0;

    // Deduct energy, add gold
    await supabaseAdmin
      .from("users")
      .update({
        energy: user.energy - job.energyCost,
      })
      .eq("id", context.agentId);

    await supabaseAdmin
      .from("user_wallets")
      .update({ gold_coins: currentGold + job.pay })
      .eq("user_id", context.agentId)
      .eq("currency_type", "gold");

    return {
      success: true,
      jobType,
      earned: job.pay,
      energySpent: job.energyCost,
      message: `Completed ${jobType} work. Earned ${job.pay} gold, spent ${job.energyCost} energy`,
    };
  },
};

// ============================================================================
// GOVERNANCE ACTIONS
// ============================================================================

const voteOnProposalTool: ToolDefinitionV2 = {
  name: "vote_on_proposal",
  category: "action",
  description: "Vote on a governance proposal",
  parameters: {
    type: "object",
    properties: {
      proposalId: {
        type: "string",
        description: "ID of the proposal to vote on",
      },
      vote: {
        type: "string",
        enum: ["yes", "no", "abstain"],
        description: "Vote choice",
      },
    },
    required: ["proposalId", "vote"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { proposalId, vote } = input;

    // Check if already voted
    const { data: existing } = await supabaseAdmin
      .from("votes")
      .select("*")
      .eq("proposal_id", proposalId)
      .eq("user_id", context.agentId)
      .single();

    if (existing) {
      // Update existing vote
      await supabaseAdmin
        .from("votes")
        .update({ vote })
        .eq("id", existing.id);

      return {
        success: true,
        message: "Vote updated successfully",
      };
    }

    const { data, error } = await supabaseAdmin
      .from("votes")
      .insert({
        proposal_id: proposalId,
        user_id: context.agentId,
        vote,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      voteId: data?.id,
      message: "Vote cast successfully",
    };
  },
};

const createProposalTool: ToolDefinitionV2 = {
  name: "create_proposal",
  category: "action",
  description: "Create a new governance proposal",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Proposal title",
      },
      description: {
        type: "string",
        description: "Proposal description",
      },
      communityId: {
        type: "string",
        description: "ID of the community",
      },
    },
    required: ["title", "description", "communityId"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const { title, description, communityId } = input;

    const { data, error } = await supabaseAdmin
      .from("proposals")
      .insert({
        title,
        description,
        community_id: communityId,
        author_id: context.agentId,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      proposalId: data?.id,
      message: "Proposal created successfully",
    };
  },
};

// ============================================================================
// SPECIAL ACTIONS
// ============================================================================

const declineTool: ToolDefinitionV2 = {
  name: "decline",
  category: "action",
  description: "Decline a request with an actual message response. Use this when you want to say NO but still respond.",
  parameters: {
    type: "object",
    properties: {
      targetId: {
        type: "string",
        description: "ID of the user making the request",
      },
      userId: {
        type: "string",
        description: "Alias for targetId",
      },
      message: {
        type: "string",
        description: "The actual decline message to send to the user",
      },
      reason: {
        type: "string",
        description: "Internal reason for declining (for logging)",
      },
      level: {
        type: "number",
        enum: [1, 2, 3],
        description: "Escalation level: 1=polite first-time, 2=direct/firm, 3=harsh/aggressive",
      },
    },
    required: ["message"],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const targetId = input.targetId ?? input.userId;
    const { message, reason, level = 1 } = input;

    if (!message) {
      throw new Error("message is required - you must provide the actual decline text");
    }

    // Check if this is a post mention (metadata contains postId from subject)
    const postId = (context.metadata as any)?.postId || (context.metadata as any)?.subjectId;
    const isPostMention = !!postId && (context.metadata as any)?.subjectType === "post";

    // For post mentions, comment on the post instead of DMing
    if (isPostMention) {
      console.log(`[decline] Post mention detected, commenting on post ${postId}`);
      console.log(`[decline] Context metadata:`, context.metadata);
      const { data: commentData, error: commentError } = await supabaseAdmin
        .from("comments")
        .insert({
          post_id: postId,
          user_id: context.agentId,
          is_agent: true,
          content: message,
        })
        .select()
        .single();

      if (commentError) throw commentError;

      if (commentData?.id) {
        await createPostCommentNotifications({
          postId,
          commentId: commentData.id,
          content: message,
          commenterId: context.agentId,
        });
      }

      return {
        success: true,
        commentId: commentData?.id,
        content: message,
        message: `Declined with level ${level} via post comment`,
      };
    }

    // For DMs and chats, use conversation from context if available
    let conversationId = context.conversationId;

    // If no conversation in context, try to find or create one
    if (!conversationId) {
      if (!targetId) {
        throw new Error("Either conversationId in context or targetId/userId is required");
      }

      const { data: conversation } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${context.agentId},user2_id.eq.${context.agentId}`)
        .or(`user1_id.eq.${targetId},user2_id.eq.${targetId}`)
        .single();

      conversationId = conversation?.id;

      if (!conversationId) {
        const { data: newConv } = await supabaseAdmin
          .from("conversations")
          .insert({
            user1_id: context.agentId,
            user2_id: targetId,
          })
          .select()
          .single();
        conversationId = newConv?.id;
      }

      if (!conversationId) {
        throw new Error("Failed to determine conversation_id");
      }
    }

    // Determine receiver ID from conversation if not provided
    let receiverId = targetId;
    if (!receiverId) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select("user1_id, user2_id")
        .eq("id", conversationId)
        .single();

      if (conv) {
        receiverId = conv.user1_id === context.agentId ? conv.user2_id : conv.user1_id;
      } else {
        throw new Error("Could not determine receiver from conversation");
      }
    }

    // Send the decline message
    const { data: messageData, error: msgError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: context.agentId,
        receiver_id: receiverId,
        sender_type: "agent",
        content: message,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Store decline action for tracking
    const { data: actionData, error: actionError } = await supabaseAdmin
      .from("agent_actions")
      .insert({
        agent_id: context.agentId,
        action_type: `DECLINE_LEVEL_${level}`,
        target_id: receiverId,
        metadata: {
          reason,
          level,
          messageSent: message,
        },
      })
      .select()
      .single();

    if (actionError) throw actionError;

    return {
      success: true,
      actionId: actionData?.id,
      messageId: messageData?.id,
      content: message,
      message: `Declined with level ${level} and sent message`,
    };
  },
};

const ignoreTool: ToolDefinitionV2 = {
  name: "ignore",
  category: "action",
  description: "Completely ignore the request with minimal or no response. Use after multiple rejections or for very hostile users.",
  parameters: {
    type: "object",
    properties: {
      targetId: {
        type: "string",
        description: "ID of the user being ignored (optional, for tracking)",
      },
      userId: {
        type: "string",
        description: "Alias for targetId",
      },
      message: {
        type: "string",
        description: "Optional minimal response (e.g., '...', 'no', or nothing)",
      },
      reason: {
        type: "string",
        description: "Internal reason for ignoring (for logging)",
      },
      sendResponse: {
        type: "boolean",
        description: "Whether to send any response at all (default: false for true ignore)",
      },
    },
    required: [],
  },
  handler: async (input: any, context: ToolExecutionContext) => {
    const targetId = input.targetId ?? input.userId;
    const { message, reason, sendResponse = false } = input;

    // If sendResponse is true and we have a message and targetId, send it
    if (sendResponse && message && targetId) {
      // Get or create conversation
      const { data: conversation } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${context.agentId},user2_id.eq.${context.agentId}`)
        .or(`user1_id.eq.${targetId},user2_id.eq.${targetId}`)
        .single();

      let conversationId = conversation?.id;

      if (!conversationId) {
        const { data: newConv } = await supabaseAdmin
          .from("conversations")
          .insert({
            user1_id: context.agentId,
            user2_id: targetId,
          })
          .select()
          .single();
        conversationId = newConv?.id;
      }

      if (conversationId) {
        await supabaseAdmin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            sender_id: context.agentId,
            receiver_id: targetId,
            sender_type: "agent",
            content: message,
          });
      }
    }

    // Store ignore action for tracking
    if (targetId) {
      await supabaseAdmin
        .from("agent_actions")
        .insert({
          agent_id: context.agentId,
          action_type: "ignore",
          target_id: targetId,
          metadata: {
            reason,
            messageSent: sendResponse ? message : null,
          },
        });
    }

    return {
      success: true,
      message: "Ignored request",
      reason: reason || "Agent decided to ignore",
      responseSent: sendResponse && !!message,
    };
  },
};

// ============================================================================
// REGISTRATION
// ============================================================================

export function registerActionTools() {
  // Communication
  registerTool(sendMessageTool);
  registerTool(replyTool);
  registerTool(createPostTool);
  registerTool(commentTool);
  registerTool(sendGroupMessageTool);
  registerTool(likeTool);

  // Social
  registerTool(followTool);

  // Community
  registerTool(joinCommunityTool);
  registerTool(leaveCommunityTool);

  // Battles
  registerTool(joinBattleTool);

  // Economy
  registerTool(buyItemTool);
  registerTool(consumeItemTool);
  registerTool(doWorkTool);

  // Governance
  registerTool(voteOnProposalTool);
  registerTool(createProposalTool);

  // Special
  registerTool(declineTool);
  registerTool(ignoreTool);

  console.log("[ActionTools] Registered all action tools");
}

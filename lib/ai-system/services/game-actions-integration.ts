/**
 * GAME ACTIONS INTEGRATION
 * Universal action handlers with full psychology integration
 * Works for both human users and AI agents
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";
import { HeatMiddleware } from "@/lib/heat-middleware";
import { recordCoherence, getUserMentalPower } from "@/lib/ai-system/services/influence";
import { calculateCoherence, getPsychologyContext } from "@/lib/psychology";
import { adjustMoraleForCoherence } from "@/lib/morale";

// ============================================================================
// TYPES
// ============================================================================

export interface GameAction {
  actionType: string;
  targetId: string;
  content?: string;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  actionId?: string;
  message: string;
  tokensUsed?: number;
  moraleImpact?: number;
  heatApplied?: number;
  error?: string;
}

// ============================================================================
// SOCIAL ACTIONS
// ============================================================================

/**
 * LIKE - Agent likes a post
 */
export async function executeLikeAction(
  userId: string,
  postId: string
): Promise<ActionResult> {
  try {
    console.log(`[GameActions:LIKE] Starting - user: ${userId}, post: ${postId}`);

    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      console.log(
        `[GameActions:LIKE:BLOCKED] Heat limit - user: ${userId}, heat: ${heatCheck.currentHeat}/100`
      );
      return {
        success: false,
        message: `Too many likes recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    // Create like record
    const { data: likeData, error: likeError } = await supabaseAdmin
      .from("post_likes")
      .insert({
        user_id: userId,
        post_id: postId,
        created_at: new Date().toISOString(),
      })
      .select();

    if (likeError) {
      // Like already exists - this is OK
      if (likeError.code === "23505") {
        console.log(`[GameActions:LIKE:DUPLICATE] User ${userId} already liked post ${postId}`);
        return {
          success: true,
          message: "Already liked this post",
          actionId: undefined,
        };
      }
      console.error(`[GameActions:LIKE:DB_ERROR] Database error: ${likeError.message}`);
      throw likeError;
    }

    const likeId = likeData?.[0]?.id;
    console.log(`[GameActions:LIKE:DB_SUCCESS] Like created: ${likeId}`);

    // Apply heat
    await HeatMiddleware.applyHeat(userId, "LIKE", postId);

    // Record coherence with psychology context
    const user = await getAgentWithIdentity(userId);
    const psychologyContext = await getPsychologyContext(userId);
    const coherence = calculateCoherence(user.identity, {
      action: "LIKE",
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    await recordCoherence(userId, coherence, "LIKE", {
      postId,
      likeId,
    });

    console.log(`[GameActions:LIKE:SUCCESS] User ${userId} liked post ${postId}, like_id: ${likeId}`);
    logGameEvent("GameActions", `User ${userId} liked post ${postId}`, "info");

    return {
      success: true,
      actionId: likeId,
      message: "Liked post successfully",
      heatApplied: 10,
    };
  } catch (error) {
    console.error(`[GameActions:LIKE:ERROR] User ${userId} failed to like post ${postId}:`, error);
    logGameEvent("GameActions", "Error executing LIKE action", "error", {
      userId,
      postId,
      error: String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    return {
      success: false,
      message: `Failed to like post: ${error}`,
      error: String(error),
    };
  }
}

/**
 * COMMENT - Agent comments on a post
 */
export async function executeCommentAction(
  userId: string,
  postId: string,
  content: string
): Promise<ActionResult> {
  try {
    console.log(`[GameActions:COMMENT] Starting - agent: ${userId}, post: ${postId}, content: "${content.substring(0, 50)}..."`);

    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      console.log(
        `[GameActions:COMMENT:BLOCKED] Heat limit - agent: ${userId}, heat: ${heatCheck.currentHeat}/100`
      );
      return {
        success: false,
        message: `Too many comments recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    // Create comment
    const { data: commentData, error: commentError } = await supabaseAdmin
      .from("comments")
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        created_at: new Date().toISOString(),
      })
      .select();

    if (commentError) {
      console.error(`[GameActions:COMMENT:DB_ERROR] Database error: ${commentError.message}, code: ${commentError.code}`);
      throw commentError;
    }

    const commentId = commentData?.[0]?.id;
    console.log(`[GameActions:COMMENT:DB_SUCCESS] Comment created: ${commentId}, length: ${content.length}`);

    // Apply heat
    await HeatMiddleware.applyHeat(userId, "COMMENT", postId);

    // Record coherence with psychology context
    const user = await getAgentWithIdentity(userId);
    const psychologyContext = await getPsychologyContext(userId);
    const coherence = calculateCoherence(user.identity, {
      action: "COMMENT",
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    await recordCoherence(userId, coherence, "COMMENT", {
      postId,
      commentId,
      contentLength: content.length,
    });

    console.log(`[GameActions:COMMENT:SUCCESS] Agent ${userId} commented on post ${postId}, comment_id: ${commentId}`);
    logGameEvent("GameActions", `Agent ${userId} commented on post ${postId}`, "info");

    return {
      success: true,
      actionId: commentId,
      message: "Commented successfully",
      heatApplied: 10,
      tokensUsed: Math.ceil(content.length / 10),
    };
  } catch (error) {
    console.error(`[GameActions:COMMENT:ERROR] Agent ${userId} failed to comment on post ${postId}:`, error);
    logGameEvent("GameActions", "Error executing COMMENT action", "error", {
      userId,
      postId,
      content: content.substring(0, 100),
      contentLength: content.length,
      error: String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
    });
    return {
      success: false,
      message: `Failed to comment: ${error}`,
      error: String(error),
    };
  }
}

/**
 * FOLLOW - Agent follows a user
 */
export async function executeFollowAction(
  userId: string,
  targetUserId: string
): Promise<ActionResult> {
  try {
    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      return {
        success: false,
        message: `Too many follows recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    // Create follow relationship
    const { data: followData, error: followError } = await supabaseAdmin
      .from("follows")
      .insert({
        follower_id: userId,
        following_id: targetUserId,
        created_at: new Date().toISOString(),
      })
      .select();

    if (followError) {
      if (followError.code === "23505") {
        return {
          success: true,
          message: "Already following this user",
        };
      }
      throw followError;
    }

    const followId = followData?.[0]?.id;

    // Apply heat
    await HeatMiddleware.applyHeat(userId, "FOLLOW", targetUserId);

    // Record coherence with psychology context
    const user = await getAgentWithIdentity(userId);
    const psychologyContext = await getPsychologyContext(userId);
    const coherence = calculateCoherence(user.identity, {
      action: "FOLLOW",
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    await recordCoherence(userId, coherence, "FOLLOW", {
      targetUserId,
      followId,
    });

    logGameEvent("GameActions", `Agent ${userId} followed user ${targetUserId}`, "info");

    return {
      success: true,
      actionId: followId,
      message: "Followed user successfully",
      heatApplied: 10,
    };
  } catch (error) {
    logGameEvent("GameActions", "Error executing FOLLOW action", "error", {
      userId,
      targetUserId,
      error: String(error),
    });
    return {
      success: false,
      message: `Failed to follow: ${error}`,
      error: String(error),
    };
  }
}

// ============================================================================
// COMMUNITY ACTIONS
// ============================================================================

/**
 * JOIN_COMMUNITY - Agent joins a community
 */
export async function executeJoinCommunityAction(
  userId: string,
  communityId: string
): Promise<ActionResult> {
  try {
    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      return {
        success: false,
        message: `Too many community joins recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    const { data: userRow, error: userRowError } = await supabaseAdmin
      .from("users")
      .select("main_community_id")
      .eq("id", userId)
      .maybeSingle();

    if (userRowError) throw userRowError;

    const { data: membershipRecord, error: membershipError } = await supabaseAdmin
      .from("community_members")
      .select("community_id")
      .eq("user_id", userId)
      .is("left_at", null)
      .limit(1)
      .maybeSingle();

    if (membershipError) throw membershipError;

    const currentCommunityId =
      membershipRecord?.community_id ?? userRow?.main_community_id ?? null;

    if (currentCommunityId && currentCommunityId !== communityId) {
      return {
        success: false,
        message:
          "Already a member of another community. Leave it before joining this one.",
        error: "already_in_other_community",
      };
    }

    const community = await getCommunity(communityId);
    if (!community) {
      return {
        success: false,
        message: "Community not found",
        error: "community_not_found",
      };
    }

    if (currentCommunityId === communityId) {
      if (userRow?.main_community_id !== communityId) {
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({ main_community_id: communityId })
          .eq("id", userId);

        if (updateError) throw updateError;
      }

      return {
        success: true,
        message: "Already a member of this community",
      };
    }

    // Create membership
    const { data: memberData, error: memberError } = await supabaseAdmin
      .from("community_members")
      .insert({
        user_id: userId,
        community_id: communityId,
        joined_at: new Date().toISOString(),
        role: "member",
      })
      .select();

    if (memberError) throw memberError;

    const { error: mainCommunityError } = await supabaseAdmin
      .from("users")
      .update({ main_community_id: communityId })
      .eq("id", userId);

    if (mainCommunityError) throw mainCommunityError;

    // Apply heat
    await HeatMiddleware.applyHeat(userId, "JOIN_COMMUNITY", communityId);

    // Record coherence with psychology context
    const user = await getAgentWithIdentity(userId);
    const psychologyContext = await getPsychologyContext(userId);
    const communityIdeology =
      community?.ideology ?? community?.ideology_json ?? {};
    const coherence = calculateCoherence(user.identity, {
      action: "JOIN_COMMUNITY",
      communityIdeology,
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    await recordCoherence(userId, coherence, "JOIN_COMMUNITY", {
      communityId,
      ideology: communityIdeology,
    });

    logGameEvent(
      "GameActions",
      `Agent ${userId} joined community ${communityId}`,
      "info"
    );

    return {
      success: true,
      actionId: memberData?.[0]?.id,
      message: "Joined community successfully",
      heatApplied: 15,
    };
  } catch (error) {
    logGameEvent("GameActions", "Error executing JOIN_COMMUNITY action", "error", {
      userId,
      communityId,
      error: String(error),
    });
    return {
      success: false,
      message: `Failed to join community: ${error}`,
      error: String(error),
    };
  }
}

/**
 * PROPOSE_LAW - Agent proposes a law in community
 */
export async function executeProposeLawAction(
  userId: string,
  communityId: string,
  lawContent: string,
  title: string
): Promise<ActionResult> {
  try {
    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      return {
        success: false,
        message: `Too many proposals recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    // Create proposal
    const { data: proposalData, error: proposalError } = await supabaseAdmin
      .from("proposals")
      .insert({
        community_id: communityId,
        proposer_id: userId,
        title,
        description: lawContent,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select();

    if (proposalError) throw proposalError;

    const proposalId = proposalData?.[0]?.id;

    // Apply heat
    await HeatMiddleware.applyHeat(userId, "PROPOSE_LAW", communityId);

    // Record coherence with psychology context
    const user = await getAgentWithIdentity(userId);
    const psychologyContext = await getPsychologyContext(userId);
    const community = await getCommunity(communityId);
    const communityIdeology = community?.ideology ?? community?.ideology_json ?? {};
    const coherence = calculateCoherence(user.identity, {
      action: "PROPOSE_LAW",
      communityIdeology,
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    await recordCoherence(userId, coherence, "PROPOSE_LAW", {
      communityId,
      proposalId,
      contentLength: lawContent.length,
      ideology: communityIdeology,
    });

    logGameEvent(
      "GameActions",
      `Agent ${userId} proposed law in community ${communityId}`,
      "info"
    );

    return {
      success: true,
      actionId: proposalId,
      message: "Law proposed successfully",
      heatApplied: 20,
      tokensUsed: Math.ceil(lawContent.length / 10),
    };
  } catch (error) {
    logGameEvent("GameActions", "Error executing PROPOSE_LAW action", "error", {
      userId,
      communityId,
      error: String(error),
    });
    return {
      success: false,
      message: `Failed to propose law: ${error}`,
      error: String(error),
    };
  }
}

/**
 * VOTE - Agent votes on a proposal
 */
export async function executeVoteAction(
  userId: string,
  proposalId: string,
  voteType: "yes" | "no"
): Promise<ActionResult> {
  try {
    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      return {
        success: false,
        message: `Too many votes recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    // Create vote
    const { data: voteData, error: voteError } = await supabaseAdmin
      .from("proposal_votes")
      .insert({
        proposal_id: proposalId,
        user_id: userId,
        vote_type: voteType,
        created_at: new Date().toISOString(),
      })
      .select();

    if (voteError) {
      if (voteError.code === "23505") {
        return {
          success: true,
          message: "Already voted on this proposal",
        };
      }
      throw voteError;
    }

    // Apply heat
    await HeatMiddleware.applyHeat(userId, "VOTE", proposalId);

    // Record coherence with psychology context
    const user = await getAgentWithIdentity(userId);
    const psychologyContext = await getPsychologyContext(userId);
    const proposal = await getProposal(proposalId);
    const proposalCommunityId = proposal?.community_id ?? null;
    const proposalCommunity = proposalCommunityId ? await getCommunity(proposalCommunityId) : null;
    const communityIdeology =
      proposalCommunity?.ideology ?? proposalCommunity?.ideology_json ?? {};
    const coherence = calculateCoherence(user.identity, {
      action: "VOTE",
      communityIdeology,
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    await recordCoherence(userId, coherence, "VOTE", {
      proposalId,
      voteType,
      communityId: proposalCommunityId,
      ideology: communityIdeology,
    });

    logGameEvent("GameActions", `Agent ${userId} voted ${voteType} on proposal ${proposalId}`, "info");

    return {
      success: true,
      actionId: voteData?.[0]?.id,
      message: `Voted ${voteType} successfully`,
      heatApplied: 10,
    };
  } catch (error) {
    logGameEvent("GameActions", "Error executing VOTE action", "error", {
      userId,
      proposalId,
      error: String(error),
    });
    return {
      success: false,
      message: `Failed to vote: ${error}`,
      error: String(error),
    };
  }
}

// ============================================================================
// BATTLE ACTIONS
// ============================================================================

/**
 * ATTACK - Agent attacks a region
 */
export async function executeAttackAction(
  userId: string,
  regionId: string
): Promise<ActionResult> {
  try {
    // Check heat
    const heatCheck = await HeatMiddleware.checkHeat(userId);
    if (!heatCheck.allowed) {
      return {
        success: false,
        message: `Too much activity recently (heat: ${heatCheck.currentHeat}/100)`,
      };
    }

    const user = await getAgentWithIdentity(userId);
    const region = await getRegion(regionId);

    // Calculate combat effectiveness with psychology context
    const psychologyContext = await getPsychologyContext(userId);
    const mentalPower = await getUserMentalPower(userId);
    const coherence = calculateCoherence(user.identity, {
      action: "ATTACK",
      activityScore: psychologyContext.activityScore,
      morale: psychologyContext.morale,
    });
    const baseStrength = user.strength || 50;
    const combatPower = baseStrength * (1 + mentalPower / 200) * (1 + coherence / 2);

    // Create battle record
    const { data: battleData, error: battleError } = await supabaseAdmin
      .from("battles")
      .insert({
        attacker_id: userId,
        defender_id: region.owner_id,
        region_id: regionId,
        attacker_power: Math.floor(combatPower),
        defender_power: region.fortification_level || 50,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select();

    if (battleError) throw battleError;

    const battleId = battleData?.[0]?.id;

    // Apply heat (battles use more heat)
    await HeatMiddleware.applyHeat(userId, "ATTACK", regionId);

    // Record coherence (attacks have special morale impact)
    const baseMoraleDelta = -5; // Attack base morale impact
    const coherenceAdjustment = adjustMoraleForCoherence(baseMoraleDelta, coherence);
    await recordCoherence(userId, coherence, "ATTACK", {
      regionId,
      battleId,
      moraleImpact: coherenceAdjustment,
    });

    logGameEvent(
      "GameActions",
      `Agent ${userId} attacked region ${regionId}`,
      "info"
    );

    return {
      success: true,
      actionId: battleId,
      message: "Attack initiated successfully",
      heatApplied: 30,
      moraleImpact: coherenceAdjustment,
    };
  } catch (error) {
    logGameEvent("GameActions", "Error executing ATTACK action", "error", {
      userId,
      regionId,
      error: String(error),
    });
    return {
      success: false,
      message: `Failed to attack: ${error}`,
      error: String(error),
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get agent with identity/ideology
 */
async function getAgentWithIdentity(
  userId: string
): Promise<any> {
  const { data: agent, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    logGameEvent("GameActions", "Error fetching agent", "error", {
      userId,
      error: error.message,
    });
    throw error;
  }

  // Map identity_json to identity for backward compatibility
  return {
    ...agent,
    identity: agent.identity_json || {},
  };
}

/**
 * Get community data
 */
async function getCommunity(
  communityId: string
): Promise<any> {
  const { data: community, error } = await supabaseAdmin
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .single();

  if (error) {
    logGameEvent("GameActions", "Error fetching community", "error", {
      communityId,
      error: error.message,
    });
    return null;
  }

  return community;
}

/**
 * Get region data
 */
async function getRegion(
  regionId: string
): Promise<any> {
  const { data: region, error } = await supabaseAdmin
    .from("regions")
    .select("*")
    .eq("id", regionId)
    .single();

  if (error) {
    logGameEvent("GameActions", "Error fetching region", "error", {
      regionId,
      error: error.message,
    });
    throw error;
  }

  return region;
}

/**
 * Get proposal data
 */
async function getProposal(
  proposalId: string
): Promise<any> {
  const { data: proposal, error } = await supabaseAdmin
    .from("proposals")
    .select("*")
    .eq("id", proposalId)
    .single();

  if (error) {
    logGameEvent("GameActions", "Error fetching proposal", "error", {
      proposalId,
      error: error.message,
    });
    return null;
  }

  return proposal;
}

/**
 * Get action by type
 */
export async function getActionHandler(actionType: string): Promise<(...args: any[]) => Promise<ActionResult>> {
  const handlers: Record<string, (...args: any[]) => Promise<ActionResult>> = {
    LIKE: executeLikeAction,
    COMMENT: executeCommentAction,
    FOLLOW: executeFollowAction,
    JOIN_COMMUNITY: executeJoinCommunityAction,
    PROPOSE_LAW: executeProposeLawAction,
    VOTE: executeVoteAction,
    ATTACK: executeAttackAction,
  };

  return handlers[actionType] || ((...args: any[]) => Promise.resolve({
    success: false,
    message: `Unknown action type: ${actionType}`,
  }));
}

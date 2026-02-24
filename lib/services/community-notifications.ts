/**
 * Community Notification Service
 * Centralized service for sending notifications to community members
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NotificationType } from "@/lib/types/notifications";

export type CommunityNotificationPayload = {
  communityId: string;
  type: NotificationType;
  title: string;
  body?: string;
  triggeredByUserId?: string | null;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  proposalId?: string | null;
  excludeUserIds?: string[]; // Users to exclude from notification (e.g., the actor)
};

/**
 * Send a notification to all active members of a community
 */
export async function notifyCommunityMembers(
  payload: CommunityNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  const {
    communityId,
    type,
    title,
    body,
    triggeredByUserId,
    actionUrl,
    metadata,
    proposalId,
    excludeUserIds = [],
  } = payload;

  try {
    // Fetch all active community members
    const { data: members, error: membersError } = await supabaseAdmin
      .from("community_members")
      .select("user_id")
      .eq("community_id", communityId)
      .is("left_at", null);

    if (membersError) {
      console.error("Community notification members error:", membersError);
      return { success: false, error: membersError.message };
    }

    if (!members || members.length === 0) {
      return { success: true }; // No members to notify
    }

    // Filter out excluded users (e.g., the user who triggered the action)
    const recipientIds = Array.from(
      new Set(members.map((m) => m.user_id).filter(Boolean))
    ).filter((userId) => !excludeUserIds.includes(userId));

    if (recipientIds.length === 0) {
      return { success: true }; // No recipients after filtering
    }

    // Create notifications for all recipients
    const now = new Date().toISOString();
    const notifications = recipientIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      body: body || null,
      community_id: communityId,
      triggered_by_user_id: triggeredByUserId || null,
      proposal_id: proposalId || null,
      action_url: actionUrl || `/community/${communityId}`,
      metadata: metadata
        ? {
            ...metadata,
            community_id: communityId,
            triggered_by_user_id: triggeredByUserId,
          }
        : null,
      is_read: false,
      is_archived: false,
      created_at: now,
      updated_at: now,
    }));

    // Batch insert notifications
    const { error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      console.error("Community notification insert error:", insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Community notification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Notify community members about a law being passed
 */
export async function notifyLawPassed(
  communityId: string,
  lawLabel: string,
  proposalId: string,
  proposerUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.LAW_PASSED,
    title: `Law Passed: ${lawLabel}`,
    body: `The ${lawLabel} proposal has passed and will now take effect.`,
    triggeredByUserId: proposerUserId,
    actionUrl: `/community/${communityId}/politics`,
    proposalId,
    metadata: { lawLabel },
  });
}

/**
 * Notify community members about a law being rejected
 */
export async function notifyLawRejected(
  communityId: string,
  lawLabel: string,
  proposalId: string,
  proposerUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.LAW_REJECTED,
    title: `Law Rejected: ${lawLabel}`,
    body: `The ${lawLabel} proposal has been rejected by the community.`,
    triggeredByUserId: proposerUserId,
    actionUrl: `/community/${communityId}/politics`,
    proposalId,
    metadata: { lawLabel },
  });
}

/**
 * Notify community members about a law expiring
 */
export async function notifyLawExpired(
  communityId: string,
  lawLabel: string,
  proposalId: string,
  proposerUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.LAW_EXPIRED,
    title: `Law Expired: ${lawLabel}`,
    body: `The ${lawLabel} proposal has expired without reaching a decision.`,
    triggeredByUserId: proposerUserId,
    actionUrl: `/community/${communityId}/politics`,
    proposalId,
    metadata: { lawLabel },
  });
}

/**
 * Notify community members about a new law proposal
 */
export async function notifyLawProposed(
  communityId: string,
  lawLabel: string,
  proposalId: string,
  proposerUserId?: string,
  metadata?: Record<string, unknown>
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.LAW_PROPOSAL,
    title: `New Proposal: ${lawLabel}`,
    body: `A new ${lawLabel} proposal has been submitted for your community to vote on.`,
    triggeredByUserId: proposerUserId,
    actionUrl: `/community/${communityId}/politics`,
    proposalId,
    metadata: { lawLabel, ...metadata },
  });
}

/**
 * Notify community members about a new king/sovereign
 */
export async function notifyKingChanged(
  communityId: string,
  newKingUsername: string,
  newKingUserId: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.KING_CHANGED,
    title: "New Sovereign",
    body: `${newKingUsername} is now the sovereign of the community.`,
    triggeredByUserId: newKingUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { newKingUsername, newKingUserId },
  });
}

/**
 * Notify community members about the king leaving
 */
export async function notifyKingLeft(
  communityId: string,
  kingUsername: string,
  kingUserId: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.KING_LEFT,
    title: "Sovereign Departed",
    body: `${kingUsername} has left the community. Leadership transition required.`,
    triggeredByUserId: kingUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { kingUsername, kingUserId },
  });
}

/**
 * Notify community members about a new heir being appointed
 */
export async function notifyHeirAppointed(
  communityId: string,
  heirUsername: string,
  heirUserId: string,
  appointedByUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.HEIR_APPOINTED,
    title: "Heir Appointed",
    body: `${heirUsername} has been designated as the heir to the throne.`,
    triggeredByUserId: appointedByUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { heirUsername, heirUserId },
  });
}

/**
 * Notify community members about a secretary being appointed
 */
export async function notifySecretaryAppointed(
  communityId: string,
  secretaryUsername: string,
  secretaryUserId: string,
  appointedByUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.SECRETARY_APPOINTED,
    title: "Secretary Appointed",
    body: `${secretaryUsername} has been appointed as secretary.`,
    triggeredByUserId: appointedByUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { secretaryUsername, secretaryUserId },
  });
}

/**
 * Notify community members about a secretary being removed
 */
export async function notifySecretaryRemoved(
  communityId: string,
  secretaryUsername: string,
  secretaryUserId: string,
  removedByUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.SECRETARY_REMOVED,
    title: "Secretary Removed",
    body: `${secretaryUsername} has been removed from the secretary position.`,
    triggeredByUserId: removedByUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { secretaryUsername, secretaryUserId },
  });
}

/**
 * Notify community members about a revolution starting
 */
export async function notifyRevolutionStarted(
  communityId: string,
  leaderUsername: string,
  leaderUserId: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.REVOLUTION_STARTED,
    title: "Revolution Started!",
    body: `${leaderUsername} has started an uprising against the current leadership!`,
    triggeredByUserId: leaderUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { leaderUsername, leaderUserId },
  });
}

/**
 * Notify community members about a civil war starting
 */
export async function notifyCivilWarStarted(
  communityId: string,
  leaderUsername: string,
  leaderUserId: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.CIVIL_WAR_STARTED,
    title: "Civil War Erupted!",
    body: `The uprising led by ${leaderUsername} has escalated into civil war!`,
    triggeredByUserId: leaderUserId,
    actionUrl: `/community/${communityId}`,
    metadata: { leaderUsername, leaderUserId },
  });
}

/**
 * Notify community members about a battle starting
 */
export async function notifyBattleStarted(
  communityId: string,
  targetName: string,
  battleId: string,
  initiatedByUserId?: string
) {
  return notifyCommunityMembers({
    communityId,
    type: NotificationType.BATTLE_STARTED,
    title: "Battle Commenced!",
    body: `Your community has engaged ${targetName} in battle!`,
    triggeredByUserId: initiatedByUserId,
    actionUrl: `/battle/${battleId}`,
    metadata: { targetName, battleId },
  });
}

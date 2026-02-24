"use server";

import { revalidatePath } from "next/cache";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
// TODO: Replace with new LLM system when needed
// import { analystModel } from "@/lib/ai-system/_deprecated/adapters/langchain-compat";
import { 
    DEFAULT_IDENTITY_VECTOR, 
    generateIdentityLabel, 
    calculateCoherenceMetrics, 
    IdentityVector
} from "@/lib/psychology";
import { generateSlug, isColumnMissingError } from "@/lib/utils";
import { logGameEvent } from "@/lib/logger";
import { applyActionMorale } from "@/lib/morale";
import { getRankLabel, validateRankAssignment, hasFullGovernanceAuthority, isSovereign } from "@/lib/governance";
import { updateMissionProgress } from "./missions";
import { NotificationType } from "@/lib/types/notifications";
import { recalculateIdeologyDebounced } from "./ideology";

const isValidHex = (hex: string) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);

async function getProfileId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!profile) throw new Error("Profile not found");
  return { supabase, profileId: profile.id };
}

type CommunityNotificationPayload = {
  communityId: string;
  title: string;
  body: string;
  triggeredByUserId: string;
  metadata?: Record<string, unknown>;
};

async function notifyCommunityMembers(payload: CommunityNotificationPayload) {
  const { communityId, title, body, triggeredByUserId, metadata } = payload;

  const { data: members, error: membersError } = await supabaseAdmin
    .from("community_members")
    .select("user_id")
    .eq("community_id", communityId)
    .is("left_at", null);

  if (membersError) {
    console.error("Community notification members error:", membersError);
    return;
  }

  const now = new Date().toISOString();
  const notifications = (members ?? []).map((member) => ({
    user_id: member.user_id,
    type: "community_update",
    title,
    body,
    community_id: communityId,
    triggered_by_user_id: triggeredByUserId,
    action_url: `/community/${communityId}`,
    metadata: {
      ...metadata,
      community_id: communityId,
      triggered_by_user_id: triggeredByUserId,
    },
    is_read: false,
    is_archived: false,
    created_at: now,
  }));

  if (notifications.length === 0) return;

  const { error: insertError } = await supabaseAdmin
    .from("notifications")
    .insert(notifications);

  if (insertError) {
    console.error("Community notification insert error:", insertError);
  }
}

export type CommunityActionState = {
  message: string | null;
  error?: string | null;
  communityId?: string | null;
  communitySlug?: string | null;
};

export async function declareWarAction(
  initiatorCommunityId: string,
  targetCommunityId: string
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Verify user is the sovereign of the initiator community
    const { data: memberData } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", initiatorCommunityId)
      .eq("user_id", profileId)
      .maybeSingle();

    if (!memberData || !hasFullGovernanceAuthority(memberData.rank_tier)) {
      return {
        error: "Only the community Sovereign can declare war.",
        message: null,
      };
    }

    // Call the RPC to declare war
    const { data, error } = await supabase.rpc("declare_war", {
      p_initiator_community_id: initiatorCommunityId,
      p_target_community_id: targetCommunityId,
      p_user_id: profileId,
    });

    if (error) {
      return { error: error.message, message: null };
    }

    logGameEvent(
      "Community",
      `War declared by ${profileId} from ${initiatorCommunityId} against ${targetCommunityId}`,
      "info"
    );

    // Notify both communities about the war declaration
    try {
      const [
        { data: initiatorCommunity },
        { data: targetCommunity },
        { data: initiatorMembers },
        { data: targetMembers },
      ] = await Promise.all([
        supabaseAdmin
          .from("communities")
          .select("id, name, slug")
          .eq("id", initiatorCommunityId)
          .maybeSingle(),
        supabaseAdmin
          .from("communities")
          .select("id, name, slug")
          .eq("id", targetCommunityId)
          .maybeSingle(),
        supabaseAdmin
          .from("community_members")
          .select("user_id")
          .eq("community_id", initiatorCommunityId)
          .is("left_at", null),
        supabaseAdmin
          .from("community_members")
          .select("user_id")
          .eq("community_id", targetCommunityId)
          .is("left_at", null),
      ]);

      const initiatorName = initiatorCommunity?.name ?? "A community";
      const targetName = targetCommunity?.name ?? "a community";
      const now = new Date().toISOString();

      const initiatorNotifs = (initiatorMembers ?? [])
        .map((m) => m.user_id)
        .filter((userId) => userId && userId !== profileId)
        .map((userId) => ({
          user_id: userId,
          type: NotificationType.WAR_DECLARATION,
          title: `War declared on ${targetName}`,
          body: `Your community has declared war on ${targetName}.`,
          community_id: initiatorCommunityId,
          triggered_by_user_id: profileId,
          action_url: "/map",
          metadata: {
            initiator_community_id: initiatorCommunityId,
            initiator_community_name: initiatorName,
            target_community_id: targetCommunityId,
            target_community_name: targetName,
          },
          is_read: false,
          is_archived: false,
          created_at: now,
          updated_at: now,
        }));

      const targetNotifs = (targetMembers ?? [])
        .map((m) => m.user_id)
        .filter((userId) => userId && userId !== profileId)
        .map((userId) => ({
          user_id: userId,
          type: NotificationType.WAR_DECLARATION,
          title: `${initiatorName} declared war on your community`,
          body: `${initiatorName} has declared war on ${targetName}.`,
          community_id: targetCommunityId,
          triggered_by_user_id: profileId,
          action_url: "/map",
          metadata: {
            initiator_community_id: initiatorCommunityId,
            initiator_community_name: initiatorName,
            target_community_id: targetCommunityId,
            target_community_name: targetName,
          },
          is_read: false,
          is_archived: false,
          created_at: now,
          updated_at: now,
        }));

      const allNotifs = [...initiatorNotifs, ...targetNotifs];
      if (allNotifs.length > 0) {
        const { error: notifError } = await supabaseAdmin
          .from("notifications")
          .insert(allNotifs);
        if (notifError) {
          console.error("Failed to create war declaration notifications:", notifError);
        }
      }
    } catch (notifErr) {
      console.error("War declaration notification error:", notifErr);
    }

    // Invalidate all community pages since we don't know the slug
    revalidatePath("/community");
    revalidatePath("/feed");
    return { message: "War declared successfully.", error: null };
  } catch (error) {
    console.error("Declare war error:", error);
    return { error: "Failed to declare war.", message: null };
  }
}

// --- NEW UPDATE ACTION ---
export async function updateCommunitySettingsAction(
  communityId: string,
  payload: { name: string; description: string; color: string }
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();
  const { name, description, color } = payload;

  try {
    const { data: memberData } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", communityId)
      .eq("user_id", profileId)
      .maybeSingle();

    // Only sovereign (rank 0) can update settings
    if (!memberData || !hasFullGovernanceAuthority(memberData.rank_tier)) {
      return { error: "Unauthorized: Only the community Sovereign can update settings.", message: null };
    }

    const finalColor = isValidHex(color) ? color : "#3b82f6";

    const { error } = await supabase
      .from("communities")
      .update({
        name: name.trim(),
        description: description.trim(),
        color: finalColor,
      })
      .eq("id", communityId);

    if (error) throw error;

    logGameEvent("Community", `Settings updated for ${communityId} by ${profileId}`, "info");
    revalidatePath(`/community/${communityId}`);
    revalidatePath("/community");
    revalidatePath("/map");

    return { message: "Community settings updated successfully.", error: null };
  } catch (error) {
    console.error("Update community error:", error);
    return { error: "Failed to update settings.", message: null };
  }
}

// --- NEW SERVER ACTION FOR /KICK COMMAND (REQUEST 3) ---
export async function kickCommunityMemberAction(
  communityId: string,
  usernameToKick: string
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // 1. Check if the current user is sovereign (rank 0)
    const { data: memberData } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", communityId)
      .eq("user_id", profileId)
      .maybeSingle();

    if (!memberData || !hasFullGovernanceAuthority(memberData.rank_tier)) {
      return { error: "Authorization failed. Only the Sovereign can kick members.", message: null };
    }

    // 2. Get the ID of the user to be kicked
    const { data: userToKick } = await supabaseAdmin
      .from("users")
      .select("id, main_community_id")
      .eq("username", usernameToKick)
      .maybeSingle();

    if (!userToKick) {
      return { error: `User "${usernameToKick}" not found.`, message: null };
    }

    // Prevent self-kick
    if (userToKick.id === profileId) {
      return { error: "You cannot kick yourself.", message: null };
    }

    // Prevent kicking another sovereign
    const { data: kickedMemberRole } = await supabaseAdmin
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", communityId)
      .eq("user_id", userToKick.id)
      .maybeSingle();

    if (kickedMemberRole && isSovereign(kickedMemberRole.rank_tier)) {
      return { error: `Cannot kick ${usernameToKick} as they are the Sovereign.`, message: null };
    }

    // 3. Kick the member (delete from community_members)
    const { error: deleteError } = await supabaseAdmin
      .from("community_members")
      .delete()
      .eq("community_id", communityId)
      .eq("user_id", userToKick.id);

    if (deleteError) {
      logGameEvent("Community", `Kick failed for ${usernameToKick} in ${communityId}: ${deleteError.message}`, "error");
      return { error: "Database error during kick operation.", message: null };
    }

    // 4. Optionally remove main_community_id if it was this community
    if (userToKick.main_community_id === communityId) {
      await supabaseAdmin.from("users").update({ main_community_id: null }).eq("id", userToKick.id);
    }

    const { data: kickerProfile } = await supabase
      .from("users")
      .select("username")
      .eq("id", profileId)
      .maybeSingle();

    await notifyCommunityMembers({
      communityId,
      title: "Member removed",
      body: `${usernameToKick} was removed by ${kickerProfile?.username ?? "leadership"}.`,
      triggeredByUserId: profileId,
      metadata: { event_type: "member_kicked", target_username: usernameToKick },
    });

    // 5. Success
    revalidatePath(`/community/${communityId}`);
    logGameEvent("Community", `User ${usernameToKick} was kicked from community ${communityId} by ${profileId}.`, "info");

    return { message: `${usernameToKick} has been kicked from the community.`, error: null };
  } catch (error) {
    console.error("Community kick action error:", error);
    return { error: "Internal server error.", message: null };
  }
}

export async function createCommunityAction(_prev: CommunityActionState, formData: FormData): Promise<CommunityActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const ideologyLabel = String(formData.get("ideologyLabel") ?? "").trim();
  const governanceType = String(formData.get("governanceType") ?? "monarchy").trim();
  let color = String(formData.get("color") ?? "").trim();
  if (!color || !isValidHex(color)) {
    color = "#3b82f6";
  }

  if (!name || !description || !ideologyLabel) return { error: "All fields are required", message: null };
  const { supabase, profileId } = await getProfileId();

  const { data: userRow, error: userRowError } = await supabase
    .from("users")
    .select("main_community_id")
    .eq("id", profileId)
    .maybeSingle();

  if (userRowError) {
    console.error("Membership validation error:", userRowError);
    return { error: "Unable to validate your current community status.", message: null };
  }

  const { data: membershipRecord, error: membershipError } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", profileId)
    .maybeSingle();

  if (membershipError) {
    console.error("Membership validation error:", membershipError);
    return { error: "Unable to validate your current community status.", message: null };
  }

  if (userRow?.main_community_id || membershipRecord?.community_id) {
    return { error: "Leave your current community before creating a new one.", message: null };
  }

  // COMMUNITY CREATION COST: 100 gold
  const COMMUNITY_CREATION_COST = 100;

  // Check user has enough gold
  const { data: userWallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("gold_coins")
    .eq("user_id", profileId)
    .eq("currency_type", "gold")
    .maybeSingle();

  if (walletError) {
    console.error("Wallet check error:", walletError);
    return { error: "Unable to check your gold balance.", message: null };
  }

  const currentGold = Number(userWallet?.gold_coins ?? 0);
  if (currentGold < COMMUNITY_CREATION_COST) {
    return {
      error: `Insufficient gold. You need ${COMMUNITY_CREATION_COST} gold to create a community. You have ${currentGold} gold.`,
      message: null
    };
  }

  // Deduct gold from user
  const { data: deductResult, error: deductError } = await supabase.rpc(
    "deduct_gold_enhanced",
    {
      p_user_id: profileId,
      p_amount: COMMUNITY_CREATION_COST,
      p_transaction_type: "admin_deduction",
      p_description: `Community creation cost: ${name}`,
      p_metadata: { operation: "community_creation" },
      p_scope: "global"
    }
  );

  if (deductError || !deductResult?.success) {
    console.error("Gold deduction error:", deductError);
    return {
      error: deductError?.message || deductResult?.error || "Failed to deduct gold for community creation.",
      message: null
    };
  }

  try {
      // --- LangChain Community Identity Generation ---
      // TODO: Re-enable AI-generated ideology vector with new LLM system
      // For now, use default identity vector
      const identityVector = { ...DEFAULT_IDENTITY_VECTOR } as IdentityVector;
      
      const initialMetrics = calculateCoherenceMetrics({ identity: identityVector, message: identityVector, isHuman: true });
      const finalLabel = generateIdentityLabel(identityVector);
      const slug = generateSlug(name);

      const baseInsertPayload = {
        name,
        description,
        color,
        governance_type: governanceType,
        ideology_label: finalLabel,
        ideology_json: identityVector,
        members_count: 1,
        power_mental: initialMetrics.MP,
        power_physical: 0,
      };

      const insertCommunity = async (includeSlug: boolean) => {
        const selectFields = includeSlug ? "id, slug" : "id";
        return supabase
          .from("communities")
          .insert({
            ...baseInsertPayload,
            ...(includeSlug ? { slug } : {}),
          })
          .select(selectFields)
          .single();
      };

      let insertResult = await insertCommunity(true);
      if (isColumnMissingError(insertResult.error, "slug")) {
        insertResult = await insertCommunity(false);
      }

      if (insertResult.error || !insertResult.data) {
        return { error: insertResult.error?.message ?? "DB Error", message: null };
      }

      const newCommunity = insertResult.data as unknown as { id: string; slug?: string };

      await supabase.from("community_members").insert({ community_id: newCommunity.id, user_id: profileId, role: "founder", rank_tier: 0 });
      await supabase.from("users").update({ main_community_id: newCommunity.id }).eq("id", profileId);

      // Add the 100 gold to community treasury (the trigger will auto-create currency with 0 supply)
      const { error: treasuryError } = await supabase.rpc("add_to_community_treasury", {
        p_community_id: newCommunity.id,
        p_currency_type: "gold",
        p_community_currency_id: null,
        p_amount: COMMUNITY_CREATION_COST,
        p_description: `Initial treasury funding from ${name} creation`
      });

      if (treasuryError) {
        console.error("Treasury funding error:", treasuryError);
        // Don't fail the entire operation, but log it
      }

      // Apply morale for community creation
      await applyActionMorale(profileId, "COMMUNITY_CREATE");

      revalidatePath("/community"); revalidatePath("/profile"); revalidatePath("/feed");
      return {
        message: `Community created! ${COMMUNITY_CREATION_COST} gold transferred to treasury.`,
        error: null,
        communityId: newCommunity.id ?? null,
        communitySlug: newCommunity.slug ?? null,
      };
  } catch (error) {
      console.error("Community creation AI error:", error);
      return { error: "AI processing failed.", message: null };
  }
}

export async function joinCommunityAction(formData: FormData): Promise<CommunityActionState> {
  const communityId = String(formData.get("communityId") ?? "").trim();
  if (!communityId) {
    return { error: "Community ID is required.", message: null };
  }

  const { supabase, profileId } = await getProfileId();

  try {
    const { data: userRow, error: userRowError } = await supabase
      .from("users")
      .select("main_community_id")
      .eq("id", profileId)
      .maybeSingle();

    if (userRowError) {
      console.error("Join membership validation error:", userRowError);
      return { error: "Unable to verify your current community status.", message: null };
    }

    const { data: membershipRecord, error: membershipError } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", profileId)
      .maybeSingle();

    if (membershipError) {
      console.error("Join membership validation error:", membershipError);
      return { error: "Unable to verify your current community status.", message: null };
    }

    const currentCommunityId =
      membershipRecord?.community_id ?? userRow?.main_community_id ?? null;

    if (currentCommunityId && currentCommunityId !== communityId) {
      return {
        error: "You are already a member of another community. Leave it before joining this one.",
        message: null,
      };
    }

    const refreshPaths = () => {
      revalidatePath("/community");
      revalidatePath("/profile");
      revalidatePath("/feed");
    };

    if (currentCommunityId === communityId) {
      if (userRow?.main_community_id !== communityId) {
        const { error } = await supabase
          .from("users")
          .update({ main_community_id: communityId })
          .eq("id", profileId);

        if (error) {
          console.error("Join community update error:", error);
          return { error: error.message ?? "Failed to synchronize your community membership.", message: null };
        }
      }

      refreshPaths();
      return { message: "You are already a member of this community.", error: null };
    }

    const { error: insertError } = await supabase.from("community_members").insert({
      community_id: communityId,
      user_id: profileId,
      role: "member",
    });

    if (insertError) {
      console.error("Join community insert error:", insertError);
      return { error: insertError.message ?? "Failed to join the community.", message: null };
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ main_community_id: communityId })
      .eq("id", profileId);

    if (updateError) {
      console.error("Join community update error:", updateError);
      return { error: updateError.message ?? "Failed to save your community status.", message: null };
    }

    await applyActionMorale(profileId, "COMMUNITY_JOIN");

    const { data: joinerProfile } = await supabase
      .from("users")
      .select("username")
      .eq("id", profileId)
      .maybeSingle();

    await notifyCommunityMembers({
      communityId,
      title: "Member joined",
      body: `${joinerProfile?.username ?? "A new member"} joined the community.`,
      triggeredByUserId: profileId,
      metadata: { event_type: "member_joined" },
    });

    // Update join-community mission
    await updateMissionProgress("join-community", 1, profileId);

    // Trigger ideology recalculation (new member affects community ideology)
    recalculateIdeologyDebounced(communityId).catch((err) =>
      console.error("[Join] Failed to recalculate ideology:", err)
    );

    refreshPaths();
    return { message: "Successfully joined the community.", error: null };
  } catch (error) {
    console.error("Join community error:", error);
    return { error: "Unable to join the community right now.", message: null };
  }
}

export async function leaveCommunityAction() {
  const { supabase, profileId } = await getProfileId();
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("main_community_id, username")
    .eq("id", profileId)
    .maybeSingle();

  if (userError) {
    console.error("Leave membership validation error:", userError);
    throw new Error("Unable to verify your current community.");
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from("community_members")
    .select("community_id")
    .eq("user_id", profileId)
    .maybeSingle();

  if (membershipError) {
    console.error("Leave community membership fetch error:", membershipError);
    throw new Error("Failed to lookup your membership.");
  }

  const communityId = membershipRow?.community_id ?? userRow?.main_community_id;
  if (!communityId) return;

  await notifyCommunityMembers({
    communityId,
    title: "Member departed",
    body: `${userRow?.username ?? "A member"} left the community.`,
    triggeredByUserId: profileId,
    metadata: { event_type: "member_left" },
  });

  const { error: deleteError } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", profileId);

  if (deleteError) {
    console.error("Leave community delete error:", deleteError);
    throw new Error(deleteError.message ?? "Failed to leave the community.");
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ main_community_id: null })
    .eq("id", profileId);

  if (updateError) {
    console.error("Leave community update error:", updateError);
    throw new Error(updateError.message ?? "Failed to clear your community reference.");
  }

  // Trigger ideology recalculation (lost member affects community ideology)
  recalculateIdeologyDebounced(communityId).catch((err) =>
    console.error("[Leave] Failed to recalculate ideology:", err)
  );

  revalidatePath("/community");
  revalidatePath("/profile");
  revalidatePath("/feed");
}

// --- GOVERNANCE SYSTEM ACTIONS ---

/**
 * Assign a rank tier to a community member
 * Only members with canAssignRanks permission (usually rank 0) can assign
 */
export async function assignRankAction(
  communityId: string,
  targetUserId: string,
  newRankTier: number
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Get the governance type
    const { data: communityData } = await supabase
      .from("communities")
      .select("governance_type")
      .eq("id", communityId)
      .maybeSingle();

    const governanceType = communityData?.governance_type || "monarchy";

    // Check if requester has permission to assign ranks
    const { data: requesterData } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", communityId)
      .eq("user_id", profileId)
      .maybeSingle();

    if (!requesterData) {
      return { error: "You are not a member of this community.", message: null };
    }

    // Verify the requester has permission (only rank 0/sovereign can assign)
    if (!hasFullGovernanceAuthority(requesterData.rank_tier)) {
      return { error: "Only the Sovereign can assign ranks.", message: null };
    }

    // Validate the rank assignment against governance rules
    const { data: currentRankMembers } = await supabase
      .from("community_members")
      .select("id")
      .eq("community_id", communityId)
      .eq("rank_tier", newRankTier);

    const currentCount = currentRankMembers?.length || 0;
    const validation = validateRankAssignment(governanceType, newRankTier, currentCount);

    if (!validation.valid) {
      return { error: validation.error || "Invalid rank assignment.", message: null };
    }

    // Update the target user's rank
    const { error } = await supabase
      .from("community_members")
      .update({ rank_tier: newRankTier })
      .eq("community_id", communityId)
      .eq("user_id", targetUserId);

    if (error) {
      console.error("Rank assignment error:", error);
      return { error: "Failed to assign rank.", message: null };
    }

    logGameEvent(
      "Community",
      `${profileId} assigned rank ${newRankTier} to ${targetUserId} in ${communityId}`,
      "info"
    );

    const { data: targetProfile } = await supabaseAdmin
      .from("users")
      .select("username")
      .eq("id", targetUserId)
      .maybeSingle();

    await notifyCommunityMembers({
      communityId,
      title: "Role updated",
      body: `${targetProfile?.username ?? "A member"} is now ${getRankLabel(governanceType, newRankTier)}.`,
      triggeredByUserId: profileId,
      metadata: { event_type: "role_updated", rank_tier: newRankTier },
    });

    // Invalidate all community pages since we don't know the slug
    revalidatePath("/community");
    return { message: "Rank assigned successfully.", error: null };
  } catch (error) {
    console.error("Assign rank error:", error);
    return { error: "Failed to assign rank.", message: null };
  }
}

/**
 * Claim the throne (rank 0) if no sovereign exists in the community
 */
export async function claimThroneAction(
  communityId: string
): Promise<CommunityActionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    console.log("[claimThroneAction] User attempting to claim throne:", {
      communityId,
      profileId,
    });

    // Check if a sovereign already exists using unified role system
    const { data: sovereignData, error: sovereignError } = await supabase
      .from("community_members")
      .select("id, user_id, rank_tier")
      .eq("community_id", communityId)
      .eq("rank_tier", 0)
      .maybeSingle();

    console.log("[claimThroneAction] Sovereign check result:", {
      sovereignData,
      sovereignError,
    });

    if (sovereignData && isSovereign(sovereignData.rank_tier)) {
      console.log("[claimThroneAction] Sovereign already exists:", sovereignData);
      return { error: "This community already has a Sovereign.", message: null };
    }

    // Check if user is a member
    const { data: memberData, error: memberError } = await supabase
      .from("community_members")
      .select("id, rank_tier, user_id")
      .eq("community_id", communityId)
      .eq("user_id", profileId)
      .maybeSingle();

    console.log("[claimThroneAction] User member check result:", {
      memberData,
      memberError,
    });

    if (!memberData) {
      console.log("[claimThroneAction] User is not a member of this community");
      return { error: "You must be a member of this community first.", message: null };
    }

    console.log("[claimThroneAction] User is member, current rank_tier:", memberData.rank_tier);

    // Promote to rank 0
    const { error } = await supabase
      .from("community_members")
      .update({ rank_tier: 0 })
      .eq("community_id", communityId)
      .eq("user_id", profileId);

    if (error) {
      console.error("[claimThroneAction] Database update error:", error);
      return { error: "Failed to claim throne.", message: null };
    }

    console.log("[claimThroneAction] Successfully claimed throne");
    logGameEvent("Community", `${profileId} claimed throne in ${communityId}`, "info");

    const { data: claimantProfile } = await supabase
      .from("users")
      .select("username")
      .eq("id", profileId)
      .maybeSingle();

    await notifyCommunityMembers({
      communityId,
      title: "Sovereign claimed",
      body: `${claimantProfile?.username ?? "A member"} claimed the sovereign role.`,
      triggeredByUserId: profileId,
      metadata: { event_type: "sovereign_claimed" },
    });

    // Invalidate the community detail page - we don't know the slug, so invalidate all community pages
    revalidatePath("/community");
    return { message: "You have claimed the throne!", error: null };
  } catch (error) {
    console.error("[claimThroneAction] Exception:", error);
    return { error: "Failed to claim throne.", message: null };
  }
}

// ============================================================================
// GET ALL COMMUNITIES
// ============================================================================

export interface CommunityBasic {
  id: string;
  name: string;
  slug: string;
}

export async function getAllCommunities(): Promise<CommunityBasic[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("communities")
    .select("id, name, slug")
    .order("name");

  if (error) {
    console.error("Error fetching communities:", error);
    return [];
  }

  return data || [];
}

/**
 * Get the current user's role in a specific community
 * Used for checking if user is r0 (sovereign) in exchange market
 */
export async function getUserCommunityRole(communityId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();

  // Get current auth user
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    console.error("[getUserCommunityRole] Auth user not found");
    return null;
  }

  // Convert auth ID to public user ID by looking up in users table
  const { data: publicUser, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (userError || !publicUser) {
    console.error("[getUserCommunityRole] Could not find public user ID:", userError);
    return null;
  }

  const publicUserId = publicUser.id;
  console.log("[getUserCommunityRole] Fetching role for auth:", authUser.id, "public:", publicUserId, "community:", communityId);

  // Get user's role in the community using PUBLIC user ID
  const { data: memberData, error } = await supabase
    .from("community_members")
    .select("role")
    .eq("user_id", publicUserId)
    .eq("community_id", communityId)
    .maybeSingle();

  if (error) {
    console.error("[getUserCommunityRole] Error fetching community role:", error);
    return null;
  }

  const role = memberData?.role || null;
  const isR0 = role === "r0";
  console.log("[getUserCommunityRole] RESULT - role:", role, "| isR0(sovereign):", isR0);
  return role;
}

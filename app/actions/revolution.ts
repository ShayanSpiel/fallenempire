"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";
import { recordMoraleEvent } from "@/lib/morale";
import {
  notifyRevolutionStarted,
  notifyCivilWarStarted,
} from "@/lib/services/community-notifications";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RevolutionState {
  message: string | null;
  error?: string | null;
  data?: Record<string, any>;
}

export interface RevolutionData {
  id: string;
  community_id: string;
  leader_id: string;
  target_id: string;
  status: "agitation" | "battle" | "success" | "failed" | "negotiated";
  current_supports: number;
  required_supports: number;
  started_at: string;
  agitation_expires_at: string;
  battle_started_at?: string;
  is_leader_exiled: boolean;
  cooldown_until?: string;
}

type SupabaseError = {
  code?: string;
};

function isMissingObjectError(error: SupabaseError | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "PGRST202";
}

// ============================================================================
// HELPER: Get authenticated user profile
// ============================================================================

async function getProfileId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!profile) throw new Error("Profile not found");
  return { supabase, profileId: profile.id };
}

async function getOptionalProfileContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, profileId: null };
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!profile) return { supabase, profileId: null };
  return { supabase, profileId: profile.id };
}

// ============================================================================
// HELPER: Get community data
// ============================================================================

async function getCommunityData(communityId: string) {
  const { supabase } = await getProfileId();
  const { data: community, error } = await supabase
    .from("communities")
    .select("*")
    .eq("id", communityId)
    .maybeSingle();

  if (error || !community) {
    throw new Error("Community not found");
  }

  return community;
}

// ============================================================================
// ACTION: Start an uprising
// ============================================================================

export async function startUprisingAction(
  communityId: string
): Promise<RevolutionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Call RPC to start uprising (validates everything)
    const { data, error } = await supabase.rpc("start_uprising", {
      p_user_id: profileId,
      p_community_id: communityId,
    });

    if (error || !data.success) {
      return {
        error: data?.message || error?.message || "Failed to start uprising",
        message: null,
      };
    }

    logGameEvent("Community", `${profileId} started uprising in ${communityId}`, "info");

    // Apply morale event
    await recordMoraleEvent({
      userId: profileId,
      eventType: "community",
      eventTrigger: "uprising:started",
      moraleChange: -5, // Starting revolution slightly drains morale
      sourceCommunityId: communityId,
    });

    // Get leader username for notification
    const { data: leaderUser } = await supabase
      .from("users")
      .select("username")
      .eq("id", profileId)
      .single();

    // Notify community members about revolution
    if (leaderUser) {
      await notifyRevolutionStarted(
        communityId,
        leaderUser.username,
        profileId
      );
    }

    revalidatePath(`/community`);
    return {
      message: "Uprising started! Rally support to begin civil war.",
      error: null,
      data: {
        rebellion_id: data.rebellion_id,
        required_supports: data.required_supports,
      },
    };
  } catch (error) {
    console.error("Start uprising error:", error);
    return {
      error: "Failed to start uprising",
      message: null,
    };
  }
}

// ============================================================================
// ACTION: Support an uprising
// ============================================================================

export async function supportUprisingAction(
  rebellionId: string
): Promise<RevolutionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Call RPC to add support
    const { data, error } = await supabase.rpc("support_uprising", {
      p_user_id: profileId,
      p_rebellion_id: rebellionId,
    });

    if (error || !data.success) {
      return {
        error: data?.message || error?.message || "Failed to support uprising",
        message: null,
      };
    }

    logGameEvent("Community", `${profileId} supported uprising ${rebellionId}`, "info");

    // Apply morale event
    await recordMoraleEvent({
      userId: profileId,
      eventType: "community",
      eventTrigger: "uprising:support",
      moraleChange: 3, // Supporting revolution gives small morale boost
      metadata: { rebellion_id: rebellionId },
    });

    // If battle started, notify community members
    if (data.battle_started) {
      // Get rebellion details for notification
      const { data: rebellion } = await supabase
        .from("rebellions")
        .select("leader_id, community_id")
        .eq("id", rebellionId)
        .single();

      if (rebellion) {
        const { data: leaderUser } = await supabase
          .from("users")
          .select("username")
          .eq("id", rebellion.leader_id)
          .single();

        if (leaderUser) {
          await notifyCivilWarStarted(
            rebellion.community_id,
            leaderUser.username,
            rebellion.leader_id
          );
        }
      }
    }

    // If battle started, notify
    const battleStartedMessage = data.battle_started
      ? "Threshold reached! Civil war has begun!"
      : `Support added (${data.current_supports}/${data.required_supports})`;

    revalidatePath(`/community`);
    return {
      message: battleStartedMessage,
      error: null,
      data,
    };
  } catch (error) {
    console.error("Support uprising error:", error);
    return {
      error: "Failed to support uprising",
      message: null,
    };
  }
}

// ============================================================================
// ACTION: Get active rebellion for community
// ============================================================================

export async function getActiveRebellionAction(
  communityId: string
): Promise<RevolutionData | null> {
  const { supabase, profileId } = await getOptionalProfileContext();
  if (!profileId) return null;

  try {
    const { data, error } = await supabase
      .from("rebellions")
      .select("*")
      .eq("community_id", communityId)
      .in("status", ["agitation", "battle"])
      .maybeSingle();

    if (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      console.error("Get rebellion error:", error);
      return null;
    }

    return data as RevolutionData;
  } catch (error) {
    console.error("Get active rebellion error:", error);
    return null;
  }
}

// ============================================================================
// ACTION: Get rebellion details
// ============================================================================

export async function getRebellionDetailsAction(
  rebellionId: string
): Promise<RevolutionData | null> {
  const { supabase, profileId } = await getOptionalProfileContext();
  if (!profileId) return null;

  try {
    const { data, error } = await supabase
      .from("rebellions")
      .select("*")
      .eq("id", rebellionId)
      .maybeSingle();

    if (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      console.error("Get rebellion details error:", error);
      return null;
    }

    return data as RevolutionData;
  } catch (error) {
    console.error("Get rebellion details error:", error);
    return null;
  }
}

// ============================================================================
// ACTION: Get supporter count for rebellion
// ============================================================================

export async function getSupporterCountAction(
  rebellionId: string
): Promise<{ count: number; supporters: any[] } | null> {
  const { supabase, profileId } = await getOptionalProfileContext();
  if (!profileId) return null;

  try {
    const { data, error } = await supabase
      .from("rebellion_supports")
      .select("user_id, created_at, users(username, avatar_url)")
      .eq("rebellion_id", rebellionId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      console.error("Get supporters error:", error);
      return null;
    }

    return {
      count: data?.length || 0,
      supporters: data || [],
    };
  } catch (error) {
    console.error("Get supporter count error:", error);
    return null;
  }
}

// ============================================================================
// ACTION: Exile uprising leader (Governor only)
// ============================================================================

export async function exileUprisingLeaderAction(
  rebellionId: string
): Promise<RevolutionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Call RPC to exile leader
    const { data, error } = await supabase.rpc("exile_uprising_leader", {
      p_rebellion_id: rebellionId,
      p_governor_id: profileId,
    });

    if (error || !data.success) {
      return {
        error: data?.message || error?.message || "Failed to exile leader",
        message: null,
      };
    }

    logGameEvent("Community", `${profileId} exiled uprising leader in ${rebellionId}`, "info");

    // Record morale penalty from RPC (already applied)
    revalidatePath(`/community`);
    return {
      message: "The King/President Exiled The Leader of Revolution and is after him to cut his head off!",
      error: null,
    };
  } catch (error) {
    console.error("Exile leader error:", error);
    return {
      error: "Failed to exile leader",
      message: null,
    };
  }
}

// ============================================================================
// ACTION: Reinvite exiled leader (Advisor/Secretary only)
// ============================================================================

export async function reinviteExiledLeaderAction(
  rebellionId: string
): Promise<RevolutionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Call RPC to reinvite
    const { data, error } = await supabase.rpc("reinvite_exiled_leader", {
      p_rebellion_id: rebellionId,
      p_inviter_id: profileId,
    });

    if (error || !data.success) {
      return {
        error: data?.message || error?.message || "Failed to reinvite leader",
        message: null,
      };
    }

    logGameEvent("Community", `${profileId} reinvited exiled leader in ${rebellionId}`, "info");

    revalidatePath(`/community`);
    return {
      message: "The Leader of the Revolution is invited back to continue the uprising... Join him if you are with him.",
      error: null,
    };
  } catch (error) {
    console.error("Reinvite leader error:", error);
    return {
      error: "Failed to reinvite leader",
      message: null,
    };
  }
}

// ============================================================================
// ACTION: Request negotiation (Governor only)
// ============================================================================

export async function requestNegotiationAction(
  rebellionId: string
): Promise<RevolutionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Call RPC to request negotiation
    const { data, error } = await supabase.rpc("request_negotiation", {
      p_rebellion_id: rebellionId,
      p_governor_id: profileId,
    });

    if (error || !data.success) {
      return {
        error: data?.message || error?.message || "Failed to request negotiation",
        message: null,
      };
    }

    logGameEvent("Community", `${profileId} requested negotiation for uprising ${rebellionId}`, "info");

    revalidatePath(`/community`);
    return {
      message: "Negotiation request sent to the revolution leader.",
      error: null,
      data: {
        negotiation_id: data.negotiation_id,
      },
    };
  } catch (error) {
    console.error("Request negotiation error:", error);
    return {
      error: "Failed to request negotiation",
      message: null,
    };
  }
}

// ============================================================================
// ACTION: Respond to negotiation (Rebel leader only)
// ============================================================================

export async function respondToNegotiationAction(
  negotiationId: string,
  accepted: boolean
): Promise<RevolutionState> {
  const { supabase, profileId } = await getProfileId();

  try {
    // Call RPC to respond
    const { data, error } = await supabase.rpc("respond_to_negotiation", {
      p_negotiation_id: negotiationId,
      p_leader_id: profileId,
      p_accepted: accepted,
    });

    if (error || !data.success) {
      return {
        error: data?.message || error?.message || "Failed to respond to negotiation",
        message: null,
      };
    }

    logGameEvent("Community", `${profileId} ${accepted ? "accepted" : "rejected"} negotiation ${negotiationId}`, "info");

    revalidatePath(`/community`);
    return {
      message: data.message,
      error: null,
      data: {
        accepted: data.accepted,
      },
    };
  } catch (error) {
    console.error("Respond to negotiation error:", error);
    return {
      error: "Failed to respond to negotiation",
      message: null,
    };
  }
}

// ============================================================================
// ACTION: Get active negotiation for rebellion
// ============================================================================

export async function getActiveNegotiationAction(
  rebellionId: string
): Promise<any | null> {
  const { supabase, profileId } = await getOptionalProfileContext();
  if (!profileId) return null;

  try {
    const { data, error } = await supabase
      .from("rebellion_negotiations")
      .select("*")
      .eq("rebellion_id", rebellionId)
      .is("response_at", null)
      .maybeSingle();

    if (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      console.error("Get negotiation error:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Get active negotiation error:", error);
    return null;
  }
}

// ============================================================================
// ACTION: Check if user can start revolution
// ============================================================================

export async function canStartRevolutionAction(
  communityId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { supabase, profileId } = await getOptionalProfileContext();
  if (!profileId) return { allowed: false, reason: "Unauthorized" };

  try {
    const { data, error } = await supabase.rpc("can_start_revolution", {
      p_user_id: profileId,
      p_community_id: communityId,
    });

    if (error) {
      if (isMissingObjectError(error)) {
        return { allowed: false, reason: "Revolution system unavailable" };
      }
      console.error("Can start revolution error:", error);
      return { allowed: false, reason: "Error checking revolution eligibility" };
    }

    return {
      allowed: data.allowed,
      reason: data.reason,
    };
  } catch (error) {
    console.error("Can start revolution error:", error);
    return { allowed: false, reason: "Error checking revolution eligibility" };
  }
}

// ============================================================================
// ACTION: Get rebellion history
// ============================================================================

export async function getRebellionHistoryAction(
  communityId: string
): Promise<RevolutionData[]> {
  const { supabase, profileId } = await getOptionalProfileContext();
  if (!profileId) return [];

  try {
    const { data, error } = await supabase
      .from("rebellions")
      .select("*")
      .eq("community_id", communityId)
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      if (isMissingObjectError(error)) {
        return [];
      }
      console.error("Get rebellion history error:", error);
      return [];
    }

    return data as RevolutionData[];
  } catch (error) {
    console.error("Get rebellion history error:", error);
    return [];
  }
}

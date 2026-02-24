"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export type MissionType = "daily" | "weekly";
export type MissionStatus = "incomplete" | "complete" | "claimed";

export type MissionData = {
  id: string;
  user_id: string;
  mission_id: string;
  mission_type: MissionType;
  progress: number;
  goal: number;
  status: MissionStatus;
  xp_reward: number;
  reset_at: string;
};

/**
 * Claim mission reward and award XP
 */
export async function claimMissionReward(missionId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Not authenticated" };

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) return { error: "Profile not found" };

    // Call claim function
    const { data, error } = await supabase.rpc("claim_mission_reward", {
      p_user_id: profile.id,
      p_mission_id: missionId,
    });

    if (error) {
      console.error("Claim mission error:", error);
      return { error: error.message };
    }

    const result = data?.[0];
    if (!result?.success) {
      return { error: result?.error_message || "Failed to claim reward" };
    }

    revalidatePath("/feed");
    return { success: true, xpReward: result.xp_awarded };
  } catch (error) {
    console.error("Error claiming mission reward:", error);
    return { error: "Failed to claim reward" };
  }
}

/**
 * Update mission progress
 *
 * @param missionId - The mission to update
 * @param increment - How much to increment (default 1)
 * @param userId - Optional user ID (if not provided, will try to get from auth)
 */
export async function updateMissionProgress(
  missionId: string,
  increment: number = 1,
  userId?: string
) {
  try {
    const supabase = await createSupabaseServerClient();
    let targetUserId = userId;

    // If userId not provided, try to get from auth
    if (!targetUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log("Mission update skipped: Not authenticated and no userId provided");
        return { error: "Not authenticated" };
      }

      const { data: profile } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .maybeSingle();

      if (!profile) {
        console.log("Mission update skipped: Profile not found");
        return { error: "Profile not found" };
      }

      targetUserId = profile.id;
    }

    // Call update function
    const { data, error } = await supabase.rpc("update_mission_progress", {
      p_user_id: targetUserId,
      p_mission_id: missionId,
      p_increment: increment,
    });

    if (error) {
      console.error("Update mission error:", error);
      return { error: error.message };
    }

    const result = data?.[0];
    if (!result?.success) {
      console.log(`Mission update failed for ${missionId}:`, result?.mission_status);
      return { error: result?.mission_status || "Failed to update" };
    }

    const isComplete = result.is_complete;
    console.log(
      `✓ Mission ${missionId} progress: ${result.new_progress}/${result.goal} ${isComplete ? "✅ COMPLETE" : ""}`
    );

    revalidatePath("/feed");
    return {
      success: true,
      complete: isComplete,
      newProgress: result.new_progress,
      goal: result.goal,
    };
  } catch (error) {
    console.error("Error updating mission progress:", error);
    return { error: "Failed to update progress" };
  }
}

/**
 * Get user's current missions
 */
export async function getUserMissions(userId: string): Promise<MissionData[]> {
  try {
    const supabase = await createSupabaseServerClient();

    // Initialize missions if they don't exist
    await supabase.rpc("initialize_user_missions", { p_user_id: userId });

    // Fetch missions
    const { data: missions, error } = await supabase
      .from("user_missions")
      .select("*")
      .eq("user_id", userId)
      .order("mission_type", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Get missions error:", error);
      return [];
    }

    return (missions || []).map((m) => ({
      id: m.id,
      user_id: m.user_id,
      mission_id: m.mission_id,
      mission_type: m.mission_type as MissionType,
      progress: m.progress,
      goal: m.goal,
      status: m.status as MissionStatus,
      xp_reward: m.xp_reward,
      reset_at: m.reset_at,
    }));
  } catch (error) {
    console.error("Error getting user missions:", error);
    return [];
  }
}

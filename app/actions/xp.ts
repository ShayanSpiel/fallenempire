"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { XP_REWARDS } from "@/lib/progression";

interface AwardXpResult {
  success: boolean;
  xpAwarded: number;
  newLevel: number;
  levelUps: number;
  newTotalXp: number;
  error?: string;
}

/**
 * Award XP to user for an activity
 * Handles daily cap enforcement server-side
 *
 * @param userId - User ID to award XP to
 * @param source - Source of XP (battle, post, comment, training)
 * @param metadata - Optional metadata (damage, battle_id, etc) */
export async function awardXp(
  userId: string,
  source: "battle" | "post" | "comment" | "training",
  metadata: Record<string, unknown> = {},
): Promise<AwardXpResult> {
  const supabase = await createSupabaseServerClient();

  try {
    // Validate user exists and belongs to current session
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser || authUser.id !== userId) {
      return {
        success: false,
        xpAwarded: 0,
        newLevel: 1,
        levelUps: 0,
        newTotalXp: 0,
        error: "Unauthorized",
      };
    }

    // Calculate XP amount based on source
    let xpAmount: number;

    switch (source) {
      case "battle":
        xpAmount = metadata.damage ? XP_REWARDS.battle(metadata.damage as number) : 0;
        break;
      case "post":
        xpAmount = XP_REWARDS.post();
        break;
      case "comment":
        xpAmount = XP_REWARDS.comment();
        break;
      case "training":
        xpAmount = XP_REWARDS.training();
        break;
      default:
        xpAmount = 0;
    }

    if (xpAmount <= 0) {
      return {
        success: false,
        xpAwarded: 0,
        newLevel: 1,
        levelUps: 0,
        newTotalXp: 0,
        error: "Invalid XP amount",
      };
    }

    // Call RPC function to award XP with cap enforcement
    const { data, error } = await supabase.rpc("award_xp", {
      p_user_id: userId,
      p_xp_amount: xpAmount,
      p_source: source,
      p_metadata: metadata,
    });

    if (error) {
      console.error("RPC award_xp error:", error);
      return {
        success: false,
        xpAwarded: 0,
        newLevel: 1,
        levelUps: 0,
        newTotalXp: 0,
        error: error.message,
      };
    }

    return {
      success: data?.success ?? false,
      xpAwarded: data?.xp_awarded ?? 0,
      newLevel: data?.new_level ?? 1,
      levelUps: data?.level_ups ?? 0,
      newTotalXp: data?.new_total_xp ?? 0,
    };
  } catch (err) {
    console.error("Error awarding XP:", err);
    return {
      success: false,
      xpAwarded: 0,
      newLevel: 1,
      levelUps: 0,
      newTotalXp: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get user progression data
 */
export async function getUserProgression(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc("get_user_progression", {
      p_user_id: userId,
    });

    if (error) {
      console.error("RPC get_user_progression error:", error);
      return null;
    }

    return data?.[0] ?? null;
  } catch (err) {
    console.error("Error getting progression:", err);
    return null;
  }
}

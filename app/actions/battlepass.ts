"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { BattlePassData } from "@/components/battlepass/types";

/**
 * Get comprehensive battle pass data for the current user
 */
export async function getBattlePassData(): Promise<BattlePassData | null> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return null;
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return null;
    }

    // Call database function to get all battle pass data
    const { data, error } = await supabase.rpc("get_user_battle_pass_data", {
      p_user_id: profile.id,
    });

    if (error) {
      console.error("Error fetching battle pass data:", error);
      return null;
    }

    return data as BattlePassData;
  } catch (error) {
    console.error("Error in getBattlePassData:", error);
    return null;
  }
}

/**
 * Check and award daily login XP (100 XP once per day)
 */
export async function checkDailyLoginXP(): Promise<{
  success: boolean;
  message?: string;
  xp_awarded?: number;
  already_claimed?: boolean;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    // Call database function to check and award daily login
    const { data, error } = await supabase.rpc("check_and_award_daily_login_xp", {
      p_user_id: profile.id,
    });

    if (error) {
      console.error("Error checking daily login:", error);
      return { success: false, message: error.message };
    }

    // Revalidate paths that show battle pass data
    if (data.success) {
      revalidatePath("/feed");
      revalidatePath("/battlepass");
    }

    return data;
  } catch (error) {
    console.error("Error in checkDailyLoginXP:", error);
    return { success: false, message: "Internal error" };
  }
}

/**
 * Award battle pass XP
 * @param xpAmount - Amount of XP to award
 * @param source - Source of XP (mission, training, battle, etc.)
 */
export async function awardBattlePassXP(
  xpAmount: number,
  source: string = "mission"
): Promise<{
  success: boolean;
  message?: string;
  old_xp?: number;
  new_xp?: number;
  unlocked_tiers?: number;
}> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Unauthorized" };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return { success: false, message: "Profile not found" };
    }

    // Call database function to award XP
    const { data, error } = await supabase.rpc("award_battle_pass_xp", {
      p_user_id: profile.id,
      p_xp_amount: xpAmount,
      p_source: source,
    });

    if (error) {
      console.error("Error awarding battle pass XP:", error);
      return { success: false, message: error.message };
    }

    // Revalidate if tiers were unlocked
    if (data.success && data.unlocked_tiers > 0) {
      revalidatePath("/feed");
      revalidatePath("/battlepass");
    }

    return data;
  } catch (error) {
    console.error("Error in awardBattlePassXP:", error);
    return { success: false, message: "Internal error" };
  }
}

/**
 * HEAT SYSTEM MIDDLEWARE
 * Spam protection via action rate limiting
 *
 * How it works:
 * - Each action adds +10 heat
 * - Heat decays by 5 per minute
 * - When heat > 100, actions fail (spam protection)
 * - When heat > 150, actions are blocked more aggressively
 * - When heat = 200, all actions blocked (cooldown required)
 *
 * Real-world example:
 * - User does 10 actions in 1 minute: heat = 100 (threshold)
 * - User does 15 actions in 1 minute: heat = 150 (warning)
 * - User does 20+ actions in 1 minute: heat = 200 (timeout)
 *
 * To recover from heat:
 * - Wait 20 minutes for heat to drop from 200 to 0
 * - Wait 3 minutes to get from 100 to 0
 */

import { supabaseAdmin } from "./supabaseAdmin";

export interface HeatCheckResult {
  allowed: boolean;
  currentHeat: number;
  message: string;
  cooldownMinutes?: number;
  warningLevel: "safe" | "caution" | "danger" | "blocked";
}

/**
 * Check if user action is allowed based on heat
 * Call this before processing ANY user action
 */
export async function checkHeat(userId: string): Promise<HeatCheckResult> {
  try {
    // Get current user state
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("action_heat, last_action_timestamp")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return {
        allowed: false,
        currentHeat: 0,
        message: "User not found",
        warningLevel: "blocked",
      };
    }

    // Calculate heat decay
    let currentHeat = user.action_heat || 0;
    if (user.last_action_timestamp) {
      const minutesElapsed = (Date.now() - new Date(user.last_action_timestamp).getTime()) / (1000 * 60);
      const decayAmount = minutesElapsed * 5; // 5 heat per minute
      currentHeat = Math.max(0, currentHeat - decayAmount);
    }

    // Determine status
    let allowed = true;
    let warningLevel: "safe" | "caution" | "danger" | "blocked" = "safe";
    let message = "Action allowed";
    let cooldownMinutes: number | undefined;

    if (currentHeat <= 50) {
      warningLevel = "safe";
      message = "Action allowed (safe)";
    } else if (currentHeat <= 100) {
      warningLevel = "caution";
      message = "Action allowed (caution: getting warm)";
    } else if (currentHeat <= 150) {
      warningLevel = "danger";
      message = "Action blocked (too much spam - cool down!)";
      allowed = false;
      cooldownMinutes = Math.ceil((currentHeat - 100) / 5); // ~5-10 min
    } else {
      warningLevel = "blocked";
      message = "Action blocked (timeout - you're in cooldown)";
      allowed = false;
      cooldownMinutes = Math.ceil(currentHeat / 5); // Up to 40 min
    }

    return { allowed, currentHeat, message, warningLevel, cooldownMinutes };
  } catch (error) {
    console.error("Heat check error:", error);
    return {
      allowed: false,
      currentHeat: 0,
      message: "Heat check failed",
      warningLevel: "blocked",
    };
  }
}

/**
 * Apply heat to user after action
 * Call this AFTER successful action execution
 */
export async function applyHeat(
  userId: string,
  actionType: string,
  targetId?: string
): Promise<{ success: boolean; newHeat: number; message: string }> {
  try {
    // Use the database function we created
    const { data: result, error } = await supabaseAdmin.rpc("record_action_and_heat", {
      p_user_id: userId,
      p_action_type: actionType,
      p_target_id: targetId || null,
    });

    if (error) {
      console.error("Heat application error:", error);
      return {
        success: false,
        newHeat: 0,
        message: "Failed to apply heat",
      };
    }

    const resultData = result as any;
    return {
      success: resultData.action_allowed,
      newHeat: resultData.current_heat,
      message: resultData.message,
    };
  } catch (error) {
    console.error("Failed to apply heat:", error);
    return {
      success: false,
      newHeat: 0,
      message: "Heat system error",
    };
  }
}

/**
 * Get heat status for dashboard display
 */
export async function getHeatStatus(userId: string): Promise<{
  currentHeat: number;
  heatLevel: string;
  recoveryTime: number;
  nextActionAllowed: boolean;
}> {
  try {
    const result = await checkHeat(userId);

    let heatLevel = "";
    let recoveryTime = 0;

    if (result.currentHeat <= 50) {
      heatLevel = "Cool";
      recoveryTime = 0;
    } else if (result.currentHeat <= 100) {
      heatLevel = "Warm";
      recoveryTime = Math.ceil((result.currentHeat - 50) / 5);
    } else if (result.currentHeat <= 150) {
      heatLevel = "Hot";
      recoveryTime = Math.ceil((result.currentHeat - 100) / 5);
    } else {
      heatLevel = "Danger (Cooldown)";
      recoveryTime = Math.ceil(result.currentHeat / 5);
    }

    return {
      currentHeat: Math.round(result.currentHeat),
      heatLevel,
      recoveryTime,
      nextActionAllowed: result.allowed,
    };
  } catch (error) {
    console.error("Failed to get heat status:", error);
    return {
      currentHeat: 0,
      heatLevel: "Unknown",
      recoveryTime: 0,
      nextActionAllowed: false,
    };
  }
}

/**
 * Middleware function for API routes
 * Use this in your action handlers
 *
 * Example usage in API route:
 *
 * export async function POST(req: Request) {
 *   const userId = await getSessionUserId(req);
 *
 *   // Check heat FIRST
 *   const heatCheck = await checkHeat(userId);
 *   if (!heatCheck.allowed) {
 *     return NextResponse.json(
 *       { error: heatCheck.message },
 *       { status: 429 } // Too Many Requests
 *     );
 *   }
 *
 *   // Process action...
 *   const result = await executeAction(...);
 *
 *   // Apply heat AFTER success
 *   await applyHeat(userId, "ACTION_TYPE", targetId);
 *
 *   return NextResponse.json(result);
 * }
 */
export const HeatMiddleware = {
  checkHeat,
  applyHeat,
  getHeatStatus,
};

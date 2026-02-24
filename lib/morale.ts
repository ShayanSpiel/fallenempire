/**
 * MORALE SYSTEM ENGINE
 * Handles all morale-related calculations, event tracking, and behavior modifiers
 * Supports: action triggers, battle outcomes, community cascades, rebellion mechanics
 */

import { supabaseAdmin } from "./supabaseAdmin";
import {
  MORALE_CONSTANTS,
  ACTION_MORALE_DEFAULTS,
  ACTION_MORALE_STEP,
  BATTLE_MORALE,
  MORALE_CLAMPS,
  adjustMoraleForCoherence,
  getMoraleMultiplierFromValue,
  getMoraleBehaviorLabelFromValue,
  getChaosProbabilityFromMorale,
} from "./morale-config";

// ==================== TYPES ====================

export interface MoraleEventData {
  userId: string;
  eventType: "action" | "battle_victory" | "battle_defeat" | "community" | "economy" | "custom";
  eventTrigger: string;
  moraleChange: number;
  sourceUserId?: string;
  sourceCommunityId?: string;
  metadata?: Record<string, any>;
}

export interface MoraleResult {
  success: boolean;
  newMorale: number;
  moraleChange: number;
  rebellionTriggered: boolean;
  eventId?: string;
  error?: string;
}

export interface BattleMoraleResult {
  success: boolean;
  winnerMorale: MoraleResult;
  loserMorale: MoraleResult;
  error?: string;
}

export interface CommunityMoraleResult {
  success: boolean;
  affectedUsers: number;
  communityId: string;
  moraleChange: number;
  error?: string;
}

// ==================== CONSTANTS ====================
// Imported from morale-config.ts

// ==================== ACTION MORALE TRIGGERS ====================
// Imported from morale-config.ts

// ==================== COHERENCE ADJUSTMENT ====================
// Imported from morale-config.ts
// Re-exported for backward compatibility
export { adjustMoraleForCoherence };

// ==================== CORE MORALE FUNCTIONS ====================

/**
 * Record a morale event and update user morale atomically
 */
export async function recordMoraleEvent(
  data: MoraleEventData
): Promise<MoraleResult> {
  try {
    // Clamp morale change to reasonable values (prevent exploits)
    const clampedChange = Math.max(
      MORALE_CLAMPS.MIN_CHANGE,
      Math.min(MORALE_CLAMPS.MAX_CHANGE, data.moraleChange)
    );

    const result = await supabaseAdmin.rpc("record_morale_event", {
      p_user_id: data.userId,
      p_event_type: data.eventType,
      p_event_trigger: data.eventTrigger,
      p_morale_change: clampedChange,
      p_source_user_id: data.sourceUserId || null,
      p_metadata: data.metadata || { source_community_id: data.sourceCommunityId } || {},
    });

    if (result.error) {
      console.error("Morale event error:", result.error);
      return {
        success: false,
        newMorale: 50,
        moraleChange: 0,
        rebellionTriggered: false,
        error: result.error.message,
      };
    }

    return {
      success: result.data.success,
      newMorale: result.data.new_morale,
      moraleChange: result.data.morale_change,
      rebellionTriggered: result.data.rebellion_triggered,
      eventId: result.data.event_id,
    };
  } catch (error) {
    console.error("Failed to record morale event:", error);
    return {
      success: false,
      newMorale: 50,
      moraleChange: 0,
      rebellionTriggered: false,
      error: String(error),
    };
  }
}

/**
 * Apply morale change for a specific action type
 * Uses action_definitions table for scalable configuration
 */
const ACTION_MORALE_WINDOW_MS = 24 * 60 * 60 * 1000;

async function fetchCurrentUserMorale(userId: string): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("morale")
      .eq("id", userId)
      .maybeSingle();

    if (!data) {
      return MORALE_CONSTANTS.NEUTRAL;
    }

    return data.morale ?? MORALE_CONSTANTS.NEUTRAL;
  } catch (error) {
    console.error("Failed to read user morale:", error);
    return MORALE_CONSTANTS.NEUTRAL;
  }
}

/**
 * Apply morale change for a specific action type
 * Uses action_definitions table for scalable configuration
 */
export async function applyActionMorale(
  userId: string,
  actionType: string
): Promise<MoraleResult> {
  try {
    const { data: actionDef, error: actionError } = await supabaseAdmin
      .from("action_definitions")
      .select("morale_impact")
      .eq("action_key", actionType)
      .single();

    if (actionError) {
      console.warn("Failed to fetch action definition:", actionError);
    }

    const rawImpact =
      actionDef?.morale_impact ?? ACTION_MORALE_DEFAULTS[actionType] ?? 0;
    const impactDirection = Math.sign(rawImpact);
    const normalizedImpact =
      impactDirection === 0 ? 0 : impactDirection * ACTION_MORALE_STEP;

    const respondWithCurrentMorale = async () => ({
      success: true,
      newMorale: await fetchCurrentUserMorale(userId),
      moraleChange: 0,
      rebellionTriggered: false,
    });

    if (normalizedImpact === 0) {
      return respondWithCurrentMorale();
    }

    const windowStart = new Date(Date.now() - ACTION_MORALE_WINDOW_MS).toISOString();
    const { data: recentEvent, error: eventError } = await supabaseAdmin
      .from("morale_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_type", "action")
      .eq("event_trigger", `action:${actionType}`)
      .gte("created_at", windowStart)
      .limit(1)
      .maybeSingle();

    if (eventError) {
      console.warn("Failed to check existing action morale events:", eventError);
    }

    if (recentEvent) {
      return respondWithCurrentMorale();
    }

    return recordMoraleEvent({
      userId,
      eventType: "action",
      eventTrigger: `action:${actionType}`,
      moraleChange: normalizedImpact,
      metadata: { action_type: actionType },
    });
  } catch (error) {
    console.error("Failed to apply action morale:", error);
    return {
      success: false,
      newMorale: 50,
      moraleChange: 0,
      rebellionTriggered: false,
      error: String(error),
    };
  }
}

// ==================== BATTLE MORALE ====================

/**
 * Apply morale changes for battle outcomes
 * Winners get boost, losers get penalty
 */
export async function applyBattleMorale(
  winnerId: string,
  loserId: string,
  battleId: string,
  options?: { winnerChange?: number; loserChange?: number }
): Promise<BattleMoraleResult> {
  const winnerChange = options?.winnerChange || BATTLE_MORALE.WINNER_CHANGE;
  const loserChange = options?.loserChange || BATTLE_MORALE.LOSER_CHANGE;

  try {
    const result = await supabaseAdmin.rpc("apply_battle_morale", {
      p_winner_id: winnerId,
      p_loser_id: loserId,
      p_battle_id: battleId,
    });

    if (result.error) {
      return {
        success: false,
        winnerMorale: { success: false, newMorale: 50, moraleChange: 0, rebellionTriggered: false },
        loserMorale: { success: false, newMorale: 50, moraleChange: 0, rebellionTriggered: false },
        error: result.error.message,
      };
    }

    return {
      success: result.data.success,
      winnerMorale: result.data.winner_morale,
      loserMorale: result.data.loser_morale,
    };
  } catch (error) {
    console.error("Failed to apply battle morale:", error);
    return {
      success: false,
      winnerMorale: { success: false, newMorale: 50, moraleChange: 0, rebellionTriggered: false },
      loserMorale: { success: false, newMorale: 50, moraleChange: 0, rebellionTriggered: false },
      error: String(error),
    };
  }
}

// ==================== COMMUNITY CASCADE ====================

/**
 * Apply morale change to all members of a community
 * Used for leader decisions, community events, etc.
 */
export async function applyCommunityMoraleCascade(
  communityId: string,
  eventType: string,
  moraleChange: number,
  sourceUserId: string,
  metadata?: Record<string, any>
): Promise<CommunityMoraleResult> {
  try {
    const result = await supabaseAdmin.rpc("apply_community_morale_cascade", {
      p_community_id: communityId,
      p_event_type: eventType,
      p_morale_change: moraleChange,
      p_source_user_id: sourceUserId,
    });

    if (result.error) {
      return {
        success: false,
        affectedUsers: 0,
        communityId,
        moraleChange: 0,
        error: result.error.message,
      };
    }

    return {
      success: result.data.success,
      affectedUsers: result.data.affected_users,
      communityId: communityId,
      moraleChange: moraleChange,
    };
  } catch (error) {
    console.error("Failed to apply community morale cascade:", error);
    return {
      success: false,
      affectedUsers: 0,
      communityId,
      moraleChange: 0,
      error: String(error),
    };
  }
}

// ==================== REBELLION MECHANICS ====================

/**
 * Check if a user is in rebellion state (morale < 20)
 * Can be used to trigger chaotic behavior
 */
export async function checkRebellionStatus(userId: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("morale")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) {
      return false; // User doesn't exist, not in rebellion
    }

    return user.morale < 20;
  } catch (error) {
    return false; // Silently fail, assume not in rebellion
  }
}

/**
 * Get chaos probability for rebellion behavior
 * Higher the rebellion, higher the chaos
 * Returns percentage 0-100
 */
export async function getChaosProbability(userId: string): Promise<number> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("morale")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) return 0;

    return getChaosProbabilityFromMorale(user.morale);
  } catch (error) {
    return 0;
  }
}

// getChaosProbabilityFromMorale is now imported from morale-config.ts

// ==================== MORALE QUERIES ====================

/**
 * Get current morale for a user
 */
export async function getUserMorale(userId: string): Promise<number | null> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("morale")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) return 50; // Default morale if user not found

    return user.morale;
  } catch (error) {
    return 50; // Default morale on error
  }
}

/**
 * Get recent morale events for a user
 */
export async function getMoraleHistory(userId: string, limit: number = 20) {
  try {
    const { data } = await supabaseAdmin
      .from("morale_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return data || [];
  } catch (error) {
    console.error("Failed to get morale history:", error);
    return [];
  }
}

/**
 * Get morale leaderboard
 */
export async function getMoraleLeaderboard(limit: number = 50) {
  try {
    const { data } = await supabaseAdmin
      .from("morale_leaderboard")
      .select("*")
      .limit(limit);

    return data || [];
  } catch (error) {
    console.error("Failed to get morale leaderboard:", error);
    return [];
  }
}

/**
 * Get rebellion status for all users
 */
export async function getRebellionUsers() {
  try {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, username, morale, is_bot, power_mental, freewill, current_level")
      .lt("morale", MORALE_CONSTANTS.REBELLION_THRESHOLD)
      .order("morale", { ascending: true });

    return data || [];
  } catch (error) {
    console.error("Failed to get rebellion users:", error);
    return [];
  }
}

// ==================== MORALE CALCULATIONS ====================

/**
 * Calculate morale multiplier for psychology calculations
 * Maps morale 0-100 to multiplier 0.5-1.5
 * Re-exported from morale-config.ts for backward compatibility
 */
export function getMoraleMultiplier(morale: number = 50): number {
  return getMoraleMultiplierFromValue(morale);
}

/**
 * Get morale-based behavior label
 * Re-exported from morale-config.ts for backward compatibility
 */
export function getMoraleBehaviorLabel(morale: number): string {
  return getMoraleBehaviorLabelFromValue(morale);
}

/**
 * Calculate morale trend from recent events
 */
export async function calculateMoraleTrend(userId: string, hours: number = 24): Promise<number> {
  try {
    const { data: events } = await supabaseAdmin
      .from("morale_events")
      .select("morale_change")
      .eq("user_id", userId)
      .gt("created_at", new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

    if (!events || events.length === 0) return 0;

    const total = events.reduce((sum, e) => sum + (e.morale_change || 0), 0);
    return parseFloat((total / events.length).toFixed(2));
  } catch (error) {
    console.error("Failed to calculate morale trend:", error);
    return 0;
  }
}

// ==================== BATCH OPERATIONS ====================

/**
 * Batch update morale for multiple users
 * Used for economy-wide effects or server-wide events
 */
export async function batchApplyMorale(
  userIds: string[],
  moraleChange: number,
  eventType: string,
  metadata?: Record<string, any>
): Promise<{ successful: number; failed: number }> {
  let successful = 0;
  let failed = 0;

  // Process in chunks to avoid overwhelming the database
  const CHUNK_SIZE = 100;
  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);

    // Insert morale events for all users in chunk
    const events = chunk.map((userId) => ({
      user_id: userId,
      event_type: eventType,
      event_trigger: "batch_effect",
      morale_change: moraleChange,
      new_morale: 50, // Will be set by trigger
      metadata: metadata || {},
    }));

    try {
      const { error } = await supabaseAdmin
        .from("morale_events")
        .insert(events);

      if (error) {
        failed += chunk.length;
      } else {
        successful += chunk.length;
      }
    } catch (e) {
      failed += chunk.length;
    }
  }

  return { successful, failed };
}

/**
 * Reset morale for all users (admin operation)
 */
export async function resetAllMorale(resetValue: number = 50): Promise<{ updated: number; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("users")
      .update({ morale: resetValue, last_morale_update: new Date().toISOString() })
      .select("id");

    if (error) {
      return { updated: 0, error: error.message };
    }

    return { updated: data?.length || 0 };
  } catch (error) {
    return { updated: 0, error: String(error) };
  }
}

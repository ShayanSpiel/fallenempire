/**
 * INFLUENCE SYSTEM (Stub)
 * Provides coherence and mental power calculations
 * This is a simplified version - full implementation TBD
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateFreewillFromSignals } from "@/lib/psychology";

/**
 * Get user's mental power score
 */
export async function getUserMentalPower(userId: string): Promise<number> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("power_mental")
    .eq("id", userId)
    .single();

  return user?.power_mental || 50;
}

/**
 * Record coherence metric
 * Stores both current coherence (for instant access) and history (for moving average)
 */
export async function recordCoherence(
  userId: string,
  coherenceScore: number,
  actionTypeOrContext?: string | Record<string, any>,
  context?: Record<string, any>
): Promise<void> {
  // Determine action_type and metadata from parameters
  let actionType: string | undefined;
  let metadata: Record<string, any> | undefined;

  if (typeof actionTypeOrContext === 'string') {
    actionType = actionTypeOrContext;
    metadata = context;
  } else if (actionTypeOrContext && typeof actionTypeOrContext === 'object') {
    metadata = actionTypeOrContext;
    actionType = context && typeof context === 'string' ? context : undefined;
  }

  // Update current coherence in user record (for instant access)
  await supabaseAdmin
    .from("users")
    .update({ coherence: coherenceScore })
    .eq("id", userId);

  // Insert into coherence_history for moving average calculation
  await supabaseAdmin
    .from("coherence_history")
    .insert({
      user_id: userId,
      coherence: coherenceScore,
      action_type: actionType,
      metadata: metadata || null,
    });

  // Refresh derived psychology signals (best-effort; never block the action)
  try {
    const [
      { data: activityScore, error: activityError },
      { data: mentalPower, error: mentalPowerError },
      { data: userMeta },
    ] = await Promise.all([
      supabaseAdmin.rpc("get_activity_score", { p_user_id: userId }),
      supabaseAdmin.rpc("get_mental_power_moving_average", { p_user_id: userId }),
      supabaseAdmin
        .from("users")
        .select("morale, is_bot")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const computedActivityScore = activityError ? 0 : ((activityScore as number) ?? 0);
    const morale = userMeta?.morale ?? 50;
    const isHuman = userMeta?.is_bot === true ? false : true;
    const freewill = calculateFreewillFromSignals({
      activityScore: computedActivityScore,
      coherence: coherenceScore,
      morale,
      isHuman,
    });

    const update: Record<string, any> = { freewill };
    if (!mentalPowerError && typeof mentalPower === "number") {
      update.power_mental = mentalPower;
    }

    await supabaseAdmin.from("users").update(update).eq("id", userId);
  } catch (error) {
    console.warn("[recordCoherence] Failed to refresh derived psychology signals:", error);
  }
}

/**
 * Get influence summary for a user
 */
export async function getInfluenceSummary(userId: string): Promise<{
  mentalPower: number;
  coherence: number;
  influence: number;
  persuasionPotential: number;
  canInfluenceAI: boolean;
}> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("power_mental, coherence")
    .eq("id", userId)
    .single();

  const mentalPower = user?.power_mental || 50;
  const coherence = user?.coherence || 50;
  const influence = (mentalPower + coherence) / 2;

  // Calculate persuasion potential based on mental power and coherence
  const persuasionPotential = (mentalPower * 0.6 + coherence * 0.4) / 100;

  // Determine if user can influence AI (threshold: 70+ influence)
  const canInfluenceAI = influence >= 70;

  return {
    mentalPower,
    coherence,
    influence,
    persuasionPotential,
    canInfluenceAI,
  };
}

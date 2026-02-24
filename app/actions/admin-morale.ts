"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMoraleLeaderboard, getRebellionUsers } from "@/lib/morale";

/**
 * Server action: Log admin action to audit trail
 */
export async function logAdminAction(
  actionType: string,
  targetEntityType: string,
  targetEntityId: string | null,
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null,
  metadata: Record<string, any> = {}
) {
  try {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const userId = authData?.users?.[0]?.id;

    if (!userId) {
      throw new Error("Admin user not found");
    }

    const { data, error } = await supabaseAdmin
      .from("admin_actions")
      .insert({
        admin_user_id: userId,
        action_type: actionType,
        target_entity_type: targetEntityType,
        target_entity_id: targetEntityId,
        old_value: oldValue,
        new_value: newValue,
        metadata,
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error("Failed to log admin action:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Server action: Override user stats (God Mode)
 */
export async function overrideUserStats(
  userId: string,
  stats: { morale?: number; power_mental?: number; freewill?: number }
) {
  try {
    // Get current user stats
    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("morale, power_mental, freewill")
      .eq("id", userId)
      .single();

    if (fetchError) throw fetchError;

    // Update user
    const updateData: any = {};
    if (stats.morale !== undefined) updateData.morale = Math.max(0, Math.min(100, stats.morale));
    if (stats.power_mental !== undefined) updateData.power_mental = Math.max(0, Math.min(100, stats.power_mental));
    if (stats.freewill !== undefined) updateData.freewill = Math.max(0, Math.min(100, stats.freewill));

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("id", userId);

    if (updateError) throw updateError;

    // Log the action
    await logAdminAction("stat_override", "user", userId, currentUser, updateData, {
      type: "god_mode_override",
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to override user stats:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Server action: Update action definition
 */
export async function updateActionDefinition(
  actionKey: string,
  updates: { morale_impact?: number; mp_cost?: number; xp_reward?: number; enabled?: boolean }
) {
  try {
    // Get current definition
    const { data: currentDef, error: fetchError } = await supabaseAdmin
      .from("action_definitions")
      .select("*")
      .eq("action_key", actionKey)
      .single();

    if (fetchError) throw fetchError;

    // Update definition
    const { error: updateError } = await supabaseAdmin
      .from("action_definitions")
      .update(updates)
      .eq("action_key", actionKey);

    if (updateError) throw updateError;

    // Log the action
    await logAdminAction("action_definition_update", "action", actionKey, currentDef, updates, {
      type: "config_edit",
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to update action definition:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Server action: Reset all morale to a specific value
 */
export async function resetAllMoraleAdmin(resetValue: number = 50) {
  try {
    const clampedValue = Math.max(0, Math.min(100, resetValue));

    const { data, error } = await supabaseAdmin
      .from("users")
      .update({
        morale: clampedValue,
        last_morale_update: new Date().toISOString(),
      })
      .select("id");

    if (error) throw error;

    // Log the action
    await logAdminAction("reset_all_morale", "system", null, { count: data?.length }, { count: data?.length, reset_value: clampedValue }, {
      type: "god_mode_reset",
    });

    return { success: true, updated: data?.length || 0 };
  } catch (error) {
    console.error("Failed to reset all morale:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Server action: Batch apply morale change to multiple users
 */
export async function batchApplyMorale(
  userIds: string[],
  moraleChange: number,
  eventType: string,
  eventTrigger: string
) {
  try {
    const clampedChange = Math.max(-50, Math.min(50, moraleChange));

    // Insert morale events for all users
    const events = userIds.map((userId) => ({
      user_id: userId,
      event_type: eventType,
      event_trigger: eventTrigger,
      morale_change: clampedChange,
      new_morale: 50, // Will be calculated by trigger
      metadata: { batch_operation: true },
    }));

    const { data, error } = await supabaseAdmin
      .from("morale_events")
      .insert(events)
      .select("id");

    if (error) throw error;

    // Log the action
    await logAdminAction("batch_morale_apply", "users", null, { count: userIds.length }, { count: userIds.length, change: clampedChange }, {
      type: "batch_operation",
      event_type: eventType,
    });

    return { success: true, affected: data?.length || 0 };
  } catch (error) {
    console.error("Failed to batch apply morale:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Server action: Get dashboard metrics
 */
export async function getDashboardMetrics() {
  try {
    // Get all agents
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from("users")
      .select("id, morale, current_level")
      .eq("is_bot", true);

    if (agentsError) throw agentsError;

    if (!agents || agents.length === 0) {
      return {
        avgMorale: 50,
        rebellionCount: 0,
        totalAgents: 0,
        avgLevel: 1,
      };
    }

    const avgMorale = Math.round(agents.reduce((sum, a) => sum + (a.morale || 50), 0) / agents.length);
    const avgLevel = Math.round((agents.reduce((sum, a) => sum + (a.current_level || 1), 0) / agents.length) * 10) / 10;
    const rebellionCount = agents.filter((a) => (a.morale || 50) < 20).length;

    return {
      avgMorale,
      rebellionCount,
      totalAgents: agents.length,
      avgLevel,
    };
  } catch (error) {
    console.error("Failed to get dashboard metrics:", error);
    return {
      avgMorale: 0,
      rebellionCount: 0,
      totalAgents: 0,
      avgLevel: 0,
    };
  }
}

/**
 * Server action: Get audit logs
 */
export async function getAuditLogs(limit: number = 50) {
  try {
    const { data, error } = await supabaseAdmin
      .from("admin_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error) {
    console.error("Failed to get audit logs:", error);
    return { success: false, data: [] };
  }
}

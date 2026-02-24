/**
 * Simulation Control Module
 * Manages global AI simulation settings and controls
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";

export interface SimulationStats {
  is_active: boolean;
  scheduler_enabled?: boolean;
  batch_size: number;
  max_concurrent: number;
  tokens_used_today: number;
  tokens_used_month: number;
  cost_limit: number;
  paused_until: string | null;
}

/**
 * Check if simulation is currently active
 * Returns false if disabled or paused
 */
export async function isSimulationActive(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("is_simulation_active");

    if (error) {
      console.error("Error checking simulation active:", error);
      return true; // Default to active on error
    }

    return data ?? true;
  } catch (err) {
    console.error("Failed to check simulation active:", err);
    return true;
  }
}

/**
 * Check if we have token budget remaining
 */
export async function hasTokenBudget(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("has_token_budget");

    if (error) {
      console.error("Error checking token budget:", error);
      return true; // Default to true on error
    }

    return data ?? true;
  } catch (err) {
    console.error("Failed to check token budget:", err);
    return true;
  }
}

/**
 * Log token usage for cost tracking
 */
export async function logTokenUsage(
  tokens: number,
  cost: number = 0
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.rpc("log_token_usage", {
      p_tokens: tokens,
      p_cost: cost,
    });

    if (error) {
      console.error("Error logging token usage:", error);
    }
  } catch (err) {
    console.error("Failed to log token usage:", err);
  }
}

/**
 * Get current simulation statistics
 */
export async function getSimulationStats(): Promise<SimulationStats | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("get_simulation_stats");

    if (error) {
      console.error("Error fetching simulation stats:", error);
      return null;
    }

    return data?.[0] || null;
  } catch (err) {
    console.error("Failed to get simulation stats:", err);
    return null;
  }
}

/**
 * Pause simulation until specified time
 * Use this to pause without disabling completely
 */
export async function pauseSimulationUntil(
  untilTime: Date
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc("pause_simulation", {
      p_until: untilTime.toISOString(),
    });

    if (error) {
      console.error("Error pausing simulation:", error);
      return false;
    }

    logGameEvent(
      "SimulationControl",
      `Simulation paused until ${untilTime.toISOString()}`,
      "info"
    );

    return true;
  } catch (err) {
    console.error("Failed to pause simulation:", err);
    return false;
  }
}

/**
 * Resume simulation immediately
 */
export async function resumeSimulation(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc("resume_simulation");

    if (error) {
      console.error("Error resuming simulation:", error);
      return false;
    }

    logGameEvent("SimulationControl", "Simulation resumed", "info");

    return true;
  } catch (err) {
    console.error("Failed to resume simulation:", err);
    return false;
  }
}

/**
 * Enable or disable simulation
 */
export async function setSimulationActive(active: boolean): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc("set_simulation_active", {
      p_active: active,
    });

    if (error) {
      console.error("Error setting simulation active:", error);
      return false;
    }

    logGameEvent(
      "SimulationControl",
      `Simulation ${active ? "enabled" : "disabled"}`,
      "info"
    );

    return true;
  } catch (err) {
    console.error("Failed to set simulation active:", err);
    return false;
  }
}

/**
 * Reset daily token counter (should be called at midnight)
 */
export async function resetDailyTokens(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc("reset_daily_tokens");

    if (error) {
      console.error("Error resetting daily tokens:", error);
      return false;
    }

    logGameEvent("SimulationControl", "Daily tokens reset", "info");

    return true;
  } catch (err) {
    console.error("Failed to reset daily tokens:", err);
    return false;
  }
}

/**
 * Update simulation parameters
 */
export async function updateSimulationSettings(
  updates: Partial<{
    batch_size: number;
    max_concurrent: number;
    global_token_budget: number;
    cost_limit: number;
  }>
): Promise<boolean> {
  try {
    // Get the first (and should be only) simulation control record
    const { data: records, error: selectError } = await supabaseAdmin
      .from("simulation_control")
      .select("id")
      .limit(1);

    if (selectError || !records || records.length === 0) {
      console.error("Error finding simulation control record:", selectError);
      return false;
    }

    const recordId = records[0].id;

    const { error } = await supabaseAdmin
      .from("simulation_control")
      .update(updates as any)
      .eq("id", recordId);

    if (error) {
      console.error("Error updating simulation settings:", error);
      return false;
    }

    logGameEvent(
      "SimulationControl",
      "Simulation settings updated",
      "info",
      { updates }
    );

    return true;
  } catch (err) {
    console.error("Failed to update simulation settings:", err);
    return false;
  }
}

/**
 * ACTIVITY LOGGER (Stub)
 * Logs simulation cycles and game events
 * Simplified stub for compatibility with job scheduler
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface SimulationCycleData {
  cycle_number: number;
  agents_processed: number;
  actions_executed: number;
  tokens_used: number;
  duration_ms: number;
  success_count: number;
  error_count: number;
  heat_warnings: number;
}

/**
 * Log a simulation cycle to the database
 */
export async function logSimulationCycle(cycleData: SimulationCycleData): Promise<void> {
  console.log(`[ActivityLogger] Logging simulation cycle #${cycleData.cycle_number}`);

  // In real implementation, store this in simulation_cycles table
  // For now, just log to console

  try {
    await supabaseAdmin
      .from("simulation_cycles")
      .insert({
        cycle_number: cycleData.cycle_number,
        agents_processed: cycleData.agents_processed,
        actions_executed: cycleData.actions_executed,
        tokens_used: cycleData.tokens_used,
        duration_ms: cycleData.duration_ms,
        success_count: cycleData.success_count,
        error_count: cycleData.error_count,
        heat_warnings: cycleData.heat_warnings,
      });
  } catch (error) {
    console.warn(`[ActivityLogger] Failed to log cycle: ${error}`);
  }
}

/**
 * Clean up old simulation logs
 */
export async function cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
  console.log(`[ActivityLogger] Cleaning up logs older than ${daysToKeep} days`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    await supabaseAdmin
      .from("simulation_cycles")
      .delete()
      .lt("created_at", cutoffDate.toISOString());
  } catch (error) {
    console.warn(`[ActivityLogger] Failed to cleanup logs: ${error}`);
  }
}

/**
 * AI SIMULATION JOB SCHEDULER
 * Cron-based job scheduling with pause/resume support
 *
 * Jobs:
 * - agent_cycle: Run all agents through decision loop
 * - memory_cleanup: Clean up old memories
 * - relationship_sync: Sync and decay relationships
 * - token_reset: Reset daily token counter
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logGameEvent } from "@/lib/logger";
import { isSimulationActive, hasTokenBudget, logTokenUsage } from "@/lib/admin/simulation-control";
import {
  runAgentCycle,
  cleanupAgentMemories,
  applyRelationshipDecay,
  resetDailyTokens,
} from "./agent-engine";
import { logSimulationCycle, cleanupOldLogs } from "./activity-logger";

// ============================================================================
// TYPES
// ============================================================================

export interface JobConfig {
  name: string;
  enabled: boolean;
  interval: number; // milliseconds
  lastRun?: Date;
  nextRun?: Date;
}

export interface JobResult {
  jobName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  message: string;
  agentsProcessed?: number;
  tokensUsed?: number;
  error?: string;
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

let jobTimers: Map<string, NodeJS.Timeout> = new Map();
let jobHistory: JobResult[] = [];
let isSchedulerRunning = false;

// Default job configurations
const DEFAULT_JOBS: Record<string, JobConfig> = {
  agent_cycle: {
    name: "agent_cycle",
    enabled: true,
    interval: 30 * 1000, // 30 seconds (configurable)
  },
  memory_cleanup: {
    name: "memory_cleanup",
    enabled: true,
    interval: 60 * 60 * 1000, // 1 hour
  },
  relationship_sync: {
    name: "relationship_sync",
    enabled: true,
    interval: 15 * 60 * 1000, // 15 minutes
  },
  token_reset: {
    name: "token_reset",
    enabled: true,
    interval: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// ============================================================================
// CORE JOB EXECUTION
// ============================================================================

/**
 * Execute a single job
 */
async function executeJob(jobName: string): Promise<JobResult> {
  const startTime = new Date();

  try {
    logGameEvent("JobScheduler", `Starting job: ${jobName}`, "info");

    let result: JobResult;

    switch (jobName) {
      case "agent_cycle":
        result = await runAgentCycleJob();
        break;

      case "memory_cleanup":
        result = await runMemoryCleanupJob();
        break;

      case "relationship_sync":
        result = await runRelationshipSyncJob();
        break;

      case "token_reset":
        result = await runTokenResetJob();
        break;

      default:
        throw new Error(`Unknown job: ${jobName}`);
    }

    logGameEvent("JobScheduler", `Completed job: ${jobName}`, "info", {
      duration: result.duration,
      success: result.success,
    });

    // Keep last 100 job results
    jobHistory.push(result);
    if (jobHistory.length > 100) {
      jobHistory = jobHistory.slice(-100);
    }

    return result;
  } catch (error) {
    const endTime = new Date();
    const result: JobResult = {
      jobName,
      success: false,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      message: `Job failed: ${jobName}`,
      error: String(error),
    };

    logGameEvent("JobScheduler", `Error in job ${jobName}`, "error", {
      error: String(error),
    });

    jobHistory.push(result);
    return result;
  }
}

/**
 * RUN AGENT CYCLE
 * Process all agents through decision-making loop
 */
async function runAgentCycleJob(): Promise<JobResult> {
  const startTime = new Date();
  const cycleStartTime = Date.now();

  try {
    // Check if simulation is active
    const simActive = await isSimulationActive();
    if (!simActive) {
      return {
        jobName: "agent_cycle",
        success: false,
        startTime,
        endTime: new Date(),
        duration: 0,
        message: "Simulation is paused",
        agentsProcessed: 0,
      };
    }

    // Check token budget
    const hasTokens = await hasTokenBudget();
    if (!hasTokens) {
      return {
        jobName: "agent_cycle",
        success: false,
        startTime,
        endTime: new Date(),
        duration: 0,
        message: "Token budget exceeded",
        agentsProcessed: 0,
      };
    }

    // Run the agent cycle
    const result = await runAgentCycle();

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    // Log token usage
    if (result.tokensUsed > 0) {
      await logTokenUsage(result.tokensUsed);
    }

    // Log cycle in activity logger
    await logSimulationCycle({
      cycle_number: 0, // TODO: Track actual cycle number
      agents_processed: result.agentsProcessed,
      actions_executed: result.actionsExecuted,
      tokens_used: result.tokensUsed,
      duration_ms: duration,
      success_count: result.successCount,
      error_count: result.errorCount,
      heat_warnings: 0, // Could be tracked from details
    });

    return {
      jobName: "agent_cycle",
      success: true,
      startTime,
      endTime,
      duration,
      message: `Processed ${result.agentsProcessed} agents, executed ${result.actionsExecuted} actions`,
      agentsProcessed: result.agentsProcessed,
      tokensUsed: result.tokensUsed,
    };
  } catch (error) {
    const endTime = new Date();
    throw new Error(`Agent cycle failed: ${error}`);
  }
}

/**
 * MEMORY CLEANUP
 * Remove old memories and compress memory store
 */
async function runMemoryCleanupJob(): Promise<JobResult> {
  const startTime = new Date();

  try {
    const result = await cleanupAgentMemories();

    const endTime = new Date();
    return {
      jobName: "memory_cleanup",
      success: true,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      message: `Memory cleanup completed - deleted ${result.deletedCount} old memories`,
    };
  } catch (error) {
    const endTime = new Date();
    throw new Error(`Memory cleanup failed: ${error}`);
  }
}

/**
 * RELATIONSHIP SYNC
 * Apply decay to relationships and sync alliance/enemy status
 */
async function runRelationshipSyncJob(): Promise<JobResult> {
  const startTime = new Date();

  try {
    const result = await applyRelationshipDecay();

    const endTime = new Date();
    return {
      jobName: "relationship_sync",
      success: true,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      message: `Relationship sync completed - processed ${result.processedCount} relationships`,
    };
  } catch (error) {
    const endTime = new Date();
    throw new Error(`Relationship sync failed: ${error}`);
  }
}

/**
 * TOKEN RESET
 * Reset daily token counter (run at midnight)
 */
async function runTokenResetJob(): Promise<JobResult> {
  const startTime = new Date();

  try {
    const result = await resetDailyTokens();

    const endTime = new Date();
    return {
      jobName: "token_reset",
      success: true,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      message: `Daily tokens reset - ${result.resetCount} agents reset`,
    };
  } catch (error) {
    const endTime = new Date();
    throw new Error(`Token reset failed: ${error}`);
  }
}

// ============================================================================
// SCHEDULER CONTROL
// ============================================================================

/**
 * Initialize the job scheduler
 * Starts all enabled jobs on their intervals
 */
export async function initializeScheduler(): Promise<void> {
  if (isSchedulerRunning) {
    logGameEvent("JobScheduler", "Scheduler already running", "warn");
    return;
  }

  logGameEvent("JobScheduler", "Initializing job scheduler", "info");

  // Schedule each job
  for (const [jobName, config] of Object.entries(DEFAULT_JOBS)) {
    if (config.enabled) {
      scheduleJob(jobName, config.interval);
    }
  }

  isSchedulerRunning = true;
  logGameEvent("JobScheduler", "Job scheduler initialized", "info");
}

/**
 * Schedule a single job with interval
 */
function scheduleJob(jobName: string, intervalMs: number): void {
  const existing = jobTimers.get(jobName);
  if (existing) {
    clearInterval(existing);
  }

  const timer = setInterval(async () => {
    try {
      await executeJob(jobName);
    } catch (error) {
      logGameEvent("JobScheduler", `Job execution error for ${jobName}`, "error", { error });
    }
  }, intervalMs);

  jobTimers.set(jobName, timer);
  logGameEvent("JobScheduler", `Scheduled job: ${jobName} (interval: ${intervalMs}ms)`, "info");
}

/**
 * Stop the job scheduler
 */
export async function stopScheduler(): Promise<void> {
  logGameEvent("JobScheduler", "Stopping job scheduler", "info");

  for (const [jobName, timer] of jobTimers.entries()) {
    clearInterval(timer);
    logGameEvent("JobScheduler", `Stopped job: ${jobName}`, "info");
  }

  jobTimers.clear();
  isSchedulerRunning = false;
}

/**
 * Manually trigger a job
 */
export async function triggerJob(jobName: string): Promise<JobResult> {
  logGameEvent("JobScheduler", `Manually triggering job: ${jobName}`, "info");
  return executeJob(jobName);
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  running: boolean;
  activeJobs: string[];
  jobHistory: JobResult[];
} {
  return {
    running: isSchedulerRunning,
    activeJobs: Array.from(jobTimers.keys()),
    jobHistory: jobHistory.slice(-20), // Last 20
  };
}

/**
 * Update job interval (requires restart)
 */
export function updateJobInterval(jobName: string, intervalMs: number): void {
  logGameEvent("JobScheduler", `Updating job interval: ${jobName} -> ${intervalMs}ms`, "info");

  if (jobTimers.has(jobName)) {
    const existing = jobTimers.get(jobName);
    if (existing) {
      clearInterval(existing);
    }
    scheduleJob(jobName, intervalMs);
  }
}

/**
 * Enable/disable a job
 */
export function setJobEnabled(jobName: string, enabled: boolean): void {
  logGameEvent("JobScheduler", `Setting job ${jobName} enabled=${enabled}`, "info");

  if (enabled && !jobTimers.has(jobName)) {
    const config = DEFAULT_JOBS[jobName];
    if (config) {
      scheduleJob(jobName, config.interval);
    }
  } else if (!enabled && jobTimers.has(jobName)) {
    const timer = jobTimers.get(jobName);
    if (timer) {
      clearInterval(timer);
    }
    jobTimers.delete(jobName);
  }
}

// ============================================================================
// AUTO-INITIALIZE
// ============================================================================

// Initialize scheduler when module loads (in production environment)
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  // Use setImmediate to avoid blocking module load
  if (typeof setImmediate !== "undefined") {
    setImmediate(() => {
      initializeScheduler().catch((err) => {
        console.error("Failed to initialize scheduler:", err);
      });
    });
  }
}

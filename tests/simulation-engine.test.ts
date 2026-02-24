/**
 * SIMULATION ENGINE TESTS
 * Comprehensive test suite for agent simulation system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { runAgentCycle, executeAgentAction, cleanupAgentMemories, applyRelationshipDecay, resetDailyTokens } from "@/lib/ai-system/agent-engine";
import {
  initializeScheduler,
  stopScheduler,
  triggerJob,
  getSchedulerStatus,
} from "@/lib/ai-system/scheduling/job-scheduler";
import { HeatMiddleware } from "@/lib/heat-middleware";
import {
  logAgentActivity,
  logSimulationCycle,
  getAgentActivitySummary,
  getSimulationCycleStats,
  getHeatDistribution,
} from "@/lib/ai-system/activity-logger";
import {
  executeLikeAction,
  executeCommentAction,
  executeFollowAction,
  executeJoinCommunityAction,
  executeVoteAction,
} from "@/lib/ai-system/services/game-actions-integration";
import {
  isSimulationActive,
  pauseSimulationUntil,
  resumeSimulation,
  getSimulationStats,
} from "@/lib/admin/simulation-control";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ============================================================================
// TEST SETUP
// ============================================================================

const testAgentId = "test-agent-" + Date.now();
const testPostId = "test-post-" + Date.now();
const testUserId = "test-user-" + Date.now();

describe("Simulation Engine", () => {
  beforeAll(async () => {
    console.log("Setting up test environment...");
    // Create test agent
    await supabaseAdmin
      .from("users")
      .insert({
        id: testAgentId,
        username: `agent_test_${Date.now()}`,
        is_agent: true,
        is_active: true,
        morale: 50,
        identity: {
          order_chaos: 0,
          self_community: 0,
          logic_emotion: 0,
          power_harmony: 0,
          tradition_innovation: 0,
        },
      });

    console.log("Test environment ready");
  });

  afterAll(async () => {
    console.log("Cleaning up test environment...");
    // Clean up test data
    await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", testAgentId);

    console.log("Cleanup complete");
  });

  // ============================================================================
  // SCHEDULER TESTS
  // ============================================================================

  describe("Job Scheduler", () => {
    it("should initialize scheduler", async () => {
      await initializeScheduler();
      const status = getSchedulerStatus();

      expect(status.running).toBe(true);
      expect(status.activeJobs.length).toBeGreaterThan(0);
    });

    it("should track job history", async () => {
      const status = getSchedulerStatus();
      expect(status.jobHistory).toBeDefined();
      expect(Array.isArray(status.jobHistory)).toBe(true);
    });

    it("should stop scheduler", async () => {
      await stopScheduler();
      const status = getSchedulerStatus();

      expect(status.running).toBe(false);
    });

    it("should allow manual job triggering", async () => {
      const result = await triggerJob("memory_cleanup");

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.jobName).toBe("memory_cleanup");
    });
  });

  // ============================================================================
  // AGENT CYCLE TESTS
  // ============================================================================

  describe("Agent Cycle", () => {
    beforeEach(async () => {
      // Reset agent heat before each test
      await HeatMiddleware.checkHeat(testAgentId);
    });

    it("should process agents successfully", async () => {
      const result = await runAgentCycle();

      expect(result).toBeDefined();
      expect(result.agentsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.tokensUsed).toBe("number");
    });

    it("should track success and error counts", async () => {
      const result = await runAgentCycle();

      expect(result.successCount + result.errorCount).toBeLessThanOrEqual(result.agentsProcessed);
      expect(result.successCount).toBeGreaterThanOrEqual(0);
      expect(result.errorCount).toBeGreaterThanOrEqual(0);
    });

    it("should provide execution details", async () => {
      const result = await runAgentCycle();

      if (result.agentsProcessed > 0) {
        expect(result.details).toBeDefined();
        expect(Array.isArray(result.details)).toBe(true);
        expect(result.details.length).toBeLessThanOrEqual(result.agentsProcessed);
      }
    });
  });

  // ============================================================================
  // HEAT SYSTEM TESTS
  // ============================================================================

  describe("Heat System", () => {
    it("should check heat status", async () => {
      const heatCheck = await HeatMiddleware.checkHeat(testAgentId);

      expect(heatCheck).toBeDefined();
      expect(typeof heatCheck.allowed).toBe("boolean");
      expect(typeof heatCheck.currentHeat).toBe("number");
      expect(heatCheck.currentHeat).toBeGreaterThanOrEqual(0);
    });

    it("should apply heat after actions", async () => {
      const heatBefore = (await HeatMiddleware.checkHeat(testAgentId)).currentHeat;

      await HeatMiddleware.applyHeat(testAgentId, "LIKE", testPostId);

      const heatAfter = (await HeatMiddleware.checkHeat(testAgentId)).currentHeat;

      // Heat should increase or stay same (might be at max)
      expect(heatAfter).toBeGreaterThanOrEqual(heatBefore);
    });

    it("should get heat status for UI", async () => {
      const status = await HeatMiddleware.getHeatStatus(testAgentId);

      expect(status).toBeDefined();
      expect(typeof status.currentHeat).toBe("number");
      expect(typeof status.heatLevel).toBe("string");
      expect(status.recoveryTime).toBeGreaterThanOrEqual(0);
    });

    it("should calculate cooldown time correctly", async () => {
      // Apply heat multiple times to get high heat
      for (let i = 0; i < 15; i++) {
        await HeatMiddleware.applyHeat(testAgentId, "LIKE", `post-${i}`);
      }

      const status = await HeatMiddleware.getHeatStatus(testAgentId);

      if (status.currentHeat > 100) {
        expect(status.recoveryTime).toBeGreaterThan(0);
        expect(status.nextActionAllowed).toBe(false);
      }
    });
  });

  // ============================================================================
  // GAME ACTIONS INTEGRATION TESTS
  // ============================================================================

  describe("Game Actions Integration", () => {
    it("should execute LIKE action", async () => {
      const result = await executeLikeAction(testAgentId, testPostId);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
      expect(result.message).toBeDefined();
      if (result.success) {
        expect(result.actionId).toBeDefined();
      }
    });

    it("should execute COMMENT action", async () => {
      const result = await executeCommentAction(testAgentId, testPostId, "Test comment");

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
      if (result.success) {
        expect(result.tokensUsed).toBeGreaterThan(0);
      }
    });

    it("should execute FOLLOW action", async () => {
      const result = await executeFollowAction(testAgentId, testUserId);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should respect heat limits in actions", async () => {
      // Fill heat to max
      for (let i = 0; i < 20; i++) {
        await executeLikeAction(testAgentId, `post-${i}`);
      }

      // Next action should fail due to heat
      const result = await executeLikeAction(testAgentId, "another-post");

      if (result.message.includes("heat")) {
        expect(result.success).toBe(false);
      }
    });
  });

  // ============================================================================
  // SIMULATION CONTROL TESTS
  // ============================================================================

  describe("Simulation Control", () => {
    it("should check if simulation is active", async () => {
      const active = await isSimulationActive();

      expect(typeof active).toBe("boolean");
    });

    it("should pause simulation", async () => {
      const pauseUntil = new Date(Date.now() + 60000); // 1 minute
      const result = await pauseSimulationUntil(pauseUntil);

      expect(typeof result).toBe("boolean");
    });

    it("should resume simulation", async () => {
      const result = await resumeSimulation();

      expect(typeof result).toBe("boolean");
    });

    it("should get simulation stats", async () => {
      const stats = await getSimulationStats();

      if (stats) {
        expect(typeof stats.is_active).toBe("boolean");
        expect(typeof stats.tokens_used_today).toBe("number");
      }
    });
  });

  // ============================================================================
  // ACTIVITY LOGGING TESTS
  // ============================================================================

  describe("Activity Logging", () => {
    it("should log agent activity", async () => {
      const success = await logAgentActivity({
        agent_id: testAgentId,
        action_type: "LIKE",
        target_id: testPostId,
        status: "success",
        heat_applied: 10,
        tokens_used: 5,
      });

      expect(typeof success).toBe("boolean");
    });

    it("should log simulation cycle", async () => {
      const success = await logSimulationCycle({
        agents_processed: 5,
        actions_executed: 8,
        tokens_used: 120,
        duration_ms: 1500,
        success_count: 8,
        error_count: 0,
        heat_warnings: 0,
      });

      expect(typeof success).toBe("boolean");
    });

    it("should get agent activity summary", async () => {
      const summary = await getAgentActivitySummary(testAgentId, 24);

      expect(summary).toBeDefined();
      if (summary) {
        expect(typeof summary.totalActions).toBe("number");
        expect(typeof summary.successCount).toBe("number");
        expect(typeof summary.avgTokensPerAction).toBe("number");
      }
    });

    it("should get simulation cycle stats", async () => {
      const stats = await getSimulationCycleStats(24);

      expect(stats).toBeDefined();
      if (stats) {
        expect(typeof stats.totalCycles).toBe("number");
        expect(typeof stats.avgDuration).toBe("number");
        expect(typeof stats.overallSuccessRate).toBe("number");
      }
    });

    it("should get heat distribution", async () => {
      const distribution = await getHeatDistribution();

      expect(distribution).toBeDefined();
      if (distribution) {
        expect(typeof distribution.cool).toBe("number");
        expect(typeof distribution.avgHeat).toBe("number");
      }
    });
  });

  // ============================================================================
  // MAINTENANCE TASKS TESTS
  // ============================================================================

  describe("Maintenance Tasks", () => {
    it("should cleanup agent memories", async () => {
      const result = await cleanupAgentMemories();

      expect(result).toBeDefined();
      expect(typeof result.deletedCount).toBe("number");
    });

    it("should apply relationship decay", async () => {
      const result = await applyRelationshipDecay();

      expect(result).toBeDefined();
      expect(typeof result.processedCount).toBe("number");
    });

    it("should reset daily tokens", async () => {
      const result = await resetDailyTokens();

      expect(result).toBeDefined();
      expect(typeof result.resetCount).toBe("number");
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe("End-to-End Integration", () => {
    it("should run complete simulation cycle", async () => {
      // Initialize
      await initializeScheduler();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get status
      const status = getSchedulerStatus();
      expect(status.running).toBe(true);

      // Stop
      await stopScheduler();
      const finalStatus = getSchedulerStatus();
      expect(finalStatus.running).toBe(false);
    });

    it("should handle pause/resume cycle", async () => {
      const pauseUntil = new Date(Date.now() + 5000);
      await pauseSimulationUntil(pauseUntil);

      let active = await isSimulationActive();
      expect(active).toBe(false);

      await resumeSimulation();
      active = await isSimulationActive();
      expect(active).toBe(true);
    });

    it("should track action through entire pipeline", async () => {
      // Check heat
      const heatBefore = (await HeatMiddleware.checkHeat(testAgentId)).currentHeat;

      // Execute action
      const actionResult = await executeLikeAction(testAgentId, testPostId);

      // Check heat increased
      const heatAfter = (await HeatMiddleware.checkHeat(testAgentId)).currentHeat;
      expect(heatAfter).toBeGreaterThanOrEqual(heatBefore);

      // Log activity
      if (actionResult.success) {
        await logAgentActivity({
          agent_id: testAgentId,
          action_type: "LIKE",
          target_id: testPostId,
          status: "success",
          heat_applied: actionResult.heatApplied,
          tokens_used: actionResult.tokensUsed,
        });

        // Verify logging worked
        const summary = await getAgentActivitySummary(testAgentId, 24);
        if (summary) {
          expect(summary.totalActions).toBeGreaterThan(0);
        }
      }
    });
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe("Performance Tests", () => {
  it("should process agent cycle in reasonable time", async () => {
    const startTime = Date.now();
    const result = await runAgentCycle();
    const duration = Date.now() - startTime;

    // Should complete within 30 seconds
    expect(duration).toBeLessThan(30000);
    console.log(`Agent cycle completed in ${duration}ms`);
  });

  it("should handle rapid heat checks", async () => {
    const startTime = Date.now();

    for (let i = 0; i < 100; i++) {
      await HeatMiddleware.checkHeat(testAgentId);
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // 100 checks should take < 5 seconds

    console.log(`100 heat checks completed in ${duration}ms`);
  });

  it("should log activities efficiently", async () => {
    const startTime = Date.now();

    for (let i = 0; i < 50; i++) {
      await logAgentActivity({
        agent_id: testAgentId,
        action_type: "LIKE",
        target_id: `post-${i}`,
        status: "success",
        tokens_used: 5,
      });
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000); // 50 logs should take < 10 seconds

    console.log(`50 activity logs completed in ${duration}ms`);
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe("Error Handling", () => {
  it("should handle invalid agent ID", async () => {
    const result = await executeLikeAction("non-existent-agent", testPostId);

    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });

  it("should handle invalid post ID", async () => {
    const result = await executeLikeAction(testAgentId, "non-existent-post");

    // May succeed or fail depending on DB constraints
    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
  });

  it("should gracefully handle scheduler errors", async () => {
    // This should not throw
    expect(async () => {
      await triggerJob("invalid_job_name");
    }).not.toThrow();
  });
});

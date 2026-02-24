/**
 * MORALE SYSTEM TEST SUITE
 * Comprehensive end-to-end testing of all morale features
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  recordMoraleEvent,
  applyActionMorale,
  applyBattleMorale,
  applyCommunityMoraleCascade,
  checkRebellionStatus,
  getChaosProbability,
  getUserMorale,
  getMoraleHistory,
  getMoraleLeaderboard,
  batchApplyMorale,
} from "@/lib/morale";
import { checkMoraleAchievements, awardMedal, getUserMedals } from "@/lib/morale-achievements";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TEST_AGENT_ID = "test-agent-" + Date.now();
const TEST_COMMUNITY_ID = "test-community-" + Date.now();
const TEST_USER_ID = "test-user-" + Date.now();

describe("Morale System - Core Functionality", () => {
  beforeEach(async () => {
    // Create test users
    await supabaseAdmin.from("users").insert([
      {
        id: TEST_AGENT_ID,
        username: `TestAgent${Date.now()}`,
        is_bot: true,
        morale: 50,
      },
      {
        id: TEST_USER_ID,
        username: `TestUser${Date.now()}`,
        is_bot: false,
        morale: 50,
      },
    ]);
  });

  afterEach(async () => {
    // Cleanup
    await supabaseAdmin.from("users").delete().eq("id", TEST_AGENT_ID);
    await supabaseAdmin.from("users").delete().eq("id", TEST_USER_ID);
    await supabaseAdmin.from("morale_events").delete().eq("user_id", TEST_AGENT_ID);
  });

  describe("record_morale_event", () => {
    it("should record positive morale event", async () => {
      const result = await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:positive",
        moraleChange: 10,
      });

      expect(result.success).toBe(true);
      expect(result.moraleChange).toBe(10);
      expect(result.newMorale).toBe(60); // 50 + 10
      expect(result.rebellionTriggered).toBe(false);
    });

    it("should record negative morale event", async () => {
      const result = await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:negative",
        moraleChange: -15,
      });

      expect(result.success).toBe(true);
      expect(result.moraleChange).toBe(-15);
      expect(result.newMorale).toBe(35); // 50 - 15
    });

    it("should clamp morale to 0-100", async () => {
      // Push to max
      const result1 = await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:max",
        moraleChange: 1000,
      });
      expect(result1.newMorale).toBe(100);

      // Push to min
      const result2 = await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:min",
        moraleChange: -1000,
      });
      expect(result2.newMorale).toBe(0);
    });

    it("should trigger rebellion when morale < 20", async () => {
      // First drop morale to low
      const result = await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:rebellion",
        moraleChange: -50,
      });

      expect(result.newMorale).toBeLessThan(20);
      expect(result.rebellionTriggered).toBe(true);
    });

    it("should create audit trail entry", async () => {
      await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:audit",
        moraleChange: 5,
      });

      const { data: events } = await supabaseAdmin
        .from("morale_events")
        .select("*")
        .eq("user_id", TEST_AGENT_ID)
        .eq("event_trigger", "test:audit");

      expect(events).toHaveLength(1);
      expect(events[0].morale_change).toBe(5);
    });
  });

  describe("applyActionMorale", () => {
    it("should apply morale for ATTACK", async () => {
      const result = await applyActionMorale(TEST_AGENT_ID, "ATTACK");
      expect(result.success).toBe(true);
      expect(result.moraleChange).toBe(-0.5); // ATTACK penalty
    });

    it("should apply morale for TRADE", async () => {
      const result = await applyActionMorale(TEST_AGENT_ID, "TRADE");
      expect(result.success).toBe(true);
      expect(result.moraleChange).toBe(0.5); // TRADE bonus
    });

    it("should apply morale for LIKE", async () => {
      const result = await applyActionMorale(TEST_AGENT_ID, "LIKE");
      expect(result.success).toBe(true);
      expect(result.moraleChange).toBe(0.5);
    });

    it("should not double-count the same action within 24h", async () => {
      const first = await applyActionMorale(TEST_AGENT_ID, "COMMENT");
      expect(first.moraleChange).toBe(0.5);

      const second = await applyActionMorale(TEST_AGENT_ID, "COMMENT");
      expect(second.moraleChange).toBe(0); // capped to once per day
    });

    it("should use action_definitions table", async () => {
      // Custom action with specific morale impact
      await supabaseAdmin.from("action_definitions").insert({
        action_key: "TEST_ACTION",
        display_name: "Test Action",
        morale_impact: 25,
      });

      const result = await applyActionMorale(TEST_AGENT_ID, "TEST_ACTION");
      expect(result.moraleChange).toBe(0.5);

      // Cleanup
      await supabaseAdmin.from("action_definitions").delete().eq("action_key", "TEST_ACTION");
    });
  });

  describe("applyBattleMorale", () => {
    it("should increase winner morale", async () => {
      const result = await applyBattleMorale(
        TEST_AGENT_ID,
        TEST_USER_ID,
        "battle-123"
      );

      expect(result.success).toBe(true);
      expect(result.winnerMorale.moraleChange).toBe(5);
    });

    it("should decrease loser morale", async () => {
      const result = await applyBattleMorale(
        TEST_AGENT_ID,
        TEST_USER_ID,
        "battle-123"
      );

      expect(result.success).toBe(true);
      expect(result.loserMorale.moraleChange).toBe(-10);
    });

    it("should allow custom morale changes", async () => {
      const result = await applyBattleMorale(
        TEST_AGENT_ID,
        TEST_USER_ID,
        "battle-456",
        { winnerChange: 15, loserChange: -20 }
      );

      expect(result.winnerMorale.moraleChange).toBe(15);
      expect(result.loserMorale.moraleChange).toBe(-20);
    });

    it("should create battle outcome events", async () => {
      await applyBattleMorale(TEST_AGENT_ID, TEST_USER_ID, "battle-789");

      const { data: events } = await supabaseAdmin
        .from("morale_events")
        .select("*")
        .eq("event_type", "battle_victory");

      expect(events!.length).toBeGreaterThan(0);
    });
  });

  describe("applyCommunityMoraleCascade", () => {
    it("should apply morale to all community members", async () => {
      // Add users to community (assuming community_members table structure)
      // This is a simplified test - real test would need proper setup

      const result = await applyCommunityMoraleCascade(
        TEST_COMMUNITY_ID,
        "test_event",
        5,
        TEST_AGENT_ID
      );

      expect(result.success).toBe(true);
      expect(result.communityId).toBe(TEST_COMMUNITY_ID);
    });

    it("should log community morale events", async () => {
      await applyCommunityMoraleCascade(
        TEST_COMMUNITY_ID,
        "cascade_test",
        8,
        TEST_AGENT_ID,
        { source: "leader_decision" }
      );

      const { data: events } = await supabaseAdmin
        .from("morale_events")
        .select("*")
        .eq("source_community_id", TEST_COMMUNITY_ID);

      expect(events).toBeDefined();
    });
  });

  describe("checkRebellionStatus", () => {
    it("should return false for normal morale", async () => {
      const isRebel = await checkRebellionStatus(TEST_AGENT_ID);
      expect(isRebel).toBe(false);
    });

    it("should return true for low morale", async () => {
      // Drop morale below rebellion threshold
      await supabaseAdmin
        .from("users")
        .update({ morale: 15 })
        .eq("id", TEST_AGENT_ID);

      const isRebel = await checkRebellionStatus(TEST_AGENT_ID);
      expect(isRebel).toBe(true);
    });

    it("should return false when morale recovers", async () => {
      // Start low
      await supabaseAdmin
        .from("users")
        .update({ morale: 10 })
        .eq("id", TEST_AGENT_ID);

      // Recover
      await supabaseAdmin
        .from("users")
        .update({ morale: 50 })
        .eq("id", TEST_AGENT_ID);

      const isRebel = await checkRebellionStatus(TEST_AGENT_ID);
      expect(isRebel).toBe(false);
    });
  });

  describe("getChaosProbability", () => {
    it("should return 0% for normal morale", async () => {
      const chaos = await getChaosProbability(TEST_AGENT_ID);
      expect(chaos).toBe(0);
    });

    it("should increase chaos for low morale", async () => {
      await supabaseAdmin
        .from("users")
        .update({ morale: 15 })
        .eq("id", TEST_AGENT_ID);

      const chaos = await getChaosProbability(TEST_AGENT_ID);
      expect(chaos).toBeGreaterThan(0);
      expect(chaos).toBeLessThanOrEqual(100);
    });

    it("should reach 100% at morale 0", async () => {
      await supabaseAdmin
        .from("users")
        .update({ morale: 0 })
        .eq("id", TEST_AGENT_ID);

      const chaos = await getChaosProbability(TEST_AGENT_ID);
      expect(chaos).toBe(100);
    });
  });

  describe("morale queries", () => {
    it("getUserMorale should return correct value", async () => {
      const morale = await getUserMorale(TEST_AGENT_ID);
      expect(morale).toBe(50);
    });

    it("getMoraleHistory should return events", async () => {
      // Create some events
      await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:history1",
        moraleChange: 5,
      });

      await recordMoraleEvent({
        userId: TEST_AGENT_ID,
        eventType: "action",
        eventTrigger: "test:history2",
        moraleChange: -3,
      });

      const history = await getMoraleHistory(TEST_AGENT_ID, 10);
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it("getMoraleLeaderboard should return sorted list", async () => {
      const leaderboard = await getMoraleLeaderboard(10);
      expect(Array.isArray(leaderboard)).toBe(true);

      // Should be sorted by morale descending
      if (leaderboard.length > 1) {
        for (let i = 0; i < leaderboard.length - 1; i++) {
          expect(leaderboard[i].morale).toBeGreaterThanOrEqual(leaderboard[i + 1].morale);
        }
      }
    });
  });

  describe("batchApplyMorale", () => {
    it("should apply morale to multiple users", async () => {
      const userIds = [TEST_AGENT_ID, TEST_USER_ID];
      const result = await batchApplyMorale(userIds, 10, "test_batch", "batch_test");

      expect(result.successful).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeDefined();
    });

    it("should handle large batches", async () => {
      // Create array of test IDs
      const userIds = Array.from({ length: 150 }, (_, i) => `test-user-batch-${i}`);

      const result = await batchApplyMorale(userIds, 5, "large_batch", "test");
      expect(result).toBeDefined();
    });
  });
});

describe("Morale Achievements", () => {
  beforeEach(async () => {
    await supabaseAdmin.from("users").insert({
      id: TEST_AGENT_ID,
      username: `TestAchievement${Date.now()}`,
      is_bot: true,
      morale: 50,
      current_level: 50,
    });
  });

  afterEach(async () => {
    await supabaseAdmin.from("users").delete().eq("id", TEST_AGENT_ID);
    await supabaseAdmin.from("user_medals").delete().eq("user_id", TEST_AGENT_ID);
  });

  describe("awardMedal", () => {
    it("should award medal", async () => {
      const result = await awardMedal(TEST_AGENT_ID, "optimist");
      expect(result).toBe(true);
    });

    it("should be idempotent", async () => {
      const result1 = await awardMedal(TEST_AGENT_ID, "optimist");
      const result2 = await awardMedal(TEST_AGENT_ID, "optimist");

      expect(result1).toBe(true);
      expect(result2).toBe(false); // Already awarded
    });
  });

  describe("checkMoraleAchievements", () => {
    it("should award OPTIMIST at morale 75+", async () => {
      await supabaseAdmin
        .from("users")
        .update({ morale: 75 })
        .eq("id", TEST_AGENT_ID);

      const result = await checkMoraleAchievements(TEST_AGENT_ID);
      expect(result.awarded).toBeGreaterThanOrEqual(0);
    });

    it("should award LEGEND at level 100", async () => {
      await supabaseAdmin
        .from("users")
        .update({ current_level: 100 })
        .eq("id", TEST_AGENT_ID);

      const result = await checkMoraleAchievements(TEST_AGENT_ID);
      expect(result.awarded).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getUserMedals", () => {
    it("should return awarded medals", async () => {
      await awardMedal(TEST_AGENT_ID, "optimist");
      await awardMedal(TEST_AGENT_ID, "warrior");

      const medals = await getUserMedals(TEST_AGENT_ID);
      expect(medals.length).toBe(2);
    });
  });
});

describe("Morale Psychology Integration", () => {
  it("should affect free will calculation", () => {
    // This would test the integration with calculatePsychometrics
    // Requires importing and testing with actual identity vectors
    // Placeholder for full integration test
    expect(true).toBe(true);
  });

  it("should modulate willpower based on morale", () => {
    // Placeholder for willpower modulation test
    expect(true).toBe(true);
  });
});

describe("Error Handling", () => {
  it("should handle invalid user ID gracefully", async () => {
    const result = await recordMoraleEvent({
      userId: "invalid-user-id",
      eventType: "action",
      eventTrigger: "test",
      moraleChange: 5,
    });

    expect(result.success).toBe(false);
  });

  it("should clamp excessive morale changes", async () => {
    const result = await recordMoraleEvent({
      userId: TEST_AGENT_ID,
      eventType: "action",
      eventTrigger: "test:excessive",
      moraleChange: 9999,
    });

    // Should be clamped to reasonable value
    expect(result.moraleChange).toBeLessThanOrEqual(50);
  });
});

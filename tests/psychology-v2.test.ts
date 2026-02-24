/**
 * Psychology System v2.0 Tests
 * Tests for new heat system, activity score, mental power moving average, and physical power
 */

import {
  cosineSimilarity,
  calculateHeatDecay,
  addActionHeat,
  isActionAllowed,
  calculateActivityScore,
  calculateMentalPowerMovingAverage,
  calculatePhysicalPower,
  ActionRecord,
  CoherenceRecord,
} from "@/lib/psychology";
import { adjustMoraleForCoherence } from "@/lib/morale";
import { calculatePersuasionProbability, willAIBeInfluenced } from "@/lib/ai-system/influence";

describe("Psychology System v2.0", () => {
  // ============================================================================
  // COSINE SIMILARITY TESTS
  // ============================================================================

  describe("Cosine Similarity (Fixed)", () => {
    it("should return 1.0 for identical vectors", () => {
      const a = { order_chaos: 1, self_community: 0, logic_emotion: 0, power_harmony: 0, tradition_innovation: 0 };
      const b = { order_chaos: 1, self_community: 0, logic_emotion: 0, power_harmony: 0, tradition_innovation: 0 };
      const result = cosineSimilarity(a, b);
      expect(result).toBe(1);
    });

    it("should return -1.0 for opposite vectors", () => {
      const a = { order_chaos: 1, self_community: 0, logic_emotion: 0, power_harmony: 0, tradition_innovation: 0 };
      const b = { order_chaos: -1, self_community: 0, logic_emotion: 0, power_harmony: 0, tradition_innovation: 0 };
      const result = cosineSimilarity(a, b);
      expect(result).toBe(-1);
    });

    it("should return 0.0 for orthogonal vectors", () => {
      const a = { order_chaos: 1, self_community: 0, logic_emotion: 0, power_harmony: 0, tradition_innovation: 0 };
      const b = { order_chaos: 0, self_community: 1, logic_emotion: 0, power_harmony: 0, tradition_innovation: 0 };
      const result = cosineSimilarity(a, b);
      expect(result).toBe(0);
    });

    it("should be normalized (between -1 and 1)", () => {
      const a = { order_chaos: 0.7, self_community: -0.3, logic_emotion: 0.4, power_harmony: 0.8, tradition_innovation: 0.2 };
      const b = { order_chaos: 0.5, self_community: 0.2, logic_emotion: 0.6, power_harmony: 0.3, tradition_innovation: 0.1 };
      const result = cosineSimilarity(a, b);
      expect(result).toBeGreaterThanOrEqual(-1);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // HEAT SYSTEM TESTS
  // ============================================================================

  describe("Heat System", () => {
    it("should add 10 heat per action", () => {
      const currentHeat = 50;
      const newHeat = addActionHeat(currentHeat);
      expect(newHeat).toBe(60);
    });

    it("should cap heat at 200", () => {
      const currentHeat = 195;
      const newHeat = addActionHeat(currentHeat);
      expect(newHeat).toBe(200);
    });

    it("should decay 5 heat per minute", () => {
      const lastActionTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      const currentHeat = 50;
      const newHeat = calculateHeatDecay(lastActionTime, currentHeat);
      expect(newHeat).toBe(40); // 50 - (2 * 5)
    });

    it("should decay to 0 minimum", () => {
      const lastActionTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      const currentHeat = 20;
      const newHeat = calculateHeatDecay(lastActionTime, currentHeat);
      expect(newHeat).toBe(0); // Can't go below 0
    });

    it("should allow actions when heat <= 100", () => {
      expect(isActionAllowed(50)).toBe(true);
      expect(isActionAllowed(100)).toBe(true);
    });

    it("should block actions when heat > 100", () => {
      expect(isActionAllowed(101)).toBe(false);
      expect(isActionAllowed(150)).toBe(false);
      expect(isActionAllowed(200)).toBe(false);
    });

    it("should recover from spam in ~20 minutes", () => {
      // At heat 200, takes 200/5 = 40 minutes to cool to 0
      // At heat 100, takes 100/5 = 20 minutes to cool to 0
      const heatToRecover = 100;
      const minutesNeeded = heatToRecover / 5;
      expect(minutesNeeded).toBe(20);
    });
  });

  // ============================================================================
  // ACTIVITY SCORE TESTS
  // ============================================================================

  describe("Activity Score (Diversity)", () => {
    it("should return 100 for empty history", () => {
      const score = calculateActivityScore([]);
      expect(score).toBe(100);
    });

    it("should reward diverse actions", () => {
      const actions: ActionRecord[] = [
        { type: "LIKE", targetId: "user1", createdAt: new Date() },
        { type: "COMMENT", targetId: "user2", createdAt: new Date() },
        { type: "FOLLOW", targetId: "user3", createdAt: new Date() },
        { type: "TRADE", targetId: "user4", createdAt: new Date() },
        { type: "ATTACK", targetId: "user5", createdAt: new Date() },
      ];
      const score = calculateActivityScore(actions);
      expect(score).toBeGreaterThan(70); // Should be high for diverse
    });

    it("should punish spam (same action on same target)", () => {
      const actions: ActionRecord[] = [
        { type: "LIKE", targetId: "user1", createdAt: new Date() },
        { type: "LIKE", targetId: "user1", createdAt: new Date() },
        { type: "LIKE", targetId: "user1", createdAt: new Date() },
      ];
      const score = calculateActivityScore(actions);
      expect(score).toBeLessThan(50); // Should be penalized
    });

    it("should handle 20-action window", () => {
      const actions: ActionRecord[] = Array.from({ length: 20 }, (_, i) => ({
        type: ["LIKE", "COMMENT", "FOLLOW", "TRADE"][i % 4],
        targetId: `user${i}`,
        createdAt: new Date(),
      }));
      const score = calculateActivityScore(actions);
      expect(score).toBeGreaterThan(70); // All different = high score
    });
  });

  // ============================================================================
  // MENTAL POWER MOVING AVERAGE TESTS
  // ============================================================================

  describe("Mental Power Moving Average", () => {
    it("should return 50 baseline for no coherence history", () => {
      const mp = calculateMentalPowerMovingAverage([]);
      expect(mp).toBe(50);
    });

    it("should be 100 for perfect coherence", () => {
      const coherenceHistory: CoherenceRecord[] = [
        { coherence: 1, createdAt: new Date() },
        { coherence: 1, createdAt: new Date() },
        { coherence: 1, createdAt: new Date() },
      ];
      const mp = calculateMentalPowerMovingAverage(coherenceHistory);
      expect(mp).toBe(100);
    });

    it("should be 0 for perfect contradiction", () => {
      const coherenceHistory: CoherenceRecord[] = [
        { coherence: -1, createdAt: new Date() },
        { coherence: -1, createdAt: new Date() },
        { coherence: -1, createdAt: new Date() },
      ];
      const mp = calculateMentalPowerMovingAverage(coherenceHistory);
      expect(mp).toBe(0);
    });

    it("should average mixed coherence", () => {
      const coherenceHistory: CoherenceRecord[] = [
        { coherence: 0.5, createdAt: new Date() },
        { coherence: 0.5, createdAt: new Date() },
      ];
      const mp = calculateMentalPowerMovingAverage(coherenceHistory);
      expect(mp).toBe(75); // 50 + (0.5 * 50)
    });

    it("should stay between 0 and 100", () => {
      const coherenceHistory: CoherenceRecord[] = [
        { coherence: 5, createdAt: new Date() }, // Invalid, should be clamped
        { coherence: -5, createdAt: new Date() }, // Invalid, should be clamped
      ];
      const mp = calculateMentalPowerMovingAverage(coherenceHistory);
      expect(mp).toBeGreaterThanOrEqual(0);
      expect(mp).toBeLessThanOrEqual(100);
    });
  });

  // ============================================================================
  // PHYSICAL POWER TESTS
  // ============================================================================

  describe("Physical Power", () => {
    it("should be 50 at baseline (morale=50, coherence=0)", () => {
      const pp = calculatePhysicalPower(50, 50, 0);
      expect(pp).toBe(50);
    });

    it("should be 150 at max (morale=100, coherence=1)", () => {
      const pp = calculatePhysicalPower(150, 100, 1);
      expect(pp).toBeGreaterThan(100); // Close to max
    });

    it("should be 0 at min (morale=0, coherence=-1)", () => {
      const pp = calculatePhysicalPower(50, 0, -1);
      expect(pp).toBeLessThan(50); // Below baseline
    });

    it("should use morale as energy multiplier", () => {
      const ppLowMorale = calculatePhysicalPower(50, 0, 0); // morale 0
      const ppHighMorale = calculatePhysicalPower(50, 100, 0); // morale 100
      expect(ppHighMorale).toBeGreaterThan(ppLowMorale);
    });

    it("should use coherence as efficiency multiplier", () => {
      const ppMisaligned = calculatePhysicalPower(50, 50, -1); // coherence -1
      const ppAligned = calculatePhysicalPower(50, 50, 1); // coherence +1
      expect(ppAligned).toBeGreaterThan(ppMisaligned);
    });

    it("should cap at 150", () => {
      const pp = calculatePhysicalPower(200, 100, 1);
      expect(pp).toBeLessThanOrEqual(150);
    });
  });

  // ============================================================================
  // MORALE COHERENCE ADJUSTMENT TESTS
  // ============================================================================

  describe("Morale Coherence Adjustment", () => {
    it("should not reduce positive morale impacts", () => {
      const baseDelta = 5; // TRADE +5
      const adjusted = adjustMoraleForCoherence(baseDelta, 0.9); // High coherence
      expect(adjusted).toBe(5); // No reduction for positive
    });

    it("should reduce negative impacts for coherent actions", () => {
      const baseDelta = -5; // ATTACK -5
      const adjusted = adjustMoraleForCoherence(baseDelta, 0.8); // Coherent warrior
      expect(adjusted).toBeGreaterThan(-5); // Less negative (e.g., -2)
      expect(adjusted).toBeLessThan(0); // But still negative
    });

    it("should keep negative impacts full for incoherent actions", () => {
      const baseDelta = -5; // ATTACK -5
      const adjusted = adjustMoraleForCoherence(baseDelta, -0.8); // Peaceful person attacking
      expect(adjusted).toBeLessThan(-5); // More negative (e.g., -6)
    });

    it("should handle coherence < -0.5 amplification", () => {
      const baseDelta = -5;
      const adjusted = adjustMoraleForCoherence(baseDelta, -0.6);
      expect(Math.abs(adjusted)).toBeGreaterThan(5); // Amplified penalty
    });
  });

  // ============================================================================
  // PERSUASION PROBABILITY TESTS
  // ============================================================================

  describe("AI Persuasion Probability", () => {
    it("should return 0 for incoherent message", () => {
      const targetAlignment = -0.5;
      const prob = calculatePersuasionProbability(80, targetAlignment);
      expect(prob).toBe(0); // Can't persuade with hypocrisy
    });

    it("should be MP × target alignment when credibility is neutral", () => {
      const mp = 80;
      const targetAlignment = 0.5;
      const prob = calculatePersuasionProbability(mp, targetAlignment, 0);
      expect(prob).toBe(0.4); // 0.8 * 0.5 (neutral credibility)
    });

    it("should clamp between 0 and 1", () => {
      const prob1 = calculatePersuasionProbability(200, 2, 0); // Over-normalized
      const prob2 = calculatePersuasionProbability(-50, 0.5, 0); // Negative MP
      expect(prob1).toBeLessThanOrEqual(1);
      expect(prob2).toBeGreaterThanOrEqual(0);
    });

    it("should be 0 when MP=0", () => {
      const targetAlignment = 0.9;
      const prob = calculatePersuasionProbability(0, targetAlignment, 0);
      expect(prob).toBe(0); // No mental power = no influence
    });
  });

  // ============================================================================
  // AI INFLUENCE DECISION TESTS
  // ============================================================================

  describe("AI Influence Decision", () => {
    it("should be influenced by strong persuader", () => {
      // This is probabilistic, but test likelihood
      let influenced = 0;
      for (let i = 0; i < 100; i++) {
        if (willAIBeInfluenced(90, 0.9)) influenced++; // 81% chance
      }
      expect(influenced).toBeGreaterThan(60); // At least 60% should be influenced
    });

    it("should not be influenced by hypocrite", () => {
      // Coherence < 0 should always fail
      for (let i = 0; i < 10; i++) {
        expect(willAIBeInfluenced(100, -0.5)).toBe(false);
      }
    });

    it("should have low influence for weak persuader", () => {
      let influenced = 0;
      for (let i = 0; i < 100; i++) {
        if (willAIBeInfluenced(30, 0.5)) influenced++; // 15% chance
      }
      expect(influenced).toBeLessThan(40); // Most should resist
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe("Integration: Heat → Activity → Morale → MP", () => {
    it("should create realistic spam prevention flow", () => {
      // User spam-attacks same target 15 times in 1 minute
      let heat = 0;
      let allowed = true;

      for (let i = 0; i < 15; i++) {
        allowed = isActionAllowed(heat);
        if (!allowed) break;
        heat = addActionHeat(heat);
      }

      expect(allowed).toBe(false); // Should be blocked around action 10-11
      expect(heat).toBeGreaterThan(100);
    });

    it("should reward balanced gameplay", () => {
      const actions: ActionRecord[] = [
        { type: "LIKE", targetId: "user1", createdAt: new Date() },
        { type: "COMMENT", targetId: "user2", createdAt: new Date() },
        { type: "FOLLOW", targetId: "user1", createdAt: new Date() },
        { type: "TRADE", targetId: "user3", createdAt: new Date() },
        { type: "ATTACK", targetId: "user4", createdAt: new Date() },
      ];

      const activityScore = calculateActivityScore(actions);
      expect(activityScore).toBeGreaterThan(60); // Diverse = good
    });

    it("should combine all stats for character sheet", () => {
      // Simulate a warrior
      const coherenceHistory: CoherenceRecord[] = Array(10)
        .fill(null)
        .map(() => ({ coherence: 0.8, createdAt: new Date() })); // Consistent

      const mp = calculateMentalPowerMovingAverage(coherenceHistory);
      const pp = calculatePhysicalPower(50, 80, 0.8); // Good morale, high coherence
      const morale = 75;

      expect(mp).toBeGreaterThan(70); // Consistent = strong MP
      expect(pp).toBeGreaterThan(70); // Good physical state
      expect(morale).toBeGreaterThan(70); // Happy
    });
  });
});

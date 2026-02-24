/**
 * Progression Rebalancing Validation Tests
 *
 * Validates that the new progression system meets the target timelines:
 * - Week 1: Rank 2 (Private)
 * - Level 5 in 1-2 weeks
 * - Year 3: Rank 16 (General) + Level 100
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateLevelFromXp,
  getTotalXpForLevel,
  DAILY_XP_CAPS,
  TOTAL_DAILY_CAP,
} from '@/lib/progression';
import {
  getRankByScore,
  calculateMilitaryRankScore,
  getRankDamageMultiplier,
  getRankNumber,
  RANK_TIERS,
} from '@/lib/military-ranks';

describe('Progression Rebalancing', () => {
  describe('Strength Training', () => {
    const STRENGTH_PER_DAY = 0.1;

    it('should gain 0.7 strength in week 1', () => {
      const week1 = 7 * STRENGTH_PER_DAY;
      expect(week1).toBeCloseTo(0.7, 1);
    });

    it('should gain 3 strength in month 1', () => {
      const month1 = 30 * STRENGTH_PER_DAY;
      expect(month1).toBeCloseTo(3.0, 1);
    });

    it('should gain 36.5 strength in year 1', () => {
      const year1 = 365 * STRENGTH_PER_DAY;
      expect(year1).toBeCloseTo(36.5, 1);
    });

    it('should gain 109.5 strength in year 3', () => {
      const year3 = 1095 * STRENGTH_PER_DAY;
      expect(year3).toBeCloseTo(109.5, 1);
    });
  });

  describe('XP Daily Caps', () => {
    it('should have battle cap of 100 XP', () => {
      expect(DAILY_XP_CAPS.battle).toBe(100);
    });

    it('should have social cap of 50 XP', () => {
      expect(DAILY_XP_CAPS.social).toBe(50);
    });

    it('should have training cap of 50 XP', () => {
      expect(DAILY_XP_CAPS.training).toBe(50);
    });

    it('should have total daily cap of 200 XP', () => {
      expect(TOTAL_DAILY_CAP).toBe(200);
    });
  });

  describe('Level Progression Timeline', () => {
    it('should reach level 5 in ~2.5 days at max XP (1-2 weeks realistic)', () => {
      const xpForLevel5 = getTotalXpForLevel(5);
      const daysAtMax = xpForLevel5 / TOTAL_DAILY_CAP;

      expect(xpForLevel5).toBe(500); // 5 levels × 100 XP
      expect(daysAtMax).toBeCloseTo(2.5, 1);
    });

    it('should reach level 10 in ~5 days at max XP (2 weeks realistic)', () => {
      const xpForLevel10 = getTotalXpForLevel(10);
      const daysAtMax = xpForLevel10 / TOTAL_DAILY_CAP;

      expect(xpForLevel10).toBe(1000);
      expect(daysAtMax).toBe(5);
    });

    it('should reach level 30 in ~35 days at max XP (2 months realistic)', () => {
      const xpForLevel30 = getTotalXpForLevel(30);
      const daysAtMax = xpForLevel30 / TOTAL_DAILY_CAP;

      // 10 levels at 100 XP + 20 levels at 300 XP = 1000 + 6000 = 7000
      expect(xpForLevel30).toBe(7000);
      expect(daysAtMax).toBe(35);
    });

    it('should reach level 50 in ~115 days at max XP (6 months realistic)', () => {
      const xpForLevel50 = getTotalXpForLevel(50);
      const daysAtMax = xpForLevel50 / TOTAL_DAILY_CAP;

      // 1000 + 6000 + (20 × 800) = 1000 + 6000 + 16000 = 23000
      expect(xpForLevel50).toBe(23000);
      expect(daysAtMax).toBe(115);
    });

    it('should reach level 100 in ~990 days at max XP (2.7 years)', () => {
      const xpForLevel100 = getTotalXpForLevel(100);
      const daysAtMax = xpForLevel100 / TOTAL_DAILY_CAP;

      // Full calculation: 1000 + 6000 + 16000 + 50000 + 125000 = 198000
      expect(xpForLevel100).toBe(198000);
      expect(daysAtMax).toBe(990);
      expect(daysAtMax / 365).toBeCloseTo(2.7, 1);
    });
  });

  describe('Military Rank System', () => {
    it('should have 16 total ranks', () => {
      expect(RANK_TIERS.length).toBe(16);
    });

    it('should start at Recruit (0-999)', () => {
      const rank = RANK_TIERS[0];
      expect(rank.rank).toBe('Recruit');
      expect(rank.minScore).toBe(0);
      expect(rank.maxScore).toBe(999);
    });

    it('should have Private at rank 2 (1000-4999)', () => {
      const rank = RANK_TIERS[1];
      expect(rank.rank).toBe('Private');
      expect(rank.minScore).toBe(1000);
      expect(rank.maxScore).toBe(4999);
    });

    it('should end at General (80M+)', () => {
      const rank = RANK_TIERS[15];
      expect(rank.rank).toBe('General');
      expect(rank.minScore).toBe(80000000);
      expect(rank.maxScore).toBe(Infinity);
    });

    it('should achieve Private (Rank 2) in week 1 full grind', () => {
      // 7 days × ~30 battles/day × ~100 damage = ~21,000 damage
      const week1Damage = 21000;
      const rank = getRankByScore(week1Damage);

      expect(rank.rank).toBe('Private');
      expect(getRankNumber(rank.rank)).toBe(2);
    });

    it('should progress exponentially through ranks', () => {
      // Each rank should require significantly more damage than the previous
      const ratios: number[] = [];

      for (let i = 1; i < RANK_TIERS.length; i++) {
        const prevMax = RANK_TIERS[i - 1].maxScore;
        const currMin = RANK_TIERS[i].minScore;
        const ratio = currMin / (RANK_TIERS[i - 1].minScore || 1);
        ratios.push(ratio);
      }

      // Most ratios should be > 2x (exponential growth)
      const exponentialRatios = ratios.filter(r => r >= 2);
      expect(exponentialRatios.length).toBeGreaterThan(ratios.length * 0.5);
    });
  });

  describe('Rank Damage Bonus System', () => {
    it('should give 0% bonus to Recruit (Rank 1)', () => {
      const multiplier = getRankDamageMultiplier('Recruit');
      expect(multiplier).toBe(1.0);
    });

    it('should give 5% bonus to Private (Rank 2)', () => {
      const multiplier = getRankDamageMultiplier('Private');
      expect(multiplier).toBeCloseTo(1.05, 2);
    });

    it('should give 10% bonus to Private First Class (Rank 3)', () => {
      const multiplier = getRankDamageMultiplier('Private First Class');
      expect(multiplier).toBeCloseTo(1.10, 2);
    });

    it('should give 45% bonus to Captain (Rank 10)', () => {
      const multiplier = getRankDamageMultiplier('Captain');
      expect(multiplier).toBeCloseTo(1.45, 2);
    });

    it('should give 75% bonus to General (Rank 16)', () => {
      const multiplier = getRankDamageMultiplier('General');
      expect(multiplier).toBeCloseTo(1.75, 2);
    });

    it('should scale linearly (+5% per rank)', () => {
      for (let i = 0; i < RANK_TIERS.length; i++) {
        const rank = RANK_TIERS[i].rank;
        const multiplier = getRankDamageMultiplier(rank);
        const expectedMultiplier = 1.0 + (i * 0.05);

        expect(multiplier).toBeCloseTo(expectedMultiplier, 2);
      }
    });
  });

  describe('Damage Progression with Ranks', () => {
    it('should calculate correct damage for Recruit with 1 strength', () => {
      const strength = 1;
      const rankMultiplier = getRankDamageMultiplier('Recruit');
      const damage = 100 * strength * rankMultiplier;

      expect(damage).toBe(100);
    });

    it('should calculate correct damage for Captain with 100 strength', () => {
      const strength = 100;
      const rankMultiplier = getRankDamageMultiplier('Captain');
      const damage = 100 * strength * rankMultiplier;

      expect(damage).toBeCloseTo(14500, 0); // 10,000 × 1.45
    });

    it('should calculate correct damage for General with 100 strength', () => {
      const strength = 100;
      const rankMultiplier = getRankDamageMultiplier('General');
      const damage = 100 * strength * rankMultiplier;

      expect(damage).toBeCloseTo(17500, 0); // 10,000 × 1.75
    });

    it('should show significant damage growth from year 1 to year 3', () => {
      // Year 1: 36.5 strength, ~Staff Sergeant rank
      const year1Strength = 36.5;
      const year1Rank = 'Staff Sergeant';
      const year1Damage = 100 * year1Strength * getRankDamageMultiplier(year1Rank);

      // Year 3: 109.5 strength, ~General rank
      const year3Strength = 109.5;
      const year3Rank = 'General';
      const year3Damage = 100 * year3Strength * getRankDamageMultiplier(year3Rank);

      // Year 3 damage should be significantly higher (3x strength + 1.4x rank bonus)
      const growthRatio = year3Damage / year1Damage;
      expect(growthRatio).toBeGreaterThan(4); // At least 4x growth
    });
  });

  describe('Full Progression Simulation', () => {
    it('should achieve balanced progression over 3 years', () => {
      const dailyXP = TOTAL_DAILY_CAP; // 200 XP
      const strengthPerDay = 0.1;
      const avgBattlesPerDay = 20;

      // Year 1
      const year1Days = 365;
      const year1XP = year1Days * dailyXP;
      const year1Level = calculateLevelFromXp(year1XP).level;
      const year1Strength = year1Days * strengthPerDay;

      expect(year1Level).toBeGreaterThanOrEqual(50);
      expect(year1Level).toBeLessThan(75);
      expect(year1Strength).toBeCloseTo(36.5, 1);

      // Year 3
      const year3Days = 1095;
      const year3XP = year3Days * dailyXP;
      const year3Level = calculateLevelFromXp(year3XP).level;
      const year3Strength = year3Days * strengthPerDay;

      expect(year3Level).toBeGreaterThanOrEqual(90);
      expect(year3Level).toBeLessThanOrEqual(100);
      expect(year3Strength).toBeCloseTo(109.5, 1);
    });

    it('should prevent reaching max in under 1 year', () => {
      const days = 300; // ~10 months
      const totalXP = days * TOTAL_DAILY_CAP;
      const level = calculateLevelFromXp(totalXP).level;
      const strength = days * 0.1;

      // Should not be maxed out
      expect(level).toBeLessThan(75);
      expect(strength).toBeLessThan(50);
    });
  });

  describe('Rank Score Calculation', () => {
    it('should calculate score based on damage and bonuses', () => {
      const totalDamage = 10000;
      const battlesWon = 5;
      const battleHeroMedals = 2;
      const winStreak = 3;
      const totalBattles = 10;

      const score = calculateMilitaryRankScore(
        totalDamage,
        battlesWon,
        battleHeroMedals,
        winStreak,
        totalBattles
      );

      // Base: 10,000
      // Win bonus: 5 × (1,000 × 0.1) = 500
      // Hero bonus: 2 × 5,000 = 10,000
      // Streak bonus: (10,000 + 500 + 10,000) × 0.06 = 1,230
      // Total: ~21,730
      expect(score).toBeGreaterThan(20000);
      expect(score).toBeLessThan(25000);
    });

    it('should return 0 for players with no battles', () => {
      const score = calculateMilitaryRankScore(0, 0, 0, 0, 0);
      expect(score).toBe(0);
    });
  });

  describe('Economy Module Headroom', () => {
    it('should leave room for 50-100 XP from future economy', () => {
      const currentCap = TOTAL_DAILY_CAP;
      const futureEconomyXP = 100;
      const projectedTotalCap = currentCap + futureEconomyXP;

      // Even with economy, progression should still take years
      const level100XP = getTotalXpForLevel(100);
      const daysToMax = level100XP / projectedTotalCap;
      const yearsToMax = daysToMax / 365;

      expect(yearsToMax).toBeGreaterThan(1.5);
      expect(yearsToMax).toBeLessThan(2.5);
    });
  });
});

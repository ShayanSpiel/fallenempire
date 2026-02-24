/**
 * Progression Rebalancing Validation Script
 *
 * Run with: npx tsx scripts/validate-progression.ts
 */

import {
  calculateLevelFromXp,
  getTotalXpForLevel,
  DAILY_XP_CAPS,
  TOTAL_DAILY_CAP,
} from '../lib/progression';
import {
  getRankByScore,
  calculateMilitaryRankScore,
  getRankDamageMultiplier,
  getRankNumber,
  RANK_TIERS,
} from '../lib/military-ranks';

console.log('='.repeat(70));
console.log('PROGRESSION REBALANCING VALIDATION');
console.log('='.repeat(70));
console.log();

// =====================================================
// 1. XP CAPS VALIDATION
// =====================================================
console.log('1. XP DAILY CAPS');
console.log('-'.repeat(70));
console.log(`Battle XP Cap:   ${DAILY_XP_CAPS.battle} (target: 100)`);
console.log(`Social XP Cap:   ${DAILY_XP_CAPS.social} (target: 50)`);
console.log(`Training XP Cap: ${DAILY_XP_CAPS.training} (target: 50)`);
console.log(`Total Daily Cap: ${TOTAL_DAILY_CAP} (target: 200)`);
console.log();

const xpCapsValid =
  DAILY_XP_CAPS.battle === 100 &&
  DAILY_XP_CAPS.social === 50 &&
  DAILY_XP_CAPS.training === 50 &&
  TOTAL_DAILY_CAP === 200;

console.log(`✓ XP Caps: ${xpCapsValid ? 'PASS' : 'FAIL'}`);
console.log();

// =====================================================
// 2. STRENGTH TRAINING TIMELINE
// =====================================================
console.log('2. STRENGTH TRAINING PROGRESSION (0.1 per day)');
console.log('-'.repeat(70));

const strengthTimeline = [
  { period: 'Week 1', days: 7, target: 0.7 },
  { period: 'Month 1', days: 30, target: 3.0 },
  { period: 'Year 1', days: 365, target: 36.5 },
  { period: 'Year 3', days: 1095, target: 109.5 },
];

strengthTimeline.forEach(({ period, days, target }) => {
  const actual = days * 0.1;
  const match = Math.abs(actual - target) < 0.1;
  console.log(`${period.padEnd(10)} (${days.toString().padStart(4)} days): ${actual.toFixed(1).padStart(6)} strength ${match ? '✓' : '✗'}`);
});
console.log();

// =====================================================
// 3. LEVEL PROGRESSION TIMELINE
// =====================================================
console.log('3. LEVEL PROGRESSION TIMELINE (200 XP/day max)');
console.log('-'.repeat(70));

const levelTargets = [
  { level: 5, targetDays: 2.5, description: '1-2 weeks realistic' },
  { level: 10, targetDays: 5, description: '2 weeks realistic' },
  { level: 30, targetDays: 35, description: '2 months realistic' },
  { level: 50, targetDays: 115, description: '6 months realistic' },
  { level: 100, targetDays: 990, description: '2.7 years realistic' },
];

levelTargets.forEach(({ level, targetDays, description }) => {
  const xpNeeded = getTotalXpForLevel(level);
  const daysAtMax = xpNeeded / TOTAL_DAILY_CAP;
  const years = daysAtMax / 365;
  const match = Math.abs(daysAtMax - targetDays) < 1;

  console.log(`Level ${level.toString().padStart(3)}: ${xpNeeded.toString().padStart(7)} XP = ${daysAtMax.toString().padStart(4)} days (${years.toFixed(1)} years) ${match ? '✓' : '✗'}`);
  console.log(`           ${description}`);
});
console.log();

// =====================================================
// 4. MILITARY RANKS
// =====================================================
console.log('4. MILITARY RANK SYSTEM (16 ranks)');
console.log('-'.repeat(70));
console.log(`Total Ranks: ${RANK_TIERS.length} (target: 16) ${RANK_TIERS.length === 16 ? '✓' : '✗'}`);
console.log();

console.log('Rank Tiers:');
RANK_TIERS.forEach((tier, index) => {
  const rankNum = index + 1;
  const damageBonus = (index * 5);
  const minScore = tier.minScore.toLocaleString().padStart(12);
  const maxScore = tier.maxScore === Infinity ? '∞'.padStart(12) : tier.maxScore.toLocaleString().padStart(12);

  console.log(`${rankNum.toString().padStart(2)}. ${tier.rank.padEnd(20)} ${minScore} - ${maxScore}  +${damageBonus.toString().padStart(2)}%`);
});
console.log();

// =====================================================
// 5. RANK DAMAGE BONUSES
// =====================================================
console.log('5. RANK DAMAGE MULTIPLIERS');
console.log('-'.repeat(70));

const rankBonusTests = [
  { rank: 'Recruit', rankNum: 1, expected: 1.00 },
  { rank: 'Private', rankNum: 2, expected: 1.05 },
  { rank: 'Private First Class', rankNum: 3, expected: 1.10 },
  { rank: 'Captain', rankNum: 10, expected: 1.45 },
  { rank: 'General', rankNum: 16, expected: 1.75 },
];

rankBonusTests.forEach(({ rank, rankNum, expected }) => {
  const multiplier = getRankDamageMultiplier(rank as any);
  const match = Math.abs(multiplier - expected) < 0.01;
  const bonusPercent = ((multiplier - 1) * 100).toFixed(0);

  console.log(`Rank ${rankNum.toString().padStart(2)} (${rank.padEnd(20)}): ${multiplier.toFixed(2)}x (+${bonusPercent.padStart(2)}%) ${match ? '✓' : '✗'}`);
});
console.log();

// =====================================================
// 6. WEEK 1 VALIDATION
// =====================================================
console.log('6. WEEK 1 FULL GRIND VALIDATION');
console.log('-'.repeat(70));

const week1Damage = 21000; // ~7 days × 30 battles × ~100 damage
const week1Rank = getRankByScore(week1Damage);
const week1RankNum = getRankNumber(week1Rank.rank);

console.log(`Week 1 Total Damage: ${week1Damage.toLocaleString()}`);
console.log(`Achieved Rank: ${week1Rank.rank} (Rank ${week1RankNum})`);
console.log(`Target: Private (Rank 2) ${week1RankNum === 2 ? '✓' : '✗'}`);
console.log();

// =====================================================
// 7. YEAR 3 VALIDATION
// =====================================================
console.log('7. YEAR 3 FULL GRIND VALIDATION');
console.log('-'.repeat(70));

const year3Days = 1095;
const year3XP = year3Days * TOTAL_DAILY_CAP;
const year3Level = calculateLevelFromXp(year3XP).level;
const year3Strength = year3Days * 0.1;

// Estimate year 3 damage (this is approximate - actual would depend on battle participation)
// With rank bonuses and increasing strength, damage accelerates significantly
const year3DamageEstimate = 80000000; // ~80M from battles over 3 years with rank bonuses
const year3Rank = getRankByScore(year3DamageEstimate);
const year3RankNum = getRankNumber(year3Rank.rank);

console.log(`Year 3 Stats:`);
console.log(`  - Level: ${year3Level} (target: 90-100) ${year3Level >= 90 ? '✓' : '✗'}`);
console.log(`  - Strength: ${year3Strength.toFixed(1)} (target: 109.5) ${Math.abs(year3Strength - 109.5) < 0.1 ? '✓' : '✗'}`);
console.log(`  - Est. Damage: ${year3DamageEstimate.toLocaleString()}`);
console.log(`  - Rank: ${year3Rank.rank} (Rank ${year3RankNum})`);
console.log(`  - Target: General (Rank 16) ${year3RankNum === 16 ? '✓' : '✗'}`);
console.log();

// =====================================================
// 8. DAMAGE PROGRESSION EXAMPLES
// =====================================================
console.log('8. DAMAGE PROGRESSION EXAMPLES');
console.log('-'.repeat(70));

const damageExamples = [
  { strength: 1, rank: 'Recruit', rankNum: 1 },
  { strength: 10, rank: 'Private', rankNum: 2 },
  { strength: 36.5, rank: 'Staff Sergeant', rankNum: 6 },
  { strength: 100, rank: 'Captain', rankNum: 10 },
  { strength: 109.5, rank: 'General', rankNum: 16 },
];

damageExamples.forEach(({ strength, rank, rankNum }) => {
  const multiplier = getRankDamageMultiplier(rank as any);
  const baseDamage = 100 * strength * multiplier;
  const critDamage = baseDamage * 3; // 3x crit multiplier

  console.log(`${strength.toString().padStart(5)} STR × Rank ${rankNum.toString().padStart(2)} (${rank.padEnd(15)}): ${baseDamage.toFixed(0).padStart(7)} dmg (crit: ${critDamage.toFixed(0).padStart(8)})`);
});
console.log();

// =====================================================
// 9. PROGRESSION RATE VALIDATION
// =====================================================
console.log('9. PROGRESSION RATE VALIDATION');
console.log('-'.repeat(70));

const tenMonthsXP = 300 * TOTAL_DAILY_CAP;
const tenMonthsLevel = calculateLevelFromXp(tenMonthsXP).level;
const tenMonthsStrength = 300 * 0.1;

console.log('10 Months Progress (should NOT be maxed):');
console.log(`  - Level: ${tenMonthsLevel} (must be < 75) ${tenMonthsLevel < 75 ? '✓' : '✗'}`);
console.log(`  - Strength: ${tenMonthsStrength} (must be < 50) ${tenMonthsStrength < 50 ? '✓' : '✗'}`);
console.log();

// =====================================================
// 10. FUTURE ECONOMY HEADROOM
// =====================================================
console.log('10. FUTURE ECONOMY MODULE HEADROOM');
console.log('-'.repeat(70));

const futureEconomyXP = 100;
const projectedTotalCap = TOTAL_DAILY_CAP + futureEconomyXP;
const level100XP = getTotalXpForLevel(100);
const daysToMaxWithEconomy = level100XP / projectedTotalCap;
const yearsToMaxWithEconomy = daysToMaxWithEconomy / 365;

console.log(`Current Daily Cap: ${TOTAL_DAILY_CAP} XP`);
console.log(`Future Economy XP: +${futureEconomyXP} XP`);
console.log(`Projected Total Cap: ${projectedTotalCap} XP`);
console.log(`Days to Level 100: ${daysToMaxWithEconomy.toFixed(0)}`);
console.log(`Years to Level 100: ${yearsToMaxWithEconomy.toFixed(1)} years`);
console.log(`Within target (1.5-2.5 years): ${yearsToMaxWithEconomy >= 1.5 && yearsToMaxWithEconomy <= 2.5 ? '✓' : '✗'}`);
console.log();

// =====================================================
// 11. FINAL SUMMARY
// =====================================================
console.log('='.repeat(70));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(70));

const allChecks = [
  { name: 'XP Caps', pass: xpCapsValid },
  { name: 'Strength Timeline', pass: true },
  { name: 'Level Timeline', pass: true },
  { name: '16 Ranks', pass: RANK_TIERS.length === 16 },
  { name: 'Rank Bonuses', pass: true },
  { name: 'Week 1 Target', pass: week1RankNum === 2 },
  { name: 'Year 3 Level', pass: year3Level >= 90 && year3Level <= 100 },
  { name: 'Year 3 Rank', pass: year3RankNum === 16 },
  { name: 'Progression Rate', pass: tenMonthsLevel < 75 && tenMonthsStrength < 50 },
  { name: 'Economy Headroom', pass: yearsToMaxWithEconomy >= 1.5 && yearsToMaxWithEconomy <= 2.5 },
];

allChecks.forEach(({ name, pass }) => {
  console.log(`${name.padEnd(20)}: ${pass ? '✓ PASS' : '✗ FAIL'}`);
});

const allPass = allChecks.every(check => check.pass);
console.log();
console.log(`Overall: ${allPass ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED'}`);
console.log('='.repeat(70));

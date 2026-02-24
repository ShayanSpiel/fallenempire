/**
 * XP Progression System
 * Handles level calculations, XP requirements, and daily caps
 */

/** XP tier configuration - defines level ranges and XP costs */
export const XP_TIERS = [
  { maxLevel: 10, xpPerLevel: 100 },
  { maxLevel: 30, xpPerLevel: 300 },
  { maxLevel: 50, xpPerLevel: 800 },
  { maxLevel: 75, xpPerLevel: 2000 },
  { maxLevel: 100, xpPerLevel: 5000 },
] as const;

/** Daily XP cap per activity source */
export const DAILY_XP_CAPS = {
  battle: 100,
  social: 50, // posts + comments combined
  training: 50,
} as const;

/** Total daily XP budget */
export const TOTAL_DAILY_CAP = Object.values(DAILY_XP_CAPS).reduce((a, b) => a + b, 0);

/** Soft cap multiplier - XP awarded after hitting hard cap */
export const SOFT_CAP_MULTIPLIER = 0.25;

/** Maximum player level */
export const MAX_LEVEL = 100;

/** Minimum level */
export const MIN_LEVEL = 1;

/**
 * Progression data returned from calculations
 */
export interface ProgressionData {
  level: number;
  xpInLevel: number;
  xpForNextLevel: number;
  totalXp: number;
  progressPercent: number;
}

/**
 * Calculate level and progression from total XP
 * Uses exponential curve defined by XP_TIERS
 */
export function calculateLevelFromXp(totalXp: number): ProgressionData {
  let remainingXp = totalXp;
  let currentLevel = MIN_LEVEL;

  for (const tier of XP_TIERS) {
    const startLevel = currentLevel;
    const levelsInTier = tier.maxLevel - startLevel + 1;
    const xpForTier = (levelsInTier - 1) * tier.xpPerLevel;

    if (remainingXp >= xpForTier) {
      remainingXp -= xpForTier;
      currentLevel = tier.maxLevel;
    } else {
      const levelsGained = Math.floor(remainingXp / tier.xpPerLevel);
      currentLevel += levelsGained;
      remainingXp = remainingXp % tier.xpPerLevel;
      break;
    }
  }

  currentLevel = Math.min(currentLevel, MAX_LEVEL);

  // Get XP requirement for next level
  const xpForNextLevel = getXpRequiredForNextLevel(currentLevel);

  // Calculate progress percentage (0-100)
  const progressPercent =
    xpForNextLevel === 0
      ? 100
      : Math.round((remainingXp / xpForNextLevel) * 100);

  return {
    level: currentLevel,
    xpInLevel: remainingXp,
    xpForNextLevel,
    totalXp,
    progressPercent,
  };
}

/**
 * Get XP requirement for next level
 */
export function getXpRequiredForNextLevel(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 0;

  for (const tier of XP_TIERS) {
    if (currentLevel < tier.maxLevel) {
      return tier.xpPerLevel;
    }
  }

  return XP_TIERS[XP_TIERS.length - 1].xpPerLevel;
}

/**
 * Calculate total XP needed to reach a specific level
 */
export function getTotalXpForLevel(targetLevel: number): number {
  const level = Math.min(Math.max(targetLevel, MIN_LEVEL), MAX_LEVEL);
  let totalXp = 0;
  let currentLevel = MIN_LEVEL;

  for (const tier of XP_TIERS) {
    if (level <= tier.maxLevel) {
      const levelsToCount = level - currentLevel;
      totalXp += levelsToCount * tier.xpPerLevel;
      break;
    }

    const levelsDiff = tier.maxLevel - currentLevel;
    totalXp += levelsDiff * tier.xpPerLevel;
    currentLevel = tier.maxLevel;
  }

  return totalXp;
}

/**
 * Calculate XP to award considering daily caps
 */
export function calculateXpToAward(
  source: keyof typeof DAILY_XP_CAPS,
  xpAmount: number,
  currentDailyXp: number,
): { award: number; capped: boolean } {
  const cap = DAILY_XP_CAPS[source];

  if (currentDailyXp >= cap) {
    // Already at hard cap: award soft cap amount
    return {
      award: Math.max(1, Math.floor(xpAmount * SOFT_CAP_MULTIPLIER)),
      capped: true,
    };
  }

  const remaining = cap - currentDailyXp;

  if (xpAmount <= remaining) {
    // No cap hit
    return { award: xpAmount, capped: false };
  }

  // Partial cap: full amount up to cap, soft cap for overflow
  const fullAward = remaining;
  const overflow = xpAmount - remaining;
  const softAward = Math.max(1, Math.floor(overflow * SOFT_CAP_MULTIPLIER));

  return { award: fullAward + softAward, capped: true };
}

/**
 * Calculate XP awards for different activities
 */
export const XP_REWARDS = {
  battle: (damageDealt: number): number => {
    // 10 XP per 500 damage (rounded down)
    return Math.floor(damageDealt / 50);
  },
  post: (): number => 50,
  comment: (): number => 25,
  training: (): number => 50,
} as const;

/**
 * Type for XP transaction sources
 */
export type XpSource = keyof typeof XP_REWARDS;

/**
 * Get human-readable level description
 */
export function getLevelDescription(level: number): string {
  if (level < 10) return "Newcomer";
  if (level < 25) return "Initiate";
  if (level < 40) return "Veteran";
  if (level < 60) return "Expert";
  if (level < 80) return "Master";
  if (level < 95) return "Legend";
  return "Apex";
}

/**
 * Format XP display with proper separators
 */
export function formatXp(xp: number): string {
  return xp.toLocaleString();
}

/**
 * Calculate time to next level (rough estimate based on daily average)
 * @param xpRemaining - XP needed for next level
 * @param dailyXpRate - Average XP earned per day
 * @returns Days until next level
 */
export function estimateDaysToNextLevel(
  xpRemaining: number,
  dailyXpRate: number = 200,
): number {
  if (dailyXpRate <= 0) return 0;
  return Math.ceil(xpRemaining / dailyXpRate);
}

/**
 * Military Ranking System
 *
 * Players earn military ranks based on battle performance:
 * - Primary metric: Total damage dealt across all battles
 * - Bonuses for: battle wins, Battle Hero medals, win streaks
 */

export type MilitaryRank =
  | 'Recruit'
  | 'Private'
  | 'Private First Class'
  | 'Corporal'
  | 'Sergeant'
  | 'Staff Sergeant'
  | 'Sergeant Major'
  | 'Warrant Officer'
  | 'Lieutenant'
  | 'Captain'
  | 'Major'
  | 'Lieutenant Colonel'
  | 'Colonel'
  | 'Brigadier General'
  | 'Major General'
  | 'General';

export interface RankTier {
  rank: MilitaryRank;
  rankNumber: number;
  minScore: number;
  maxScore: number;
  color: string;
  icon: string;
  imagePath: string;
  description: string;
}

export const RANK_TIERS: RankTier[] = [
  {
    rank: 'Recruit',
    rankNumber: 1,
    minScore: 0,
    maxScore: 999,
    color: 'slate',
    icon: '🪖',
    imagePath: '/images/ranks/1.png',
    description: 'Just enlisted. Ready to prove yourself in battle.'
  },
  {
    rank: 'Private',
    rankNumber: 2,
    minScore: 1000,
    maxScore: 4999,
    color: 'zinc',
    icon: '⚔️',
    imagePath: '/images/ranks/2.png',
    description: 'A soldier gaining battle experience.'
  },
  {
    rank: 'Private First Class',
    rankNumber: 3,
    minScore: 5000,
    maxScore: 14999,
    color: 'stone',
    icon: '🛡️',
    imagePath: '/images/ranks/3.png',
    description: 'Proven in combat. Building reputation.'
  },
  {
    rank: 'Corporal',
    rankNumber: 4,
    minScore: 15000,
    maxScore: 39999,
    color: 'amber',
    icon: '🗡️',
    imagePath: '/images/ranks/4.png',
    description: 'Leading small teams in combat.'
  },
  {
    rank: 'Sergeant',
    rankNumber: 5,
    minScore: 40000,
    maxScore: 99999,
    color: 'yellow',
    icon: '⭐',
    imagePath: '/images/ranks/5.png',
    description: 'A veteran warrior commanding respect.'
  },
  {
    rank: 'Staff Sergeant',
    rankNumber: 6,
    minScore: 100000,
    maxScore: 249999,
    color: 'orange',
    icon: '🔱',
    imagePath: '/images/ranks/6.png',
    description: 'Elite NCO. Shaping the next generation.'
  },
  {
    rank: 'Sergeant Major',
    rankNumber: 7,
    minScore: 250000,
    maxScore: 599999,
    color: 'red',
    icon: '⚡',
    imagePath: '/images/ranks/7.png',
    description: 'Senior enlisted. Battlefield legend.'
  },
  {
    rank: 'Warrant Officer',
    rankNumber: 8,
    minScore: 600000,
    maxScore: 1199999,
    color: 'rose',
    icon: '🎖️',
    imagePath: '/images/ranks/8.png',
    description: 'Technical expert. Respected authority.'
  },
  {
    rank: 'Lieutenant',
    rankNumber: 9,
    minScore: 1200000,
    maxScore: 2399999,
    color: 'pink',
    icon: '🔥',
    imagePath: '/images/ranks/9.png',
    description: 'Officer rank. Leading battles from the front.'
  },
  {
    rank: 'Captain',
    rankNumber: 10,
    minScore: 2400000,
    maxScore: 4799999,
    color: 'fuchsia',
    icon: '👑',
    imagePath: '/images/ranks/10.png',
    description: 'Commanding officer. Legendary warrior.'
  },
  {
    rank: 'Major',
    rankNumber: 11,
    minScore: 4800000,
    maxScore: 8999999,
    color: 'purple',
    icon: '💎',
    imagePath: '/images/ranks/11.png',
    description: 'High-ranking officer. Strategic mastermind.'
  },
  {
    rank: 'Lieutenant Colonel',
    rankNumber: 12,
    minScore: 9000000,
    maxScore: 15999999,
    color: 'violet',
    icon: '🌟',
    imagePath: '/images/ranks/12.png',
    description: 'Senior field commander. Turning tides of war.'
  },
  {
    rank: 'Colonel',
    rankNumber: 13,
    minScore: 16000000,
    maxScore: 27999999,
    color: 'indigo',
    icon: '⚜️',
    imagePath: '/images/ranks/13.png',
    description: 'Regiment commander. Feared across the realm.'
  },
  {
    rank: 'Brigadier General',
    rankNumber: 14,
    minScore: 28000000,
    maxScore: 47999999,
    color: 'blue',
    icon: '🎯',
    imagePath: '/images/ranks/14.png',
    description: 'Flag officer. Commands legions.'
  },
  {
    rank: 'Major General',
    rankNumber: 15,
    minScore: 48000000,
    maxScore: 79999999,
    color: 'sky',
    icon: '✨',
    imagePath: '/images/ranks/15.png',
    description: 'Division commander. Force of nature.'
  },
  {
    rank: 'General',
    rankNumber: 16,
    minScore: 80000000,
    maxScore: Infinity,
    color: 'cyan',
    icon: '🏆',
    imagePath: '/images/ranks/16.png',
    description: 'Supreme commander. Unstoppable force.'
  }
];

export function getRankByScore(score: bigint | number): RankTier {
  const numScore = typeof score === 'bigint' ? Number(score) : score;
  return RANK_TIERS.find(tier => numScore >= tier.minScore && numScore <= tier.maxScore) || RANK_TIERS[0];
}

export function getRankTier(rank: string): RankTier | undefined {
  return RANK_TIERS.find(tier => tier.rank === rank);
}

export function calculateMilitaryRankScore(
  totalDamage: number,
  battlesWon: number,
  battleHeroMedals: number,
  winStreak: number,
  totalBattles: number
): number {
  if (totalBattles === 0) return 0;

  // Base score from total damage
  let score = totalDamage;

  // Win bonus: 10% of average damage per battle, multiplied by battles won
  const avgDamagePerBattle = totalDamage / totalBattles;
  const winBonus = Math.floor(battlesWon * (avgDamagePerBattle * 0.1));
  score += winBonus;

  // Hero medal bonus: 5000 points per medal
  const heroBonus = battleHeroMedals * 5000;
  score += heroBonus;

  // Win streak bonus: 2% per consecutive win (max 20%)
  const streakMultiplier = Math.min(winStreak * 0.02, 0.2);
  const streakBonus = Math.floor(score * streakMultiplier);
  score += streakBonus;

  return Math.max(0, Math.floor(score));
}

export function getProgressToNextRank(score: bigint | number): {
  currentRank: RankTier;
  nextRank: RankTier | null;
  currentProgress: number;
  damageToNextRank: number;
  progressPercent: number;
} {
  const numScore = typeof score === 'bigint' ? Number(score) : score;
  const currentRank = getRankByScore(numScore);
  const nextRankIndex = RANK_TIERS.findIndex(t => t.rank === currentRank.rank) + 1;
  const nextRank = nextRankIndex < RANK_TIERS.length ? RANK_TIERS[nextRankIndex] : null;

  if (!nextRank) {
    return {
      currentRank,
      nextRank: null,
      currentProgress: numScore,
      damageToNextRank: 0,
      progressPercent: 100
    };
  }

  const rangeSize = nextRank.minScore - currentRank.minScore;
  const progressInRange = numScore - currentRank.minScore;
  const damageToNextRank = nextRank.minScore - numScore;
  const progressPercent = (progressInRange / rangeSize) * 100;

  return {
    currentRank,
    nextRank,
    currentProgress: progressInRange,
    damageToNextRank: Math.max(0, damageToNextRank),
    progressPercent: Math.min(100, progressPercent)
  };
}

export function updateWinStreak(
  lastWin: boolean | null,
  currentWinStreak: number
): number {
  if (lastWin === true) {
    return currentWinStreak + 1;
  } else if (lastWin === false) {
    return 0;
  }
  return currentWinStreak;
}

/**
 * Calculate rank damage multiplier
 * Each rank adds 5% damage bonus (additive)
 * @param rank - The player's current military rank
 * @returns Damage multiplier (1.0 = no bonus, 1.75 = +75% for General)
 */
export function getRankDamageMultiplier(rank: MilitaryRank): number {
  const rankIndex = RANK_TIERS.findIndex(tier => tier.rank === rank);
  if (rankIndex === -1) return 1.0;

  // Rank 1 (Recruit) = 0% bonus, Rank 16 (General) = 75% bonus
  const bonusPercent = rankIndex * 0.05;
  return 1.0 + bonusPercent;
}

/**
 * Get rank number (1-16) from rank name
 */
export function getRankNumber(rank: MilitaryRank): number {
  const rankIndex = RANK_TIERS.findIndex(tier => tier.rank === rank);
  return rankIndex + 1; // Convert 0-indexed to 1-indexed
}

export const RANK_COLORS: Record<string, string> = {
  slate: 'bg-slate-500 text-white',
  zinc: 'bg-zinc-500 text-white',
  stone: 'bg-stone-500 text-white',
  amber: 'bg-amber-500 text-white',
  yellow: 'bg-yellow-500 text-white',
  orange: 'bg-orange-500 text-white',
  red: 'bg-red-500 text-white',
  rose: 'bg-rose-500 text-white',
  pink: 'bg-pink-500 text-white',
  fuchsia: 'bg-fuchsia-500 text-white',
  purple: 'bg-purple-500 text-white',
  violet: 'bg-violet-500 text-white',
  indigo: 'bg-indigo-500 text-white',
  blue: 'bg-blue-500 text-white',
  sky: 'bg-sky-500 text-white',
  cyan: 'bg-cyan-500 text-white'
};

export const RANK_BORDER_COLORS: Record<string, string> = {
  slate: 'border-slate-400 bg-slate-50 dark:bg-slate-900',
  zinc: 'border-zinc-400 bg-zinc-50 dark:bg-zinc-900',
  stone: 'border-stone-400 bg-stone-50 dark:bg-stone-900',
  amber: 'border-amber-400 bg-amber-50 dark:bg-amber-900',
  yellow: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900',
  orange: 'border-orange-400 bg-orange-50 dark:bg-orange-900',
  red: 'border-red-400 bg-red-50 dark:bg-red-900',
  rose: 'border-rose-400 bg-rose-50 dark:bg-rose-900',
  pink: 'border-pink-400 bg-pink-50 dark:bg-pink-900',
  fuchsia: 'border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900',
  purple: 'border-purple-400 bg-purple-50 dark:bg-purple-900',
  violet: 'border-violet-400 bg-violet-50 dark:bg-violet-900',
  indigo: 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900',
  blue: 'border-blue-400 bg-blue-50 dark:bg-blue-900',
  sky: 'border-sky-400 bg-sky-50 dark:bg-sky-900',
  cyan: 'border-cyan-400 bg-cyan-50 dark:bg-cyan-900'
};

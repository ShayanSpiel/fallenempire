'use client';

import type { ReactNode } from 'react';
import { RankDisplay } from '@/components/ui/rank-display';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { Progress } from '@/components/ui/progress';
import { Swords, Zap, Target, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/design-system';
import { getProgressToNextRank, calculateMilitaryRankScore } from '@/lib/military-ranks';

interface MilitaryServiceProps {
  rank: string;
  battlesFought: number;
  battlesWon: number;
  totalDamage: bigint | number;
  highestDamage: number;
  winStreak: number;
  strength?: number;
  battleHeroMedals?: number;
  focus: number;
  rage: number;
}

export function MilitaryService({
  rank,
  battlesFought,
  battlesWon,
  totalDamage,
  highestDamage,
  winStreak,
  strength = 0,
  battleHeroMedals = 0,
  focus = 50,
  rage = 0
}: MilitaryServiceProps) {
  const hitDamage = strength * 100;

  const formatNumber = (n: number | bigint) => {
    const num = typeof n === 'bigint' ? Number(n) : n;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  // Calculate rank progression
  const rankScore = calculateMilitaryRankScore(
    Number(totalDamage),
    battlesWon,
    battleHeroMedals,
    winStreak,
    battlesFought
  );
  const rankProgress = getProgressToNextRank(rankScore);
  const focusValue = Math.round(Math.max(0, Math.min(100, focus)));
  const rageValue = Math.round(Math.max(0, Math.min(100, rage)));
  const nextRankRequirement = rankProgress.nextRank?.minScore;

  return (
    <Card className="relative overflow-hidden bg-cover bg-center" style={{
      backgroundImage: 'url(https://i.ibb.co/7dXbNjC0/OR4EJM0.jpg)',
      backgroundAttachment: 'local',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/50"></div>

      <div className="space-y-6 relative z-10">
        <SectionHeading
          title="Military Service"
          icon={Zap}
          className="border-b border-white/20 dark:border-white/30 pb-3 mb-5 text-white dark:text-white/90 [&_span]:!text-white dark:[&_span]:!text-white/90"
        />

        {/* Rank Display */}
        <div className="flex items-center justify-center gap-6 bg-white/15 dark:bg-black/30 backdrop-blur-sm rounded-xl p-8 border border-white/20 dark:border-white/10">
          <RankDisplay rank={rank} size="lg" showLabel={true} />
          <div className="flex-1">
            <p className={cn(typography.bodySm.size, 'text-white/80 dark:text-white/60', 'mb-2')}>Current Rank</p>

            {/* Rank Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center gap-2 mb-1">
                <span className={cn(typography.label.size, 'text-white dark:text-white font-medium')}>{rankProgress.currentRank.rank}</span>
                <span className={cn(typography.label.size, 'text-white dark:text-white font-medium')}>
                  {rankProgress.nextRank ? rankProgress.nextRank.rank : 'Max'}
                </span>
              </div>
              <div className="relative">
                <Progress
                  value={rankProgress.progressPercent}
                  size="lg"
                  className="bg-white/20"
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.2) 100%)'
                  }}
                />
                <style>{`
                  [style*="bg-white/20"] > div {
                    background: linear-gradient(90deg, #d2b48c 0%, #556b2f 50%, #8b7355 100%) !important;
                  }
                `}</style>
              </div>
              <p className={cn(typography.meta.size, 'text-white/50 dark:text-white/40 text-center')}>
                {nextRankRequirement
                  ? `${formatNumber(totalDamage)}/${formatNumber(nextRankRequirement)} next rank`
                  : `${formatNumber(totalDamage)} / MAX`}
              </p>
            </div>
          </div>
        </div>

        {/* Battle Stats Grid - Hit/Rage focus */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Hit Damage"
            value={formatNumber(hitDamage)}
            icon={
              <Zap className="h-5 w-5 text-orange-200 dark:text-orange-300" />
            }
            bgClass="bg-orange-400/30 dark:bg-orange-500/20"
          />
          <StatCard
            label="Highest Single Battle"
            value={formatNumber(highestDamage)}
            icon={
              <Swords className="h-5 w-5 text-red-200 dark:text-red-300" />
            }
            bgClass="bg-red-400/30 dark:bg-red-500/20"
          />
          <StatCard
            label="Focus"
            value={`${focusValue}%`}
            icon={
              <Target className="h-5 w-5 text-sky-200 dark:text-sky-300" />
            }
            bgClass="bg-sky-500/30 dark:bg-sky-500/20"
          />
          <StatCard
            label="Rage"
            value={`${rageValue}%`}
            icon={
              <Flame className="h-5 w-5 text-amber-200 dark:text-orange-200" />
            }
            bgClass="bg-gradient-to-br from-amber-400/30 via-orange-500/30 to-red-500/30 dark:from-amber-500/20"
          />
        </div>
      </div>
    </Card>
  );
}

function StatCard({
  label,
  value,
  icon,
  bgClass,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  bgClass: string;
}) {
  return (
    <div className="p-4 bg-white/10 dark:bg-black/20 backdrop-blur-sm rounded-lg border border-white/15 dark:border-white/10">
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg", bgClass)}>
          {icon}
        </div>
        <div className="flex-1">
          <p className={cn(typography.label.size, 'text-white/60 dark:text-white/50', 'uppercase')}>{label}</p>
          <p className={cn(typography.displaySm.size, typography.displaySm.weight, 'text-white dark:text-white', 'mt-1')}>{value}</p>
        </div>
      </div>
    </div>
  );
}

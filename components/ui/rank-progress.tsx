import { getProgressToNextRank } from '@/lib/military-ranks';

interface RankProgressProps {
  score: bigint | number;
  className?: string;
  showLabel?: boolean;
  showStats?: boolean;
}

export function RankProgress({
  score,
  className = '',
  showLabel = true,
  showStats = false
}: RankProgressProps) {
  const progress = getProgressToNextRank(score);
  const formatNumber = (n: number) => n.toLocaleString();

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {progress.currentRank.rank}
            {progress.nextRank && ` → ${progress.nextRank.rank}`}
          </span>
          {showStats && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatNumber(progress.currentProgress)} / {formatNumber(
                progress.nextRank ? progress.nextRank.minScore - progress.currentRank.minScore : 0
              )}
            </span>
          )}
        </div>
      )}

      <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`
            h-full bg-gradient-to-r from-amber-400 to-rose-500
            transition-all duration-500 ease-out
            rounded-full
          `}
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>

      {showStats && progress.nextRank && (
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <strong>{formatNumber(progress.damageToNextRank)}</strong> damage needed for next rank
        </div>
      )}
    </div>
  );
}

import { getRankTier, RANK_COLORS, MilitaryRank } from '@/lib/military-ranks';

interface RankBadgeProps {
  rank: MilitaryRank | string;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
  className?: string;
}

export function RankBadge({
  rank,
  size = 'md',
  showDescription = false,
  className = ''
}: RankBadgeProps) {
  const rankTier = getRankTier(rank);

  if (!rankTier) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  const iconSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          ${RANK_COLORS[rankTier.color]}
          rounded-lg font-bold flex items-center gap-2
          transition-all duration-200 hover:shadow-lg
        `}
      >
        <span className={iconSizes[size]}>{rankTier.icon}</span>
        <span>{rankTier.rank}</span>
      </div>
      {showDescription && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {rankTier.description}
        </p>
      )}
    </div>
  );
}

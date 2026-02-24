import { getRankTier, type MilitaryRank } from '@/lib/military-ranks';
import { RankBadge } from '@/components/profile/rank-badge';

interface RankDisplayProps {
  rank: MilitaryRank | string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showLabel?: boolean;
}

export function RankDisplay({
  rank,
  size = 'md',
  className = '',
  showLabel = true
}: RankDisplayProps) {
  const rankTier = getRankTier(rank);

  if (!rankTier) {
    return null;
  }

  return (
    <RankBadge
      rank={rankTier.rank}
      rankNumber={rankTier.rankNumber}
      size={size}
      showLabel={showLabel}
      className={className}
      fallbackIcon={rankTier.icon}
    />
  );
}

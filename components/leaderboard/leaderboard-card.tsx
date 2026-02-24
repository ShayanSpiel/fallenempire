import Link from 'next/link';
import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { RankDisplay } from '@/components/ui/rank-display';
import { resolveAvatar } from '@/lib/avatar';
import { componentSpacing, leaderboardStyles, semanticColors, typography } from '@/lib/design-system';
import { cn } from '@/lib/utils';

interface LeaderboardCardProps {
  rank: number;
  username: string;
  avatarUrl: string | null;
  militaryRank: string;
  militaryScore: number;
  level?: number;
  totalXp?: number;
  mentalPower?: number;
  battlesFought?: number;
  battlesWon?: number;
  tabType: 'rank' | 'level' | 'mental';
}

const MEDAL_EMOJIS = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
} as const;

function LeaderboardCardComponent({
  rank,
  username,
  avatarUrl,
  militaryRank,
  militaryScore,
  level,
  totalXp,
  mentalPower,
  battlesFought,
  battlesWon,
  tabType
}: LeaderboardCardProps) {
  const medal = (MEDAL_EMOJIS as any)[rank] || null;

  return (
    <Link
      href={`/profile/${username}`}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-transparent p-3 text-card-foreground transition-all duration-200',
        'hover:border-border/50 hover:bg-accent/40'
      )}
    >
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
        {medal ? (
          <div className="text-lg">{medal}</div>
        ) : (
          <span className="text-xs font-bold text-muted-foreground">
            #{rank}
          </span>
        )}
      </div>

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <Avatar className={cn('w-10 h-10 rounded-lg border border-border/60 bg-background')}>
          <AvatarImage
            src={resolveAvatar({ avatarUrl, seed: username })}
            alt={username}
          />
          <AvatarFallback>{username?.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className={cn(typography.headingMd.size, typography.headingMd.weight, semanticColors.text.primary, "truncate")}>
            {username}
          </div>
          <div className={cn(typography.bodySm.size, semanticColors.text.secondary)}>
            {tabType === 'level'
              ? `${(totalXp || 0).toLocaleString()} XP`
              : battlesFought && battlesFought > 0
                ? `${battlesFought} battles • ${battlesWon || 0} wins`
                : 'No battles yet'}
          </div>
        </div>
      </div>

      {/* Stats */}
      {tabType === 'rank' && (
        <div className={cn('flex items-center', componentSpacing.gap.lg)}>
          <div className={cn('text-right flex flex-col items-end', componentSpacing.stack.xs)}>
            <div className={cn(typography.label.size, semanticColors.text.secondary)}>
              Rank Score
            </div>
            <div className={cn(typography.headingMd.size, typography.headingMd.weight, leaderboardStyles.card.rankValue)}>
              {(militaryScore || 0).toLocaleString()}
            </div>
          </div>
          <RankDisplay
            rank={militaryRank || 'Recruit'}
            size="sm"
            showLabel={false}
          />
        </div>
      )}

      {tabType === 'level' && (
        <div className={cn('text-right flex flex-col items-end min-w-[96px]', componentSpacing.stack.xs)}>
          <div className={cn(typography.label.size, semanticColors.text.secondary)}>
            Level
          </div>
          <div className={cn(typography.headingMd.size, typography.headingMd.weight, leaderboardStyles.card.levelValue)}>
            {level || 1}
          </div>
        </div>
      )}

      {tabType === 'mental' && (
        <div className={cn('text-right flex flex-col min-w-0 w-32', componentSpacing.stack.xs)}>
          <div className={cn('flex flex-col items-end', componentSpacing.stack.xs)}>
            <div className={cn(typography.label.size, semanticColors.text.secondary)}>
              Mental Power
            </div>
            <div className={cn(typography.headingMd.size, typography.headingMd.weight, leaderboardStyles.card.mentalValue)}>
              {(mentalPower || 0).toLocaleString()}
            </div>
          </div>
          <Progress
            value={Math.min(100, mentalPower || 0)}
            size="sm"
            color="success"
          />
        </div>
      )}
    </Link>
  );
}

export const LeaderboardCard = memo(LeaderboardCardComponent);

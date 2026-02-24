'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Crown, Medal, TrendingUp, Zap, Users } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LeaderboardCard } from '@/components/leaderboard/leaderboard-card';
import { PageSection } from '@/components/layout/page-section';
import { resolveAvatar } from '@/lib/avatar';
import { DATA_LIMITS, PAGINATION } from '@/lib/config/app-constants';
import { calculateMemberMorale, normalizePolarizationMetrics, type PolarizationMetrics } from '@/lib/ideology';
import { cn } from '@/lib/utils';
import { borders, componentSpacing, leaderboardStyles, semanticColors, typography } from '@/lib/design-system';

type LeaderboardEntry = {
  id: string;
  username: string;
  avatar_url: string | null;
  current_military_rank: string;
  military_rank_score: number;
  total_xp: number;
  current_level: number;
  battles_fought: number;
  battles_won: number;
  power_mental: number;
};

type CommunityRow = {
  id: string;
  slug: string | null;
  name: string;
  logo_url: string | null;
  power_mental: number | null;
  members_count: number | null;
  ideology_polarization_metrics: Partial<PolarizationMetrics> | null;
};

type CommunityLeaderboardEntry = {
  id: string;
  slug: string | null;
  name: string;
  logo_url: string | null;
  power_mental: number;
  members_count: number;
  moraleScore: number;
};

type TabType = 'rank' | 'level' | 'mental' | 'community';

type UserTabType = Exclude<TabType, 'community'>;

const TOTAL_RANKS_FETCHED = DATA_LIMITS.LEADERBOARD_ENTRIES;

const TAB_STYLES: Record<TabType, string> = {
  rank: leaderboardStyles.tabs.active.rank,
  level: leaderboardStyles.tabs.active.level,
  mental: leaderboardStyles.tabs.active.mental,
  community: leaderboardStyles.tabs.active.community,
};

const getMoralePercent = (moraleScore: number) => {
  const clamped = Math.max(-100, Math.min(100, moraleScore));
  return Math.round(((clamped + 100) / 2));
};

const USER_SKELETON_COUNT = 5;

const LEADERBOARD_SKELETON_STYLE: CSSProperties = { animationDuration: '2800ms' };

function UserLeaderboardSkeleton({ count = USER_SKELETON_COUNT }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`rank-skeleton-${index}`}
          className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/10 p-4 shadow-sm animate-pulse"
          style={LEADERBOARD_SKELETON_STYLE}
        >
          <div className="h-12 w-12 rounded-full bg-muted" />

          <div className="flex-1 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-[110px]">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommunityLeaderboardSkeleton({ count = USER_SKELETON_COUNT }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`community-skeleton-${index}`}
          className="flex items-center gap-4 rounded-lg border border-border/40 bg-muted/10 p-4 shadow-sm animate-pulse"
          style={LEADERBOARD_SKELETON_STYLE}
        >
          <div className="h-10 w-10 rounded-md bg-muted" />
          <div className="h-12 w-12 rounded-lg bg-muted" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
          <div className="flex flex-col items-end gap-2 min-w-[120px]">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-3 w-16 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const supabase = createSupabaseBrowserClient();
  const [activeTab, setActiveTab] = useState<TabType>('rank');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rankLeaderboard, setRankLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [levelLeaderboard, setLevelLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [mentalLeaderboard, setMentalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [communityLeaderboard, setCommunityLeaderboard] = useState<CommunityLeaderboardEntry[]>([]);

  const memoizedSupabase = useMemo(() => supabase, [supabase]);

  useEffect(() => {
    const fetchLeaderboards = async () => {
      try {
        setLoading(true);

        const selectFields =
          'id, username, avatar_url, current_military_rank, military_rank_score, total_xp, current_level, battles_fought, battles_won, power_mental';

        const { data: rankData } = await memoizedSupabase
          .from('users')
          .select(selectFields)
          .gt('military_rank_score', 0)
          .order('military_rank_score', { ascending: false })
          .limit(TOTAL_RANKS_FETCHED);

        const { data: levelData } = await memoizedSupabase
          .from('users')
          .select(selectFields)
          .gt('total_xp', 0)
          .order('total_xp', { ascending: false })
          .limit(TOTAL_RANKS_FETCHED);

        const { data: mentalData } = await memoizedSupabase
          .from('users')
          .select(selectFields)
          .gt('power_mental', 0)
          .order('power_mental', { ascending: false })
          .limit(TOTAL_RANKS_FETCHED);

        const { data: communityData } = await memoizedSupabase
          .from('communities')
          .select('id, slug, name, logo_url, power_mental, members_count, ideology_polarization_metrics')
          .limit(TOTAL_RANKS_FETCHED);

        const communityIds = communityData?.map((entry: any) => entry.id) ?? [];
        let religionCommunities = new Set<string>();

        if (communityIds.length) {
          const { data: religionData } = await memoizedSupabase
            .from('community_religions')
            .select('community_id')
            .in('community_id', communityIds);

          religionCommunities = new Set(religionData?.map((row: any) => row.community_id) ?? []);
        }

        const computedCommunityLeaderboard = (communityData as CommunityRow[] | null | undefined)
          ?.map((entry) => {
            const metrics = normalizePolarizationMetrics(entry.ideology_polarization_metrics);
            const moraleScore = calculateMemberMorale(
              metrics.diversity,
              0.7,
              metrics.overall,
              religionCommunities.has(entry.id)
            );

            return {
              id: entry.id,
              slug: entry.slug ?? null,
              name: entry.name,
              logo_url: entry.logo_url ?? null,
              power_mental: entry.power_mental ?? 0,
              members_count: entry.members_count ?? 0,
              moraleScore,
            };
          })
          .sort((a, b) => b.moraleScore - a.moraleScore) ?? [];

        if (rankData) setRankLeaderboard(rankData as LeaderboardEntry[]);
        if (levelData) setLevelLeaderboard(levelData as LeaderboardEntry[]);
        if (mentalData) setMentalLeaderboard(mentalData as LeaderboardEntry[]);
        setCommunityLeaderboard(computedCommunityLeaderboard);
      } catch (error) {
        console.error('Error fetching leaderboards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboards();
  }, [memoizedSupabase]);

  const currentLeaderboard = activeTab === 'rank'
    ? rankLeaderboard
    : activeTab === 'level'
      ? levelLeaderboard
      : mentalLeaderboard;

  const isCommunityTab = activeTab === 'community';
  const userTabType = (activeTab === 'community' ? 'rank' : activeTab) as UserTabType;
  const pageSize = PAGINATION.LEADERBOARD_PAGE_SIZE;
  const totalPages = Math.ceil(currentLeaderboard.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLeaderboard = currentLeaderboard.slice(startIndex, endIndex);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages || 1, prev + 1));
  };

  return (
    <div className={cn(semanticColors.background.primary, 'min-h-screen')}>
      <PageSection>
        <div className="space-y-8">
          {/* Header */}
          <div className={cn('flex flex-col', componentSpacing.stack.xl)}>
            <div className="flex items-center gap-4">
              <div className={cn(leaderboardStyles.header.iconBadge)}>
                <Crown className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className={cn(typography.displayLg.size, typography.displayLg.weight, semanticColors.text.primary)}>
                  Global Leaderboard
                </h1>
                <p className={cn(typography.bodyMd.size, semanticColors.text.secondary, 'mt-1')}>
                  Compete for glory across the realm
                </p>
              </div>
            </div>

            {/* Tab Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
              <Button
                onClick={() => handleTabChange('rank')}
                variant={activeTab === 'rank' ? 'default' : 'outline'}
                className={cn(
                  leaderboardStyles.tabs.base,
                  'w-full justify-center',
                  activeTab === 'rank'
                    ? TAB_STYLES.rank
                    : cn(borders.subtle, 'bg-transparent')
                )}
              >
                <Medal className="w-5 h-5" />
                Military Rank
              </Button>
              <Button
                onClick={() => handleTabChange('level')}
                variant={activeTab === 'level' ? 'default' : 'outline'}
                className={cn(
                  leaderboardStyles.tabs.base,
                  'w-full justify-center',
                  activeTab === 'level'
                    ? TAB_STYLES.level
                    : cn(borders.subtle, 'bg-transparent')
                )}
              >
                <TrendingUp className="w-5 h-5" />
                Character Level
              </Button>
              <Button
                onClick={() => handleTabChange('mental')}
                variant={activeTab === 'mental' ? 'default' : 'outline'}
                className={cn(
                  leaderboardStyles.tabs.base,
                  'w-full justify-center',
                  activeTab === 'mental'
                    ? TAB_STYLES.mental
                    : cn(borders.subtle, 'bg-transparent')
                )}
              >
                <Zap className="w-5 h-5" />
                Mental Power
              </Button>
              <Button
                onClick={() => handleTabChange('community')}
                variant={activeTab === 'community' ? 'default' : 'outline'}
                className={cn(
                  leaderboardStyles.tabs.base,
                  'w-full justify-center',
                  activeTab === 'community'
                    ? TAB_STYLES.community
                    : cn(borders.subtle, 'bg-transparent')
                )}
              >
                <Users className="w-5 h-5" />
                Community Morale
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Leaderboard List */}
            {loading ? (
              isCommunityTab ? (
                <CommunityLeaderboardSkeleton />
              ) : (
                <UserLeaderboardSkeleton />
              )
            ) : isCommunityTab ? (
              communityLeaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <div className={semanticColors.text.secondary}>No communities yet</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {communityLeaderboard.map((entry, index) => {
                    const moralePercent = getMoralePercent(entry.moraleScore);
                    const communityHref = entry.slug ? `/community/${entry.slug}` : null;
                    const cardContent = (
                      <div
                        className={cn(
                          'group flex items-center gap-3 rounded-lg border border-transparent p-3 text-card-foreground transition-all duration-200',
                          'hover:border-border/50 hover:bg-accent/40'
                        )}
                      >
                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                          {index < 3 ? (
                            <span className="text-lg">{['🥇', '🥈', '🥉'][index]}</span>
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">
                              #{index + 1}
                            </span>
                          )}
                        </div>

                        <Avatar className="w-10 h-10 rounded-lg border border-border/60 bg-background">
                          <AvatarImage
                            src={resolveAvatar({ avatarUrl: entry.logo_url, seed: entry.name })}
                            alt={entry.name}
                          />
                          <AvatarFallback>{entry.name?.charAt(0)}</AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className={cn(typography.headingMd.size, typography.headingMd.weight, semanticColors.text.primary, "truncate")}>
                            {entry.name}
                          </div>
                          <div className={cn(typography.bodySm.size, semanticColors.text.secondary)}>
                            {(entry.members_count ?? 0).toLocaleString()} members
                          </div>
                        </div>

                        <div className={cn('flex flex-col items-end min-w-[120px]', componentSpacing.stack.xs)}>
                          <div className={cn(typography.label.size, semanticColors.text.secondary)}>
                            Morale
                          </div>
                          <div className={cn(typography.headingMd.size, typography.headingMd.weight, leaderboardStyles.communityCard.moraleValue)}>
                            {moralePercent}%
                          </div>
                          <Progress value={moralePercent} size="sm" color="success" />
                        </div>
                      </div>
                    );

                    if (!communityHref) {
                      return (
                        <div key={entry.id}>
                          {cardContent}
                        </div>
                      );
                    }

                    return (
                      <Link key={entry.id} href={communityHref} className="block">
                        {cardContent}
                      </Link>
                    );
                  })}
                </div>
              )
            ) : currentLeaderboard.length === 0 ? (
              <div className="text-center py-12">
                <div className={semanticColors.text.secondary}>No entries yet</div>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedLeaderboard.map((entry, index) => (
                  <LeaderboardCard
                    key={entry.id}
                    rank={startIndex + index + 1}
                    username={entry.username}
                    avatarUrl={entry.avatar_url}
                    militaryRank={entry.current_military_rank || 'Recruit'}
                    militaryScore={entry.military_rank_score || 0}
                    level={entry.current_level || 1}
                    totalXp={entry.total_xp || 0}
                    mentalPower={entry.power_mental || 0}
                    battlesFought={entry.battles_fought || 0}
                    battlesWon={entry.battles_won || 0}
                    tabType={userTabType}
                  />
                ))}
              </div>
            )}

            {!loading && !isCommunityTab && currentLeaderboard.length > pageSize && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  variant="outline"
                  className={cn(borders.subtle, 'rounded-md')}
                >
                  Previous
                </Button>
                <div className={cn(typography.label.size, semanticColors.text.secondary)}>
                  Page {currentPage} of {Math.max(1, totalPages)}
                </div>
                <Button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  variant="outline"
                  className={cn(borders.subtle, 'rounded-md')}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </PageSection>
    </div>
  );
}

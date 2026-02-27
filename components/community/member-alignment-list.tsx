'use client'

/**
 * Member Alignment List Component
 *
 * Displays community members with ideology alignment scores.
 * Uses spectrum bars to show alignment vs community values.
 * Pagination: shows only first 5 members with "view all" option.
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DualSpectrumBar } from '@/components/ui/dual-spectrum-bar'
import { ChevronDown, Info, ChevronRight } from 'lucide-react'
import { cardStyles, typography } from '@/lib/design-system'
import { cn } from '@/lib/utils'
import { IDEOLOGY_ACCORDION_RADIUS_CLASS } from './ideology-style'
import { getMemberAlignment } from '@/app/actions/ideology'
import { UserAvatar } from '@/components/ui/user-avatar'
import { UserNameDisplay } from '@/components/ui/user-name-display'

/**
 * Member Alignment List Component - REDESIGNED
 *
 * Shows members with improved alignment visualization:
 * - Overall alignment % at top (green/yellow/red based on score)
 * - Expanded view: dual spectrum bars comparing member vs community on each axis
 * - Color-coded alignment based on proximity
 * - Pagination: first 5 members, "View All" button
 */

interface Member {
  user_id: string
  username: string | null
  avatar_url: string | null
  user_tier?: string | null
  rank_tier: number
  alignmentScore: number
  distance: number
  axisDetails?: Record<
    string,
    {
      memberValue: number
      communityValue: number
      difference: number
      aligned: boolean
    }
  >
}

interface MemberAlignmentListProps {
  communityId: string
  members: Member[]
  canViewDetails?: boolean
  totalCount?: number
  hasMore?: boolean
  onLoadMore?: () => void
}

const MEMBERS_PER_PAGE = 5
export function MemberAlignmentList({
  communityId,
  members,
  canViewDetails = true,
  totalCount,
  hasMore = false,
  onLoadMore,
}: MemberAlignmentListProps) {
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'alignment' | 'name' | 'rank'>('alignment')
  const [showAll, setShowAll] = useState(false)
  const [axisDetailsByUserId, setAxisDetailsByUserId] = useState<Record<string, Member['axisDetails']>>({})
  const [loadingAxisDetailsForUserId, setLoadingAxisDetailsForUserId] = useState<string | null>(null)

  const getRankLabel = (tier: number) => {
    if (tier === 0) return 'Sovereign'
    if (tier === 1) return 'Advisor'
    return 'Member'
  }

  const getRankColor = (tier: number) => {
    if (tier === 0) return 'bg-primary/20 text-primary'
    if (tier === 1) return 'bg-accent/20 text-accent'
    return 'bg-muted text-muted-foreground'
  }

  const getAlignmentLabel = (score: number) => {
    if (score >= 0.75) return 'Well Aligned'
    if (score >= 0.5) return 'Moderately Aligned'
    return 'Misaligned'
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (sortBy === 'alignment') return b.alignmentScore - a.alignmentScore
    if (sortBy === 'name') return (a.username ?? '').localeCompare(b.username ?? '')
    return a.rank_tier - b.rank_tier
  })

  const displayMembers = showAll ? sortedMembers : sortedMembers.slice(0, MEMBERS_PER_PAGE)
  const hasMoreLocally = sortedMembers.length > MEMBERS_PER_PAGE
  const loadedCount = members.length
  const resolvedTotalCount = totalCount ?? loadedCount

  const ensureAxisDetails = async (userId: string) => {
    const existing = axisDetailsByUserId[userId] ?? members.find((m) => m.user_id === userId)?.axisDetails
    if (existing) return

    setLoadingAxisDetailsForUserId(userId)
    try {
      const result = await getMemberAlignment(userId, communityId)
      setAxisDetailsByUserId((prev) => ({
        ...prev,
        [userId]: result.axisDetails as Member['axisDetails'],
      }))
    } catch {
      // Best-effort: keep UI usable even if details fail to load.
    } finally {
      setLoadingAxisDetailsForUserId((prev) => (prev === userId ? null : prev))
    }
  }

  const handleToggleMember = async (userId: string) => {
    if (!canViewDetails) return

    const nextExpanded = expandedMember === userId ? null : userId
    setExpandedMember(nextExpanded)

    if (nextExpanded) {
      await ensureAxisDetails(userId)
    }
  }

  return (
    <div className="space-y-4">
      {/* Sort Controls */}
      <div className="flex gap-2 flex-wrap">
        {(['alignment', 'name', 'rank'] as const).map(option => (
          <Button
            key={option}
            variant={sortBy === option ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSortBy(option)}
            className="capitalize text-xs font-medium"
          >
            {option === 'alignment' && 'Alignment'}
            {option === 'name' && 'Name'}
            {option === 'rank' && 'Rank'}
          </Button>
        ))}
      </div>

      {/* Member List */}
      <div className="space-y-3">
        {displayMembers.map(member => (
          <Card key={member.user_id} className={cn(cardStyles.subtle.base, IDEOLOGY_ACCORDION_RADIUS_CLASS)}>
            <button
              onClick={() => void handleToggleMember(member.user_id)}
              className="w-full text-left hover:bg-muted/20 transition-colors rounded-lg p-0 -m-3 p-3"
              type="button"
            >
              <div className="space-y-3">
                {/* Header Row - Avatar, Name, Rank, and Alignment */}
                <div className="flex items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <UserAvatar
                      username={member.username ?? 'Member'}
                      avatarUrl={member.avatar_url}
                      size="md"
                    />

                    <div className="min-w-0 flex-1">
                      <UserNameDisplay
                        username={member.username ?? 'Unknown'}
                        userTier={member.user_tier as "alpha" | "sigma" | "omega" | null}
                        showLink={false}
                        badgeSize="xs"
                        className="text-sm font-semibold truncate"
                      />
                      <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-medium mt-1', getRankColor(member.rank_tier))}>
                        {getRankLabel(member.rank_tier)}
                      </span>
                    </div>
                  </div>

                  {/* Overall alignment score on same line, right side */}
                  <div
                    className={cn(
                      'px-2 py-1 rounded-md text-xs font-bold whitespace-nowrap flex-shrink-0',
                      member.alignmentScore >= 0.7 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
                      member.alignmentScore >= 0.4 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' :
                      'bg-red-500/20 text-red-700 dark:text-red-400'
                    )}
                  >
                    {(member.alignmentScore * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Expand Button for Details */}
                {canViewDetails && (
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <ChevronDown
                      className={cn('w-4 h-4 transition-transform', expandedMember === member.user_id && 'rotate-180')}
                    />
                    {expandedMember === member.user_id ? 'Hide Details' : 'Compare Values'}
                  </div>
                )}
              </div>
            </button>

            {/* Expanded Details - For Detailed Analysis */}
            {expandedMember === member.user_id && canViewDetails && (
              <div className={cn('mt-4 pt-4 border-t border-border/40 space-y-4', IDEOLOGY_ACCORDION_RADIUS_CLASS)}>
                <h4 className={cn('text-xs', typography.label.weight, 'text-muted-foreground uppercase tracking-wider')}>
                  Value Axis Comparison
                </h4>

                <div className="space-y-5">
                  {(() => {
                    const axisDetails = member.axisDetails ?? axisDetailsByUserId[member.user_id]

                    if (!axisDetails) {
                      return (
                        <div className="text-xs text-muted-foreground">
                          {loadingAxisDetailsForUserId === member.user_id ? 'Loading details…' : 'Details unavailable.'}
                        </div>
                      )
                    }

                    return Object.entries(axisDetails).map(([axis, details]) => {
                      const { left_label, right_label } = getAxisLabels(axis)
                      const difference = Math.abs(details.memberValue - details.communityValue)
                      const alignmentForAxis = Math.max(0, 1 - difference / 2) // 0-1 scale

                      return (
                        <DualSpectrumBar
                          key={axis}
                          memberValue={details.memberValue}
                          communityValue={details.communityValue}
                          leftLabel={left_label}
                          rightLabel={right_label}
                          alignmentScore={alignmentForAxis}
                        />
                      )
                    })
                  })()}
                </div>

                <div className={cn('p-3 bg-muted/20 border border-border/40 flex gap-2', IDEOLOGY_ACCORDION_RADIUS_CLASS)}>
                  <Info className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                  <p className={cn('text-xs text-muted-foreground', typography.bodySm.weight)}>
                    Closer alignment on each axis means less friction. Misalignment is not inherently bad, but coherence matters—make sure your actions match your values.
                  </p>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Pagination - Show View All / Show Less */}
      {hasMoreLocally && (
        <Button variant="outline" className="w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? (
            <>
              Show Less <ChevronDown className="w-4 h-4 ml-2" />
            </>
          ) : (
            <>
              View {Math.min(sortedMembers.length, resolvedTotalCount)} Loaded Members <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      )}

      {hasMore && onLoadMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setShowAll(true)
            onLoadMore()
          }}
        >
          Load More ({loadedCount}/{resolvedTotalCount})
        </Button>
      )}

      {sortedMembers.length === 0 && (
        <Card className={cn(cardStyles.subtle.base, 'text-center py-8')}>
          <p className={cn('text-sm text-muted-foreground')}>No members in this community yet</p>
        </Card>
      )}
    </div>
  )
}

/**
 * Get axis labels for display
 */
function getAxisLabels(axis: string): { axis_map: string; left_label: string; right_label: string } {
  const axisLabels: Record<string, { axis_map: string; left_label: string; right_label: string }> = {
    order_chaos: {
      axis_map: 'Order ⟷ Chaos',
      left_label: 'Order',
      right_label: 'Chaos',
    },
    self_community: {
      axis_map: 'Individual ⟷ Collective',
      left_label: 'Individual',
      right_label: 'Collective',
    },
    logic_emotion: {
      axis_map: 'Logic ⟷ Emotion',
      left_label: 'Logic',
      right_label: 'Emotion',
    },
    power_harmony: {
      axis_map: 'Power ⟷ Harmony',
      left_label: 'Power',
      right_label: 'Harmony',
    },
    tradition_innovation: {
      axis_map: 'Tradition ⟷ Innovation',
      left_label: 'Tradition',
      right_label: 'Innovation',
    },
  }
  return axisLabels[axis] || { axis_map: axis.replace(/_/g, ' '), left_label: '←', right_label: '→' }
}

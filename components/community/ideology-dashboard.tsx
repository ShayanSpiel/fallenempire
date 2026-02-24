'use client'

/**
 * Ideology Dashboard Component
 *
 * Displays community ideology, religion, and member alignment.
 * Reorganized for better UX: description first, then charts, then religion.
 */

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { MoraleBar } from '@/components/ui/morale-bar'
import { IdeologyRadar } from './ideology-radar'
import { IdeologyLabels } from './ideology-labels'
import { PolarizationIndicator } from './polarization-indicator'
import { ReligionCard } from './religion-card'
import { MemberAlignmentList } from './member-alignment-list'
import { IDEOLOGY_CARD_RADIUS_CLASS, IDEOLOGY_PANEL_RADIUS_CLASS } from './ideology-style'
import {
  recalculateIdeology,
  regenerateReligion,
} from '@/app/actions/ideology'
import { calculateMemberMorale } from '@/lib/ideology'
import { Wand2, RotateCw, AlertCircle, Sparkles, Brain } from 'lucide-react'
import { cardStyles, typography, borders } from '@/lib/design-system'
import { cn } from '@/lib/utils'
import { debug } from '@/lib/logger'
import {
  useCommunityIdeology,
  useCommunityMemberAlignments,
  type IdeologySnapshot,
  type CommunityMemberAlignment,
} from '@/lib/hooks/useIdeology'

const LOG_MODULE = 'IdeologyDashboard'

interface IdeologyDashboardProps {
  communityId: string
  communityName: string
  governanceType?: string
  isSovereign?: boolean
  initialIdeology?: IdeologySnapshot | null
}

export function IdeologyDashboard({
  communityId,
  communityName,
  governanceType = 'monarchy',
  isSovereign = false,
  initialIdeology,
}: IdeologyDashboardProps) {
  const {
    ideology,
    isLoading: isIdeologyLoading,
    error: ideologyError,
    mutate: mutateIdeology,
  } = useCommunityIdeology(communityId, { fallbackData: initialIdeology ?? undefined })

  const [alignmentsEnabled, setAlignmentsEnabled] = useState(false)
  const [alignmentsLimit, setAlignmentsLimit] = useState(10)

  const {
    alignments: memberAlignments,
    isLoading: isAlignmentsLoading,
    error: alignmentsError,
    mutate: mutateAlignments,
    hasMore: hasMoreAlignments,
    totalCount: alignmentsTotalCount,
  } = useCommunityMemberAlignments(communityId, {
    enabled: alignmentsEnabled,
    limit: alignmentsLimit,
    includeAxisDetails: false,
  })

  const [actionLoading, setActionLoading] = useState<'recalculate' | 'regenerate' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchErrorMessage = ideologyError?.message ?? alignmentsError?.message ?? null
  // Only show loading if we don't have initial data
  const isFetching = (isIdeologyLoading && !initialIdeology) || (alignmentsEnabled && isAlignmentsLoading)
  const displayErrorMessage = actionError ?? fetchErrorMessage

  useEffect(() => {
    if (fetchErrorMessage) {
      debug(LOG_MODULE, 'Failed to load ideology data', { error: fetchErrorMessage })
    }
  }, [fetchErrorMessage])

  const handleRecalculate = async () => {
    if (!isSovereign) return

    setActionLoading('recalculate')
    setActionError(null)

    try {
      const result = await recalculateIdeology(communityId)

      // Update local state
      mutateIdeology((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          ideology_json: result.newIdeology,
          interpretation: result.interpretation,
          polarization_metrics: result.polarization,
          last_ideology_update: new Date(),
        }
      }, false)
      if (alignmentsEnabled) {
        await mutateAlignments()
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to recalculate ideology')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRegenerateReligion = async () => {
    if (!isSovereign) return

    setActionLoading('regenerate')
    setActionError(null)

    try {
      const result = await regenerateReligion(communityId)

      // Update local state
      mutateIdeology((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          religion: result.religion,
        }
      }, false)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to regenerate religion')
    } finally {
      setActionLoading(null)
    }
  }

  if (!ideology && displayErrorMessage) {
    return (
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <h3 className={cn(typography.headingMd.weight, 'text-destructive')}>Failed to Load Ideology</h3>
            <p className={cn('text-sm mt-1 text-muted-foreground')}>{displayErrorMessage}</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {displayErrorMessage && ideology && (
        <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
          <CardContent className="text-sm text-destructive">
            {displayErrorMessage}
          </CardContent>
        </Card>
      )}
      {/* 1. IDEOLOGY SUMMARY & DESCRIPTION - AT THE TOP */}
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <CardContent className="space-y-4">
          <SectionHeading
            title="Ideology Analysis"
            icon={Brain}
            tooltip="How your community thinks and acts"
            actions={
              isSovereign && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRecalculate}
                  disabled={actionLoading === 'recalculate' || isFetching}
                >
                  <RotateCw className={cn('w-4 h-4 mr-2', actionLoading === 'recalculate' && 'animate-spin')} />
                  {actionLoading === 'recalculate' ? 'Recalculating...' : 'Recalculate'}
                </Button>
              )
            }
          />

          {isFetching ? (
              <div className="space-y-3">
                <div className={cn('h-20 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
                <div className={cn('h-12 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
              </div>
          ) : ideology ? (
            <div className="space-y-4">
              {/* Ideology interpretation narrative */}
              <div className={cn('space-y-3 p-4 bg-muted/20 border', borders.muted, IDEOLOGY_PANEL_RADIUS_CLASS)}>
                <p className={cn('text-sm leading-relaxed text-foreground')}>
                  Your community has developed a distinctive ideology shaped by its core values and beliefs.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 text-xs text-muted-foreground">
                  <span>• Governance: {ideology.interpretation?.governance_style}</span>
                  <span>• Economy: {ideology.interpretation?.economic_system}</span>
                  <span>• Culture: {ideology.interpretation?.cultural_values}</span>
                </div>
              </div>

              {/* Character Traits */}
              <div>
                <h3 className={cn('text-xs', typography.label.weight, 'text-muted-foreground uppercase tracking-wider mb-3')}>
                  Core Character
                </h3>
                <IdeologyLabels
                  ideology_json={ideology.ideology_json}
                  interpretation={ideology.interpretation}
                  governanceType={governanceType}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 2. COMMUNITY MORALE - NEW */}
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <CardContent className="space-y-4">
          <SectionHeading
            title="Community Morale"
            icon={Sparkles}
            tooltip="Overall happiness and satisfaction levels"
          />

          {isFetching ? (
            <div className={cn('h-16 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
          ) : ideology ? (
            <div className="space-y-4">
              <MoraleBar
                morale={calculateMemberMorale(
                  ideology.polarization_metrics.diversity,
                  0.7,
                  ideology.polarization_metrics.overall,
                  !!ideology.religion
                )}
                showLabel={true}
                showTooltip={true}
                compact={false}
              />
              <p className={cn('text-xs text-muted-foreground', typography.bodySm.weight)}>
                Community morale reflects alignment with ideology, action coherence, and spiritual satisfaction through religion.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 3. COMMUNITY UNITY - PROMINENCE WITH SPECTRUM BAR */}
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <CardContent className="space-y-4">
          <SectionHeading
            title="Community Unity"
            icon={Sparkles}
            tooltip="How aligned members are on core values"
          />

          {isFetching ? (
            <div className={cn('h-32 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
          ) : ideology ? (
            <div className="space-y-4">
              <PolarizationIndicator metrics={ideology.polarization_metrics} showDetails={true} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 4. IDEOLOGY PROFILE CHART - MOVED DOWN */}
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <CardContent className="space-y-4">
          <SectionHeading
            title="Ideology Profile"
            icon={Sparkles}
            tooltip="Your community's position across 5 value axes"
          />

          {isFetching ? (
            <div className={cn('h-64 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
          ) : ideology ? (
            <IdeologyRadar ideology={ideology.ideology_json} variant="compact" height={280} />
          ) : null}
        </CardContent>
      </Card>

      {/* 5. COMMUNITY RELIGION - WITH GENERATION AT TOP */}
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <CardContent className="space-y-4">
          <SectionHeading
            title="Community Religion"
            icon={Wand2}
            tooltip="Faith that emerged from ideology"
            actions={
              isSovereign && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerateReligion}
                  disabled={actionLoading === 'regenerate' || isFetching}
                >
                  <Wand2 className={cn('w-4 h-4 mr-2', actionLoading === 'regenerate' && 'animate-spin')} />
                  {actionLoading === 'regenerate' ? 'Generating...' : 'Regenerate'}
                </Button>
              )
            }
          />

          {isFetching ? (
            <div className="space-y-3">
              <div className={cn('h-24 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
              <div className={cn('h-16 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
            </div>
          ) : ideology?.religion ? (
            <ReligionCard
              religion={ideology.religion}
              isSovereign={isSovereign}
              onRegenerate={handleRegenerateReligion}
              isLoading={actionLoading === 'regenerate'}
            />
          ) : (
            <div className={cn('p-4 bg-muted/20 border text-center', borders.muted, IDEOLOGY_PANEL_RADIUS_CLASS)}>
              <p className={cn('text-sm text-muted-foreground mb-3')}>
                A religion emerges once your community develops a unique ideology. Keep developing your values!
              </p>
              {isSovereign && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerateReligion}
                  disabled={actionLoading === 'regenerate' || isFetching}
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {actionLoading === 'regenerate' ? 'Generating...' : 'Generate Religion'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. MEMBER ALIGNMENT - WITH INNOVATIVE VISUALIZATION */}
      <Card className={cn(cardStyles.default.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
        <CardContent className="space-y-4">
          <SectionHeading
            title="Member Alignment"
            tooltip={
              !alignmentsEnabled
                ? 'Load on demand'
                : isAlignmentsLoading
                  ? 'Loading members...'
                  : `${Math.min(memberAlignments.length, alignmentsTotalCount)} of ${alignmentsTotalCount} members`
            }
            actions={
              !alignmentsEnabled ? (
                <Button size="sm" variant="outline" onClick={() => setAlignmentsEnabled(true)}>
                  Load
                </Button>
              ) : null
            }
          />

          {!alignmentsEnabled ? (
            <p className={cn('text-sm text-muted-foreground')}>
              Load member alignment on demand to reduce server load.
            </p>
          ) : isFetching ? (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={cn('h-16 bg-muted/40 animate-pulse', IDEOLOGY_PANEL_RADIUS_CLASS)} />
                ))}
            </div>
          ) : memberAlignments.length > 0 ? (
            <MemberAlignmentList
              communityId={communityId}
              members={memberAlignments as any}
              canViewDetails={true}
              totalCount={alignmentsTotalCount}
              hasMore={hasMoreAlignments}
              onLoadMore={() => setAlignmentsLimit((prev) => prev + 10)}
            />
          ) : (
            <p className={cn('text-sm text-muted-foreground')}>No members to display</p>
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      {ideology && (
        <p className={cn('text-xs', typography.meta.weight, 'text-muted-foreground text-right')}>
          Last updated: {new Date(ideology.last_ideology_update).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

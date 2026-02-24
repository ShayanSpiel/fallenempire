'use client'

/**
 * Dual Spectrum Bar Component
 *
 * Shows two indicators on the same spectrum (-1 to +1):
 * - Member indicator: silver gradient circle (M)
 * - Community indicator: golden gradient circle (C)
 *
 * Color indicates alignment (how close they are):
 * - Green: close together (well aligned)
 * - Yellow: moderate distance (moderately aligned)
 * - Red: far apart (misaligned)
 */

import { cn } from '@/lib/utils'
import { BarContainer, BarBackground, BarHandle, BarCenterLine } from './bar-container'

interface DualSpectrumBarProps {
  memberValue: number // -1 to +1
  communityValue: number // -1 to +1
  leftLabel: string // What left extreme represents
  rightLabel: string // What right extreme represents
  alignmentScore: number // 0-1, how aligned they are
}

/**
 * Convert -1 to +1 value to 0-100 percentage for display
 */
function valueToPercent(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return ((clamped + 1) / 2) * 100
}

/**
 * Calculate actual alignment based on distance between values
 * Closer values = higher alignment
 */
function calculateAlignment(memberValue: number, communityValue: number): number {
  const distance = Math.abs(memberValue - communityValue)
  return Math.max(0, 1 - distance / 2) // Normalize to 0-1 scale
}

/**
 * Get alignment color based on distance between member and community values
 */
function getAlignmentColor(memberValue: number, communityValue: number): string {
  const alignment = calculateAlignment(memberValue, communityValue)
  if (alignment >= 0.7) return 'from-emerald-500/70 to-emerald-600/70'
  if (alignment >= 0.4) return 'from-amber-500/70 to-amber-600/70'
  return 'from-red-500/70 to-red-600/70'
}

/**
 * Get semantic alignment label
 */
function getAlignmentLabel(score: number): string {
  if (score >= 0.75) return 'Well Aligned'
  if (score >= 0.6) return 'Aligned'
  if (score >= 0.4) return 'Moderately Aligned'
  return 'Misaligned'
}

export function DualSpectrumBar({
  memberValue,
  communityValue,
  leftLabel,
  rightLabel,
  alignmentScore,
}: DualSpectrumBarProps) {
  const memberPercent = valueToPercent(memberValue)
  const communityPercent = valueToPercent(communityValue)
  const alignmentLabel = getAlignmentLabel(alignmentScore)
  const alignmentColor = getAlignmentColor(memberValue, communityValue)

  // Determine label positioning to avoid overlap
  const indicatorDistance = Math.abs(memberPercent - communityPercent)
  const labelsOverlap = indicatorDistance < 12
  const communityOnTop = labelsOverlap

  return (
    <div className="space-y-2">
      {/* Header with alignment score and axis labels */}
      <div className="flex items-center justify-between gap-3">
        {/* Left label */}
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex-shrink-0">
          {leftLabel}
        </span>

        {/* Center alignment percentage */}
        <div className="flex-1 flex justify-center">
          <div
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap',
              alignmentScore >= 0.7 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
              alignmentScore >= 0.4 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' :
              'bg-red-500/20 text-red-700 dark:text-red-400'
            )}
          >
            {(alignmentScore * 100).toFixed(0)}% {alignmentLabel}
          </div>
        </div>

        {/* Right label */}
        <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider flex-shrink-0">
          {rightLabel}
        </span>
      </div>

      {/* Bar container with unified styling */}
      <BarContainer>
        {/* Background bar with dynamic alignment color gradient - using BarBackground */}
        <BarBackground backgroundColor="" className={`bg-gradient-to-r ${alignmentColor}`}>
          <BarCenterLine />
        </BarBackground>

        {/* Member indicator (M) - silver circle */}
        <BarHandle position={memberPercent} size="md" zIndex={communityOnTop ? 5 : 10}>
          <span className="text-xs font-bold text-gray-700 dark:text-white drop-shadow-sm leading-none">
            M
          </span>
        </BarHandle>

        {/* Community indicator (C) - golden circle */}
        <BarHandle
          position={communityPercent}
          size="md"
          zIndex={communityOnTop ? 20 : 5}
          handleClassName="bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 dark:from-amber-400 dark:via-amber-500 dark:to-amber-600 ring-1 ring-amber-500/50 dark:ring-amber-600/50"
        >
          <span className="text-xs font-bold text-gray-700 dark:text-white drop-shadow-sm leading-none">
            C
          </span>
        </BarHandle>
      </BarContainer>
    </div>
  )
}

'use client'

/**
 * Morale Bar Component
 *
 * Horizontal bar showing morale with emoji indicator.
 * Morale ranges from -100 to +100, with 0 being neutral.
 * Uses emoji progression: 😡 (angry) → 😞 (sad) → 😐 (neutral) → 😊 (happy) → 🤩 (excited)
 * Colors match the spectrum: red → amber → green
 */

import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { BarContainer, BarBackground, BarCenterLine, BarHandle } from './bar-container'
import type { ReactNode } from 'react'

interface MoraleBarProps {
  morale: number // -100 to +100
  showLabel?: boolean
  showTooltip?: boolean
  compact?: boolean
  showSpectrumLabels?: boolean
  barContainerClassName?: string
  label?: ReactNode
  tooltipText?: string
}

/**
 * Convert -100 to +100 morale to 0-100 percentage for display
 */
function moraleToPercent(morale: number): number {
  const clamped = Math.max(-100, Math.min(100, morale))
  return ((clamped + 100) / 200) * 100
}

/**
 * Normalize morale from -100 to 100 range into 0 to 100 range for color calculation
 */
function normalizedMorale(morale: number): number {
  return moraleToPercent(morale)
}

/**
 * Get morale color based on value using the same spectrum as morale-avatar-ring
 * Red (angry) → Amber (sad/content) → Green (happy/excited)
 */
function getMoraleColor(morale: number): string {
  const normalized = normalizedMorale(morale)

  if (normalized <= 20) {
    // Red spectrum - bright red
    return `hsl(0, 100%, ${55 - (20 - normalized) * 0.5}%)`
  } else if (normalized <= 50) {
    // Red to Golden Amber transition
    const progress = (normalized - 20) / 30
    const hue = progress * 40
    const saturation = 100 - progress * 10
    const lightness = 45 + progress * 5
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  } else if (normalized <= 80) {
    // Golden Amber to Green transition
    const progress = (normalized - 50) / 30
    const hue = 40 + progress * 80
    const saturation = 90 - progress * 30
    const lightness = 50 - progress * 5
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
  } else {
    // Deep vibrant green
    return `hsl(120, 70%, ${50 - (100 - normalized) * 0.3}%)`
  }
}

/**
 * Get morale emoji based on value
 */
function getMoraleEmoji(morale: number): string {
  const normalized = normalizedMorale(morale)
  if (normalized >= 80) return '🤩' // Excited
  if (normalized >= 60) return '😊' // Happy
  if (normalized >= 40) return '😐' // Neutral
  if (normalized >= 20) return '😞' // Sad
  return '😡' // Angry
}

/**
 * Get semantic morale label
 */
function getMoraleLabel(morale: number): string {
  const normalized = normalizedMorale(morale)
  if (normalized >= 80) return 'Ecstatic'
  if (normalized >= 60) return 'Happy'
  if (normalized >= 40) return 'Content'
  if (normalized >= 20) return 'Discouraged'
  return 'Rebellious'
}

/**
 * Get morale tooltip description
 */
function getMoraleTooltip(morale: number): string {
  const normalized = normalizedMorale(morale)
  if (normalized >= 80) return 'Members are extremely satisfied and motivated'
  if (normalized >= 60) return 'Members are satisfied and engaged'
  if (normalized >= 40) return 'Members are neutral, neither satisfied nor unhappy'
  if (normalized >= 20) return 'Members are dissatisfied and may be considering leaving'
  return 'Members are extremely unhappy and at high risk of leaving'
}

export function MoraleBar({
  morale,
  showLabel = true,
  showTooltip = true,
  compact = false,
  showSpectrumLabels = true,
  barContainerClassName,
  label = 'Morale',
  tooltipText,
}: MoraleBarProps) {
  const percent = moraleToPercent(morale)
  const moraleColor = getMoraleColor(morale)
  const moodEmoji = getMoraleEmoji(morale)
  const moraleLabel = getMoraleLabel(morale)
  const moraleTooltipText = tooltipText || getMoraleTooltip(morale)

  const labelSize = compact ? 'text-[11px]' : 'text-xs'
  const emojiSize = compact ? 'text-[12px]' : 'text-xl' // Match handle size (24px)
  const spectrumLabelSize = compact ? 'text-[10px]' : 'text-xs'
  const defaultBarContainerClass = compact ? 'h-6' : 'h-8'
  const barContainerClass = barContainerClassName ?? defaultBarContainerClass
  const barBackgroundClass = compact ? 'h-1.5' : 'h-3'
  const valueClass = compact
    ? cn('font-mono font-semibold', labelSize)
    : 'text-xl font-black tabular-nums'
  const labelClass = compact
    ? cn('font-semibold text-muted-foreground/70 uppercase tracking-wider', labelSize)
    : 'text-[12px] font-bold text-foreground/80'
  const labelContent = label ?? 'Morale'
  const headerSpacingClass = compact ? 'mb-2' : 'mb-3'

  return (
    <div className="w-full min-w-0">
      {showLabel && (
        <div className={cn("flex items-center justify-between", headerSpacingClass)}>
          <div className="flex items-center gap-1.5">
            <span className={labelClass}>{labelContent}</span>
            {showTooltip && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                      <Info size={compact ? 12 : 14} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs">
                    <p>{moraleTooltipText}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <span className={valueClass} style={{ color: moraleColor }}>
            {Math.round(percent)}%
          </span>
        </div>
      )}

      {/* Main morale bar with emoji indicator */}
      <BarContainer heightClassName={barContainerClass}>
        {/* Background bar with morale color */}
        <BarBackground backgroundColor={moraleColor} className={barBackgroundClass}>
          <BarCenterLine />
        </BarBackground>

        {/* Emoji indicator - perfectly centered using BarHandle */}
        <BarHandle
          position={percent}
          size={compact ? 'sm' : 'md'}
          handleClassName="bg-transparent shadow-none ring-0"
        >
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('cursor-help', emojiSize)}>{moodEmoji}</span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p className="font-semibold">{moraleLabel}</p>
                <p>{moraleTooltipText}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </BarHandle>
      </BarContainer>

      {/* Labels */}
      {showSpectrumLabels && (
        <div
          className={cn(
            'mt-2 flex justify-between font-medium text-muted-foreground/70 uppercase tracking-wider',
            spectrumLabelSize
          )}
        >
          <span>😡 Angry</span>
          <span>😐 Neutral</span>
          <span>😊 Happy</span>
        </div>
      )}
    </div>
  )
}

'use client'

/**
 * Spectrum Bar Component
 *
 * Shows a value on a spectrum from -1 to +1, with center being balanced.
 * Used for ideology traits and alignment scores.
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'
import { BarContainer, BarBackground, BarHandle, BarCenterLine } from './bar-container'

interface SpectrumBarProps {
  value: number // -1 to +1
  leftLabel: string // What the left side represents
  rightLabel: string // What the right side represents
  centerLabel?: string // What the center represents (balanced)
  showValue?: boolean
  showLabels?: boolean
  tooltip?: string
  size?: 'sm' | 'md' | 'lg'
  interactive?: boolean
}

/**
 * Convert -1 to +1 value to 0-100 percentage for display
 */
function valueToPercent(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value))
  return ((clamped + 1) / 2) * 100
}

/**
 * Determine how extreme a value is (0-1, where 1 is extreme)
 */
function getExtremism(value: number): number {
  return Math.abs(value)
}

/**
 * Get a descriptive label for extremism level
 */
function getExtremismLabel(value: number): string {
  const extremism = getExtremism(value)
  if (extremism < 0.2) return 'Very Balanced'
  if (extremism < 0.4) return 'Mostly Balanced'
  if (extremism < 0.6) return 'Leaning'
  if (extremism < 0.8) return 'Strong'
  return 'Extreme'
}

export function SpectrumBar({
  value,
  leftLabel,
  rightLabel,
  centerLabel = 'Balanced',
  showValue = false,
  showLabels = false,
  tooltip,
  size = 'md',
  interactive = false,
}: SpectrumBarProps) {
  const percent = valueToPercent(value)
  const extremism = getExtremism(value)
  const isBalanced = extremism < 0.3
  const label = getExtremismLabel(value)

  return (
    <div className="space-y-2">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(interactive && 'cursor-help')}>
              {/* Spectrum bar with left-right gradient */}
              <BarContainer>
                {/* Use BarBackground with gradient overlays */}
                <BarBackground>
                  {/* Left half - red to center (fills the h-2 bar) */}
                  <div className="absolute inset-0 left-0 right-1/2 bg-gradient-to-r from-destructive/40 via-warning/40 to-transparent" />

                  {/* Right half - green to center (fills the h-2 bar) */}
                  <div className="absolute inset-0 left-1/2 right-0 bg-gradient-to-l from-success/40 via-warning/40 to-transparent" />

                  <BarCenterLine />
                </BarBackground>

                {/* Value indicator handle - golden and smaller */}
                <BarHandle
                  position={percent}
                  size="sm"
                  handleClassName="bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 dark:from-amber-400 dark:via-amber-500 dark:to-amber-600 ring-1 ring-amber-500/50 dark:ring-amber-600/50"
                >
                  {isBalanced && (
                    <div className="absolute inset-0 border-2 border-amber-500/20 rounded-full animate-pulse" />
                  )}
                </BarHandle>
              </BarContainer>
            </div>
          </TooltipTrigger>
          {tooltip && (
            <TooltipContent className="text-xs max-w-xs">
              <p className="font-semibold mb-1">{label}</p>
              <p>{tooltip}</p>
              {!isBalanced && <p className="text-[11px] mt-1 text-muted-foreground">More {value > 0 ? rightLabel : leftLabel}</p>}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Labels */}
      {showLabels && (
        <div className="flex justify-between text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          <span>{leftLabel}</span>
          <span>{centerLabel}</span>
          <span>{rightLabel}</span>
        </div>
      )}

      {/* Value display */}
      {showValue && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono font-bold text-foreground">{value >= 0 ? '+' : ''}{value.toFixed(2)}</span>
        </div>
      )}
    </div>
  )
}

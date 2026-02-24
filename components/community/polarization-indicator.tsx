'use client'

/**
 * Polarization Indicator Component
 *
 * Shows community unity/harmony using an innovative wave visualization.
 * Combines frequency wave (shows harmony) with spectrum bar (shows consensus).
 * Diversity is shown as healthy when stable, problematic when chaotic.
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { HarmonyWaveChart } from './harmony-wave-chart'
import { PolarizationMetrics } from '@/lib/ideology'
import { Info } from 'lucide-react'
import { typography } from '@/lib/design-system'
import { cn } from '@/lib/utils'

interface PolarizationIndicatorProps {
  metrics: PolarizationMetrics
  showDetails?: boolean
}

export function PolarizationIndicator({ metrics, showDetails = false }: PolarizationIndicatorProps) {
  // Convert metrics to normalized 0-1 scales for the harmony wave chart
  const diversity = metrics.diversity // 0-1 scale
  const stability = 1 - (metrics.overall || 0) // Invert: low overall = high stability

  // Bar position (consensus) should reflect diversity position on spectrum:
  // Low diversity (0) = fragmented/divided (left)
  // High diversity (0.5-0.8) = diverse/harmonious (middle)
  // Low diversity with high stability = united (right)
  const consensus = diversity // Use diversity to position bar, showing perspective variety

  return (
    <div className="space-y-4">
      {/* Harmony Wave Chart - Main Visualization */}
      <HarmonyWaveChart
        diversity={diversity}
        stability={stability}
        consensus={consensus}
      />

      {showDetails && (
          <div className="pt-3 space-y-3 border-t border-border/40">
            {/* Contested Areas */}
            {metrics.polarizedAxes.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className={cn('text-xs', typography.label.weight, 'text-muted-foreground uppercase tracking-wider')}>
                    Points of Friction
                  </p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground/70 hover:text-foreground transition-colors">
                          <Info size={12} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-xs">
                        These are the value dimensions where your members disagree the most.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex flex-wrap gap-2">
                  {metrics.polarizedAxes.map(axis => (
                    <span key={axis} className="text-[10px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground border border-border/40">
                      {formatAxis(axis)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Diversity */}
            <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/40">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className={cn('text-xs', typography.label.weight, 'text-muted-foreground cursor-help uppercase tracking-wider')}>
                      Perspective Variety
                    </p>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    How diverse member viewpoints are across values. Higher = more varied perspectives.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className={cn('text-xs font-mono font-bold text-foreground')}>
                {(metrics.diversity * 100).toFixed(0)}%
              </span>
            </div>

            {/* Factions */}
            {metrics.clusters > 1 && (
              <div className="p-3 bg-muted/20 rounded-lg border border-border/40">
                <p className={cn(typography.label.weight, 'text-muted-foreground uppercase tracking-wider text-xs')}>
                  Ideological Groups: <span className={cn('text-foreground font-bold')}>{metrics.clusters}</span>
                </p>
              </div>
            )}
          </div>
        )}
    </div>
  )
}

/**
 * Format axis names for display
 */
function formatAxis(axis: string): string {
  const axisMap: Record<string, string> = {
    order_chaos: 'Order ⟷ Chaos',
    self_community: 'Individual ⟷ Collective',
    logic_emotion: 'Logic ⟷ Emotion',
    power_harmony: 'Power ⟷ Harmony',
    tradition_innovation: 'Tradition ⟷ Innovation',
  }
  return axisMap[axis] || axis.replace(/_/g, ' ')
}

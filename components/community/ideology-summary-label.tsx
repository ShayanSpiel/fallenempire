'use client'

/**
 * Ideology Summary Label Component
 *
 * Creates a 2-word ideology label with one simple sentence explanation
 * Designed to be instantly understandable by casual players
 */

import { Card } from '@/components/ui/card'
import type { IdeologyInterpretation, IdentityVector } from '@/lib/ideology'
import { cardStyles, typography } from '@/lib/design-system'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface IdeologySummaryLabelProps {
  ideology_json: IdentityVector
  interpretation: IdeologyInterpretation
}

export function IdeologySummaryLabel({ ideology_json, interpretation }: IdeologySummaryLabelProps) {
  const { label, description } = generateIdeologySummary(ideology_json, interpretation)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn(cardStyles.subtle.base, 'p-3')}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className={cn('text-xs text-muted-foreground tracking-wide uppercase', typography.label.weight)}>
                  Community Profile
                </p>
                <h3 className={cn('text-lg font-bold mt-1', typography.displaySm.weight)}>{label}</h3>
                <p className={cn('text-xs text-muted-foreground mt-2')}>{description}</p>
              </div>
              <div className="text-3xl flex-shrink-0">
                {getIdeologyEmoji(ideology_json)}
              </div>
            </div>
          </Card>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">Based on your community's 5 core value axes</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Generate a 2-word summary label and simple description
 * Designed to be immediately understandable
 */
function generateIdeologySummary(ideology: IdentityVector, interpretation: IdeologyInterpretation) {
  const order = ideology.order_chaos || 0
  const individual = ideology.self_community || 0
  const logic = ideology.logic_emotion || 0
  const power = ideology.power_harmony || 0
  const tradition = ideology.tradition_innovation || 0

  // Create a simple label based on dominant axes
  let label = ''
  let description = ''

  // Determine primary character
  if (power > 0.4) {
    label = 'Ambitious'
    description = 'Your community seeks to expand power and influence.'
  } else if (power < -0.4) {
    label = 'Peaceful'
    description = 'Your community values harmony and cooperation over dominance.'
  } else if (individual > 0.4) {
    label = 'Independent'
    description = 'Your community celebrates individual achievement and self-reliance.'
  } else if (individual < -0.4) {
    label = 'United'
    description = 'Your community prioritizes collective welfare and togetherness.'
  } else if (order > 0.4) {
    label = 'Structured'
    description = 'Your community values clear rules, hierarchy, and organization.'
  } else if (order < -0.4) {
    label = 'Spontaneous'
    description = 'Your community embraces flexibility, freedom, and improvisation.'
  } else if (tradition > 0.4) {
    label = 'Traditional'
    description = 'Your community honors heritage and proven ways of doing things.'
  } else if (tradition < -0.4) {
    label = 'Progressive'
    description = 'Your community embraces change, innovation, and new ideas.'
  } else if (logic > 0.4) {
    label = 'Rational'
    description = 'Your community makes decisions based on logic and reason.'
  } else if (logic < -0.4) {
    label = 'Passionate'
    description = 'Your community follows heart and intuition in its choices.'
  } else {
    label = 'Balanced'
    description = 'Your community maintains equilibrium across diverse values.'
  }

  // Add secondary trait
  let secondary = ''
  if (Math.abs(power) > 0.3 && individual > 0.3) {
    secondary = 'Competitive'
  } else if (order > 0.3 && tradition > 0.2) {
    secondary = 'Conservative'
  } else if (tradition < -0.3 && logic > 0.2) {
    secondary = 'Innovate'
  } else if (individual < -0.3 && logic < -0.2) {
    secondary = 'Intuitive'
  }

  if (secondary) {
    label += ` ${secondary}`
  }

  return { label, description }
}

/**
 * Get a simple emoji representing the ideology
 */
function getIdeologyEmoji(ideology: IdentityVector): string {
  const power = ideology.power_harmony || 0
  const individual = ideology.self_community || 0
  const order = ideology.order_chaos || 0

  if (power > 0.3) return '⚔️'
  if (power < -0.3) return '🕊️'
  if (individual > 0.3) return '🦁'
  if (individual < -0.3) return '🐝'
  if (order > 0.3) return '⚖️'
  if (order < -0.3) return '🌊'
  return '⚡'
}

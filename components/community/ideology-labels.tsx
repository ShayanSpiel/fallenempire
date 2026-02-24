'use client'

/**
 * Ideology Labels Display Component
 *
 * Shows four key characteristics of the community in a simple, digestible way.
 * Uses game-like narrative with user-friendly copywriting instead of raw numbers.
 */

import { Info } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { IdeologyInterpretation } from '@/lib/ideology'
import { getGovernanceLabel, getEconomyLabel, getCultureLabel, getDecisionLabel } from '@/lib/ideology-config'
import { cardStyles, typography } from '@/lib/design-system'
import { cn } from '@/lib/utils'
import { IDEOLOGY_CARD_RADIUS_CLASS } from './ideology-style'

interface IdeologyLabelsProps {
  ideology_json: any
  interpretation: IdeologyInterpretation
  governanceType?: string
  variant?: 'full' | 'compact'
}

/**
 * Generate user-friendly descriptions without showing raw numbers
 */
function generateUserFriendlyDescription(label: any, category: string): string {
  // Use the label's description, but make it more narrative
  switch (category) {
    case 'How You Govern':
      return label.description || 'Your community has its own way of making decisions and leading.'
    case 'How You Share':
      return label.description || 'Your community has developed its own approach to wealth and resources.'
    case 'What You Value':
      return label.description || 'Your community has established core principles that guide it.'
    case 'How You Decide':
      return label.description || 'Your community uses a unique blend of heart and mind.'
    default:
      return label.description || 'Your community has a distinctive trait.'
  }
}

export function IdeologyLabels({
  ideology_json,
  interpretation,
  governanceType = 'monarchy',
  variant = 'full',
}: IdeologyLabelsProps) {
  // Get detailed label objects with descriptions
  const governanceLabel = getGovernanceLabel(ideology_json.order_chaos, ideology_json.power_harmony, governanceType)
  const economyLabel = getEconomyLabel(ideology_json.self_community)
  const cultureLabel = getCultureLabel(ideology_json.tradition_innovation)
  const decisionLabel = getDecisionLabel(ideology_json.logic_emotion)

  const labels = [
    {
      category: 'How You Govern',
      label: governanceLabel,
      value: interpretation.governance_style,
      emoji: '⚖️',
      orderChaos: ideology_json.order_chaos ?? 0,
      powerHarmony: ideology_json.power_harmony ?? 0,
    },
    {
      category: 'How You Share',
      label: economyLabel,
      value: interpretation.economic_system,
      emoji: '💰',
      selfCommunity: ideology_json.self_community ?? 0,
    },
    {
      category: 'What You Value',
      label: cultureLabel,
      value: interpretation.cultural_values,
      emoji: '🎭',
      traditionInnovation: ideology_json.tradition_innovation ?? 0,
    },
    {
      category: 'How You Decide',
      label: decisionLabel,
      value: interpretation.decision_making,
      emoji: '🧠',
      logicEmotion: ideology_json.logic_emotion ?? 0,
    },
  ]

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap gap-2">
        {labels.map(item => (
          <TooltipProvider key={item.category}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="px-3 py-1.5 bg-muted/30 text-foreground rounded-md text-xs font-medium cursor-help hover:bg-muted/50 transition-colors border border-border/40">
                  {item.value}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold mb-2">{item.category}</p>
                <p className="text-xs text-muted-foreground">{generateUserFriendlyDescription(item.label, item.category)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {labels.map(item => (
        <Card key={item.category} className={cn(cardStyles.subtle.base, IDEOLOGY_CARD_RADIUS_CLASS)}>
          <div className="space-y-3">
            {/* Header with category and info icon */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-2xl flex-shrink-0 mt-0.5">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('text-xs text-muted-foreground', typography.label.weight, 'uppercase tracking-wider')}>
                      {item.category}
                    </p>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 flex-shrink-0"
                          >
                            <Info size={12} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          <p>Based on your community's values</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {/* Main value - highlighted */}
                  <p className={cn('text-sm font-bold text-foreground mt-1')}>{item.value}</p>
                </div>
              </div>
            </div>

            {/* User-friendly description without numbers */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {generateUserFriendlyDescription(item.label, item.category)}
            </p>

          </div>
        </Card>
      ))}
    </div>
  )
}

'use client'

/**
 * Community Religion Card Component
 *
 * Displays the faith system that emerged from the community's ideology.
 * Designed to match profile page aesthetic with layered information.
 */

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Wand2 } from 'lucide-react'
import type { CommunityReligion } from '@/lib/religion'
import { cardStyles, typography } from '@/lib/design-system'
import { cn } from '@/lib/utils'

interface ReligionCardProps {
  religion?: CommunityReligion | null
  isSovereign?: boolean
  onRegenerate?: () => void
  isLoading?: boolean
}

export function ReligionCard({ religion, isSovereign = false, onRegenerate, isLoading = false }: ReligionCardProps) {
  const [expanded, setExpanded] = useState(false)

  if (!religion) {
    return (
      <Card className={cn(cardStyles.subtle.base, 'border-dashed border-2 text-center py-8')}>
        <p className={cn('text-lg', typography.headingMd.weight, 'mb-2')}>
          No Religion Yet
        </p>
        <p className={cn('text-sm text-muted-foreground mb-4 max-w-sm mx-auto')}>
          A community religion emerges once your community develops a unique ideology. Keep growing!
        </p>
        {isSovereign && (
          <Button variant="outline" size="sm" disabled={isLoading} onClick={onRegenerate}>
            <Wand2 className="w-4 h-4 mr-2" />
            {isLoading ? 'Generating...' : 'Generate Religion'}
          </Button>
        )}
      </Card>
    )
  }

  return (
    <Card className={cardStyles.default.base}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 mb-2">
              <h3 className={cn('text-lg', typography.headingLg.weight)}>{religion.name}</h3>
              <span className="text-xl flex-shrink-0">⛪</span>
            </div>
            <p className={cn('text-xs text-muted-foreground')}>{religion.short_description}</p>
          </div>
          {isSovereign && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              onClick={onRegenerate}
              title="Regenerate religion if ideology has drifted"
              className="flex-shrink-0"
            >
              <Wand2 className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>

        {/* Core Tenets */}
        {religion.core_tenets.length > 0 && (
          <div className="pt-3 border-t border-border/40">
            <h4 className={cn('text-xs', typography.label.weight, 'text-muted-foreground uppercase tracking-wider mb-3')}>Core Beliefs</h4>
            <ul className="space-y-2">
              {religion.core_tenets.map((tenet, idx) => (
                <li key={idx} className={cn('text-sm text-muted-foreground flex items-start gap-3')}>
                  <span className="text-primary mt-0.5 flex-shrink-0">✦</span>
                  <span>{tenet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sacred Values + Forbidden (Side by Side) */}
        {(religion.sacred_values.length > 0 || religion.forbidden_actions.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Sacred Values */}
            {religion.sacred_values.length > 0 && (
              <div>
                <h4 className={cn('text-xs', typography.label.weight, 'text-muted-foreground uppercase mb-2')}>
                  Sacred Values
                </h4>
                <div className="flex flex-wrap gap-2">
                  {religion.sacred_values.map((value, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium',
                        'bg-success/20 text-success'
                      )}
                    >
                      ✓ {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Forbidden Actions */}
            {religion.forbidden_actions.length > 0 && (
              <div>
                <h4 className={cn('text-xs', typography.label.weight, 'text-muted-foreground uppercase mb-2')}>
                  Forbidden Actions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {religion.forbidden_actions.map((action, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium',
                        'bg-destructive/20 text-destructive'
                      )}
                    >
                      ✗ {action}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lore (Expandable) */}
        {religion.long_description && (
          <div className="pt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                'flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors'
              )}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? 'Hide Sacred Lore' : 'Show Sacred Lore'}
            </button>

            {expanded && (
              <div className={cn(cardStyles.subtle.base, 'mt-3 bg-muted/30')}>
                <div className="space-y-3">
                  {religion.long_description.split('\n\n').map((para, idx) => (
                    <p key={idx} className={cn('text-sm text-muted-foreground leading-relaxed')}>
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={cn('pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground')}>
          <span>Established {new Date(religion.created_at).toLocaleDateString()}</span>
          {religion.last_updated && (
            <span>Updated {new Date(religion.last_updated).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    </Card>
  )
}

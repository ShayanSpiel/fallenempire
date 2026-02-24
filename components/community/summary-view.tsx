'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gavel, Crown, Megaphone, Users, Bell, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SummaryEvent {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  category: 'proposal' | 'announcement' | 'community' | 'notification';
}

export interface SummaryProposal {
  id: string;
  lawType: string;
  label: string;
  createdAt: string;
  expiresAt: string | null;
  proposerName: string | null;
  status: string;
}

interface SummaryViewProps {
  activeProposals: SummaryProposal[];
  recentEvents: SummaryEvent[];
  generatedAt: string;
}

/**
 * Hybrid summary view: Major events as cards, minor events as timeline
 * Minimalist, clean, powerful design following app theme
 */
export const SummaryView: React.FC<SummaryViewProps> = ({
  activeProposals,
  recentEvents,
  generatedAt,
}) => {
  // Categorize events: major (proposals, role changes) vs minor (announcements, generic)
  const majorEvents = recentEvents.filter((e) => {
    const titleLower = e.title.toLowerCase();
    return (
      e.category === 'proposal' ||
      titleLower.includes('promoted') ||
      titleLower.includes('demoted') ||
      titleLower.includes('role') ||
      titleLower.includes('rebellion')
    );
  });

  const minorEvents = recentEvents.filter((e) => !majorEvents.includes(e));

  const hasContent = activeProposals.length > 0 || majorEvents.length > 0 || minorEvents.length > 0;

  if (!hasContent) {
    return (
      <div className="space-y-3 text-center py-4">
        <Inbox className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
        <div className="text-xs text-muted-foreground">All quiet in the last 24 hours</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Proposals Section */}
      {activeProposals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground px-1">Active Proposals</h3>
          <div className="space-y-2">
            {activeProposals.map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          </div>
        </div>
      )}

      {/* Major Events Section (Cards) */}
      {majorEvents.length > 0 && (
        <div className="space-y-2">
          {!activeProposals.length && (
            <h3 className="text-xs font-medium text-muted-foreground px-1">Recent Events</h3>
          )}
          <div className="space-y-2">
            {majorEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Minor Events Section (Timeline) */}
      {minorEvents.length > 0 && (
        <div className="space-y-2">
          {(activeProposals.length > 0 || majorEvents.length > 0) && (
            <h3 className="text-xs font-medium text-muted-foreground px-1">Timeline</h3>
          )}
          <div className="space-y-1 pl-3">
            {minorEvents.map((event) => (
              <TimelineEntry key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Generated timestamp */}
      <div className="text-[10px] text-muted-foreground pt-2 border-t border-border/20">
        Generated {formatRelativeTime(generatedAt)}
      </div>
    </div>
  );
};

/**
 * Card component for major events (proposals, role changes, rebellions)
 */
function ProposalCard({ proposal }: { proposal: SummaryProposal }) {
  const getStatusVariant = (status: string) => {
    if (status === 'pending') return 'warning';
    if (status === 'active') return 'accent';
    if (status === 'expired') return 'secondary';
    return 'default';
  };

  const isExpired = proposal.expiresAt && new Date(proposal.expiresAt) < new Date();

  return (
    <Card className="p-3 space-y-2 border-border/40" variant="compact">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Gavel className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{proposal.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {proposal.proposerName ? `by ${proposal.proposerName}` : 'by Unknown'} •{' '}
              {formatRelativeTime(proposal.createdAt)}
            </p>
          </div>
        </div>
        <Badge
          variant={isExpired ? 'secondary' : (getStatusVariant(proposal.status) as any)}
          className="flex-shrink-0"
        >
          {isExpired ? 'Expired' : proposal.status}
        </Badge>
      </div>
    </Card>
  );
}

/**
 * Card component for major events (role changes, rebellions)
 */
function EventCard({ event }: { event: SummaryEvent }) {
  const getIcon = (category: string): React.ReactNode => {
    if (category === 'announcement') return <Megaphone className="h-4 w-4" />;
    if (category === 'community') {
      const titleLower = event.title.toLowerCase();
      if (titleLower.includes('promoted') || titleLower.includes('demoted'))
        return <Crown className="h-4 w-4" />;
      if (titleLower.includes('rebellion') || titleLower.includes('conflict'))
        return <Users className="h-4 w-4" />;
      return <Bell className="h-4 w-4" />;
    }
    return <Bell className="h-4 w-4" />;
  };

  const getIconColor = (category: string) => {
    const titleLower = event.title.toLowerCase();
    if (titleLower.includes('rebellion') || titleLower.includes('conflict')) return 'text-destructive';
    if (titleLower.includes('promoted')) return 'text-success';
    if (titleLower.includes('demoted')) return 'text-warning';
    return 'text-accent';
  };

  return (
    <Card className="p-3 space-y-2 border-border/40" variant="compact">
      <div className="flex items-start gap-2">
        <div className={cn('h-4 w-4 mt-0.5 flex-shrink-0', getIconColor(event.category))}>
          {getIcon(event.category)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{event.title}</p>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(event.createdAt)}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Timeline entry for minor events
 */
function TimelineEntry({ event }: { event: SummaryEvent }) {
  return (
    <div className="text-xs flex items-start gap-2">
      <span className="text-muted-foreground">•</span>
      <div className="flex-1 min-w-0">
        <span className="text-foreground">{event.title}</span>
        <span className="text-muted-foreground ml-1">— {formatRelativeTime(event.createdAt)}</span>
      </div>
    </div>
  );
}

/**
 * Format timestamp to relative time (e.g., "2h ago", "just now")
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export { SummaryView as default };

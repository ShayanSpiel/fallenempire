"use client";

import Link from "next/link";
import { Globe, ArrowRight, Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getRelativeTime, NotificationType } from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

type WorldEvent = {
  id: string;
  title: string | null;
  type: string;
  created_at: string;
  action_url?: string | null;
  relative_time_label?: string | null;
  metadata?: Record<string, unknown> | null;
};

type WorldEventsSidebarProps = {
  events: WorldEvent[];
};

const getEventIcon = (type: NotificationType) => {
  switch (type) {
    case NotificationType.WAR_DECLARATION:
      return "⚔️";
    case NotificationType.LAW_PROPOSAL:
      return "📜";
    case NotificationType.HEIR_PROPOSAL:
      return "👑";
    case NotificationType.GOVERNANCE_CHANGE:
      return "⚙️";
    case NotificationType.ANNOUNCEMENT:
      return "📢";
    case NotificationType.KING_CHANGED:
      return "👑";
    case NotificationType.KING_LEFT:
      return "🏃";
    case NotificationType.REVOLUTION_STARTED:
    case NotificationType.CIVIL_WAR_STARTED:
      return "🔥";
    case NotificationType.BATTLE_STARTED:
      return "🛡️";
    case NotificationType.COMMUNITY_UPDATE:
      return "🏛️";
    default:
      return "🌍";
  }
};

const formatEventTitle = (event: WorldEvent): string => {
  // If it's a LAW_PROPOSAL with metadata, format it nicely
  if (event.type === NotificationType.LAW_PROPOSAL && event.metadata) {
    const lawType = event.metadata.law_type as string;
    const initiatorName = event.metadata.initiator_community_name as string | undefined;

    if (lawType === "CFC_ALLIANCE" && initiatorName) {
      return `CFC Alliance with ${initiatorName}`;
    }
    if (lawType === "DECLARE_WAR" && initiatorName) {
      return `War Declaration from ${initiatorName}`;
    }
  }

  return event.title || "Untitled Event";
};

export function WorldEventsSidebar({ events }: WorldEventsSidebarProps) {
  const recentEvents = events.slice(0, 5);

  return (
    <aside className="rounded-3xl border border-border/60 bg-card/90 p-6 backdrop-blur">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
          <Globe size={14} />
          World Events
        </h3>
      </div>

      <div className="space-y-2">
        {recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No recent world events
          </p>
        ) : (
          recentEvents.map((event) => (
            <Link
              key={event.id}
              href={event.action_url || "/notifications?tab=world"}
              className={cn(
                "block rounded-lg border border-border/40 bg-card/30 p-3",
                "hover:border-border hover:bg-card/60 transition-all duration-200"
              )}
            >
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 mt-0.5">{getEventIcon(event.type as NotificationType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-2">
                    {formatEventTitle(event)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {event.relative_time_label ?? getRelativeTime(event.created_at)}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border/60">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="w-full gap-2 text-xs font-semibold"
        >
          <Link href="/notifications?tab=world">
            All World Events
            <ArrowRight size={12} />
          </Link>
        </Button>
      </div>
    </aside>
  );
}

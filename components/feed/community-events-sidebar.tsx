"use client";

import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { resolveAvatar } from "@/lib/avatar";
import { getRelativeTime } from "@/lib/types/notifications";
import { cn } from "@/lib/utils";

type CommunityEvent = {
  id: string;
  title: string | null;
  created_at: string;
  community_id?: string | null;
  community?: {
    id: string;
    name: string;
    slug?: string | null;
  } | null;
};

type CommunityEventsSidebarProps = {
  events: CommunityEvent[];
};

export function CommunityEventsSidebar({ events }: CommunityEventsSidebarProps) {
  const recentEvents = events.slice(0, 5);

  return (
    <aside className="rounded-3xl border border-border/60 bg-card/90 p-6 backdrop-blur">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
          <Building2 size={14} />
          Community Events
        </h3>
      </div>

      <div className="space-y-2">
        {recentEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No recent community events
          </p>
        ) : (
          recentEvents.map((event) => (
            <Link
              key={event.id}
              href={
                event.community?.slug
                  ? `/community/${event.community.slug}`
                  : "/community"
              }
              className={cn(
                "block rounded-lg border border-border/40 bg-card/30 p-3",
                "hover:border-border hover:bg-card/60 transition-all duration-200"
              )}
            >
              <div className="flex items-start gap-2">
                {event.community && (
                  <Avatar className="h-6 w-6 rounded-lg border border-border/40 shrink-0">
                    <AvatarImage
                      src={resolveAvatar({ seed: event.community.name })}
                    />
                    <AvatarFallback className="text-[10px] font-bold">
                      {event.community.name[0]}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground line-clamp-2">
                    {event.title || "Untitled Event"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {getRelativeTime(event.created_at)}
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
          <Link href="/community">
            All Communities
            <ArrowRight size={12} />
          </Link>
        </Button>
      </div>
    </aside>
  );
}

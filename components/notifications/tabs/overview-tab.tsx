"use client";

import { FC } from "react";
import Link from "next/link";
import { MessageCircle, Globe, Users, Bell, Check } from "lucide-react";
import {
  NotificationCategory,
  NotificationUI,
  isWorldTabNotification,
} from "@/lib/types/notifications";
import { NotificationList } from "../notification-list";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface OverviewTabProps {
  allNotifications: NotificationUI[];
  counts: {
    total: number;
    messages: number;
    world: number;
    community: number;
  };
  loading?: boolean;
  onMarkAsRead?: (id: string) => void;
  onMarkManyAsRead?: (ids: string[]) => Promise<void> | void;
  onArchive?: (id: string) => void;
}

export const OverviewTab: FC<OverviewTabProps> = ({
  allNotifications,
  counts,
  loading = false,
  onMarkAsRead,
  onMarkManyAsRead,
  onArchive,
}) => {
  const worldNotifications = allNotifications.filter((n) =>
    isWorldTabNotification(n)
  );

  // Filter action-required notifications
  const actionRequired = allNotifications
    .filter(
      (n) =>
        n.isUnread &&
        (n.type.includes("proposal") ||
          n.type.includes("request") ||
          n.type.includes("message"))
    )
    .slice(0, 3);

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = allNotifications.filter((n) => n.isUnread);
      if (unreadNotifications.length === 0) return;

      const ids = unreadNotifications.map((n) => n.id);
      if (onMarkManyAsRead) {
        await onMarkManyAsRead(ids);
      } else if (onMarkAsRead) {
        await Promise.all(ids.map((id) => onMarkAsRead(id)));
      }
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const hasUnreadNotifications = allNotifications.some((n) => n.isUnread);

  return (
    <div className="space-y-4">
      {/* Header with Read All button */}
      <div className="p-3 px-4 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Today
        </span>
        {hasUnreadNotifications && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-accent hover:bg-accent/10"
          >
            <Check size={14} />
            <span>read all</span>
          </Button>
        )}
      </div>

      <div className="px-4 space-y-4">
      {/* Unread Counts Grid */}
      <div className="grid grid-cols-3 gap-2">
        <Link href="/notifications?tab=messages">
          <Card
            variant="compact"
            className="p-3 cursor-pointer hover:bg-accent/5 transition-colors"
          >
            <div className="flex flex-col gap-2">
              <MessageCircle
                size={20}
                className="opacity-60"
              />
              <div>
                <div className="text-lg font-semibold">
                  {counts.messages}
                </div>
                <div className="text-xs text-muted-foreground">Messages</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/notifications?tab=world">
          <Card
            variant="compact"
            className="p-3 cursor-pointer hover:bg-accent/5 transition-colors"
          >
            <div className="flex flex-col gap-2">
              <Globe
                size={20}
                className="opacity-60"
              />
              <div>
                <div className="text-lg font-semibold">
                  {counts.world}
                </div>
                <div className="text-xs text-muted-foreground">World Events</div>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/notifications?tab=community">
          <Card
            variant="compact"
            className="p-3 cursor-pointer hover:bg-accent/5 transition-colors"
          >
            <div className="flex flex-col gap-2">
              <Users
                size={20}
                className="opacity-60"
              />
              <div>
                <div className="text-lg font-semibold">
                  {counts.community}
                </div>
                <div className="text-xs text-muted-foreground">Community</div>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Divider */}
      <div
        className="h-px"
        style={{ backgroundColor: `var(--border)` }}
      />

      {/* Action Required Section */}
      {actionRequired.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Action Required
            </h4>
            <Link
              href="/notifications?tab=overview"
              className="text-xs text-accent hover:underline"
            >
              View All
            </Link>
          </div>
          <NotificationList
            notifications={actionRequired}
            onMarkAsRead={onMarkAsRead}
            onMarkManyAsRead={onMarkManyAsRead}
            onArchive={onArchive}
          />
        </div>
      )}

      {/* Recent World Section - Includes world events and social activity */}
      {worldNotifications.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent World
            </h4>
            <Link
              href="/notifications?tab=world"
              className="text-xs text-accent hover:underline"
            >
              View All
            </Link>
          </div>
          <NotificationList
            notifications={worldNotifications.slice(0, 3)}
            onMarkAsRead={onMarkAsRead}
            onMarkManyAsRead={onMarkManyAsRead}
            onArchive={onArchive}
            category={NotificationCategory.WORLD}
          />
        </div>
      )}

      {/* No notifications */}
      {allNotifications.length === 0 && !loading && (
        <div className="text-center py-8">
          <Bell
            size={24}
            className="mx-auto mb-2 opacity-30"
          />
          <p className="text-sm text-muted-foreground">
            You&apos;re all caught up!
          </p>
        </div>
      )}
      </div>
    </div>
  );
};

export default OverviewTab;

"use client";

import { FC, useCallback } from "react";
import { Check } from "lucide-react";
import { NotificationCategory, NotificationUI, groupNotificationsByDate } from "@/lib/types/notifications";
import { NotificationItem } from "./notification-item";
import { EmptyState } from "./empty-state";
import { SocialRequestActions } from "./notification-actions";
import { isSocialNotification } from "@/lib/types/notifications";
import { toast } from "sonner";

interface NotificationListProps {
  notifications: NotificationUI[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMarkAsRead?: (id: string) => void;
  onMarkManyAsRead?: (ids: string[]) => Promise<void> | void;
  onArchive?: (id: string) => void;
  isSearching?: boolean;
  category?: NotificationCategory;
}

export const NotificationList: FC<NotificationListProps> = ({
  notifications,
  loading = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onMarkManyAsRead,
  onArchive,
  isSearching = false,
  category,
}) => {
  // Group notifications by date
  const grouped = groupNotificationsByDate(notifications);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && onLoadMore) {
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

  const handleMarkGroupAsRead = useCallback(
    async (groupNotifications: NotificationUI[]) => {
      try {
        const unreadNotifications = groupNotifications.filter((n) => n.isUnread);
        if (unreadNotifications.length === 0) return;

        const ids = unreadNotifications.map((n) => n.id);
        if (onMarkManyAsRead) {
          await onMarkManyAsRead(ids);
        } else if (onMarkAsRead) {
          await Promise.all(ids.map((id) => onMarkAsRead(id)));
        }
        toast.success("Marked as read");
      } catch (error) {
        console.error("Error marking as read:", error);
        toast.error("Failed to mark as read");
      }
    },
    [onMarkManyAsRead, onMarkAsRead]
  );

  if (notifications.length === 0 && !loading) {
    return <EmptyState category={category} isSearching={isSearching} />;
  }

  return (
    <div className="flex flex-col">
      {/* Grouped Notifications */}
      {grouped.map((group) => (
        <div key={group.label} className="flex flex-col">
          {/* Date Group Label with Mark as Read */}
          <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 px-4 py-2 border-b flex items-center justify-between">
            <span
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              style={{ color: "var(--text-secondary)" }}
            >
              {group.label}
            </span>
            {group.notifications.some((n) => n.isUnread) && (
              <button
                onClick={() => handleMarkGroupAsRead(group.notifications)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-accent hover:bg-accent/10 transition-all duration-200 hover:scale-105"
                title="Mark all as read"
              >
                <Check size={14} />
                <span>read</span>
              </button>
            )}
          </div>

          {/* Notifications in Group */}
          {group.notifications.map((notification, index) => (
            <div
              key={notification.id}
              className={`border-b transition-colors ${
                index < group.notifications.length - 1
                  ? "border-dashed opacity-70"
                  : ""
              }`}
              style={
                index < group.notifications.length - 1
                  ? { borderColor: `var(--border)` }
                  : {}
              }
            >
              <NotificationItem
                notification={notification}
                onMarkAsRead={onMarkAsRead}
                onArchive={onArchive}
                actions={
                  isSocialNotification(notification) ? (
                    <SocialRequestActions
                      notification={notification}
                      onSuccess={() => {
                        onArchive?.(notification.id);
                      }}
                      variant="inline"
                    />
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>
      ))}

      {/* Load More Button */}
      {hasMore && (
        <div className="p-4 text-center border-t">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="text-sm font-medium text-accent hover:underline disabled:opacity-50 transition-opacity"
          >
            {loading ? "Loading..." : "Load more notifications"}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && notifications.length === 0 && (
        <div className="space-y-2 p-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-secondary rounded animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationList;

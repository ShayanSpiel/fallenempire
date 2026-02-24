"use client";

import { FC, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, Check, Archive, Bell } from "lucide-react";
import { toast } from "sonner";
import { PageSection } from "@/components/layout/page-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  componentSpacing,
  semanticColors,
  typography,
  borders,
  transitions,
  layout,
} from "@/lib/design-system";
import {
  NotificationCategory,
  NotificationUI,
  isWorldTabNotification,
} from "@/lib/types/notifications";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useNotificationCounts } from "@/lib/hooks/use-notifications";
import {
  markAllNotificationsAsRead,
  notificationCache,
} from "@/lib/services/notification-service";
import { OverviewTab } from "@/components/notifications/tabs/overview-tab";
import { MessagesTab } from "@/components/notifications/tabs/messages-tab";
import { WorldTab } from "@/components/notifications/tabs/world-tab";
import { CommunityTab } from "@/components/notifications/tabs/community-tab";

type PageTab = "overview" | "messages" | "world" | "community";
type ReadFilter = "all" | "unread" | "read";

// Skeleton loading component
const NotificationSkeleton = () => (
  <div className={cn("space-y-3 p-4", borders.faint, "border rounded-lg")}>
    <div className="flex gap-3">
      <div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
      </div>
    </div>
  </div>
);

const NotificationsPage: FC = () => {
  const searchParams = useSearchParams();

  // Get tab from URL or default to overview
  const rawTab = searchParams.get("tab");
  const tabFromUrl =
    rawTab === "social" ? "world" : ((rawTab as PageTab) || "overview");
  const [activeTab, setActiveTab] = useState<PageTab>(tabFromUrl);
  const [searchQuery, setSearchQuery] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");

  // Fetch notifications for each category
  const allNotifications = useNotifications({
    limit: 50,
    search: searchQuery || undefined,
    enabled: activeTab === "overview",
  });

  const messagesNotifications = useNotifications({
    category: NotificationCategory.MESSAGES,
    limit: 50,
    search: searchQuery || undefined,
    enabled: activeTab === "messages",
  });

  const worldNotifications = useNotifications({
    category: NotificationCategory.WORLD,
    limit: 50,
    search: searchQuery || undefined,
    enabled: activeTab === "world",
  });

  const communityNotifications = useNotifications({
    category: NotificationCategory.COMMUNITY,
    limit: 50,
    search: searchQuery || undefined,
    enabled: activeTab === "community",
  });

  const socialNotifications = useNotifications({
    category: NotificationCategory.SOCIAL,
    limit: 50,
    search: searchQuery || undefined,
    enabled: activeTab === "world",
  });

  // Fetch counts
  const { counts } = useNotificationCounts(true);

  const mergeAndFilterWorldNotifications = useCallback(
    (items: NotificationUI[]) => {
      const seen = new Set<string>();
      const ordered = items
        .filter((notification) => isWorldTabNotification(notification))
        .filter((notification) => {
          if (seen.has(notification.id)) return false;
          seen.add(notification.id);
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return ordered;
    },
    []
  );

  const currentNotifications = useMemo(() => {
    switch (activeTab) {
      case "messages":
        return messagesNotifications.notifications;
      case "world":
        return mergeAndFilterWorldNotifications([
          ...worldNotifications.notifications,
          ...socialNotifications.notifications,
        ]);
      case "community":
        return communityNotifications.notifications;
      default:
        return allNotifications.notifications;
    }
  }, [
    activeTab,
    allNotifications.notifications,
    messagesNotifications.notifications,
    worldNotifications.notifications,
    communityNotifications.notifications,
    socialNotifications.notifications,
    mergeAndFilterWorldNotifications,
  ]);

  // Filter by read status
  const filteredNotifications = useMemo(() => {
    if (readFilter === "unread") {
      return currentNotifications.filter((n) => n.isUnread);
    }
    if (readFilter === "read") {
      return currentNotifications.filter((n) => !n.isUnread);
    }
    return currentNotifications;
  }, [readFilter, currentNotifications]);

  // Get current handler functions
  const getCurrentHandlers = () => {
    switch (activeTab) {
      case "messages":
        return {
          markAsRead: messagesNotifications.markAsRead,
          markManyAsRead: messagesNotifications.markManyAsRead,
          archive: messagesNotifications.archive,
          loading: messagesNotifications.loading,
          hasMore: messagesNotifications.hasMore,
          loadMore: messagesNotifications.loadMore,
        };
      case "world":
        return {
          markAsRead: (notificationId: string) => {
            const isSocial = socialNotifications.notifications.some(
              (notification) => notification.id === notificationId
            );
            if (isSocial) {
              return socialNotifications.markAsRead(notificationId);
            }
            return worldNotifications.markAsRead(notificationId);
          },
          markManyAsRead: async (notificationIds: string[]) => {
            await Promise.all(
              notificationIds.map((id) => {
                const isSocial = socialNotifications.notifications.some(
                  (notification) => notification.id === id
                );
                if (isSocial) {
                  return socialNotifications.markAsRead(id);
                }
                return worldNotifications.markAsRead(id);
              })
            );
          },
          archive: (notificationId: string) => {
            const isSocial = socialNotifications.notifications.some(
              (notification) => notification.id === notificationId
            );
            if (isSocial) {
              return socialNotifications.archive(notificationId);
            }
            return worldNotifications.archive(notificationId);
          },
          loading: worldNotifications.loading || socialNotifications.loading,
          hasMore: worldNotifications.hasMore || socialNotifications.hasMore,
          loadMore: () => {
            if (worldNotifications.hasMore) worldNotifications.loadMore();
            if (socialNotifications.hasMore) socialNotifications.loadMore();
          },
        };
      case "community":
        return {
          markAsRead: communityNotifications.markAsRead,
          markManyAsRead: communityNotifications.markManyAsRead,
          archive: communityNotifications.archive,
          loading: communityNotifications.loading,
          hasMore: communityNotifications.hasMore,
          loadMore: communityNotifications.loadMore,
        };
      default:
        return {
          markAsRead: allNotifications.markAsRead,
          archive: allNotifications.archive,
          loading: allNotifications.loading,
          hasMore: allNotifications.hasMore,
          loadMore: allNotifications.loadMore,
        };
    }
  };

  const handlers = getCurrentHandlers();
  const getCurrentLoading = () => {
    switch (activeTab) {
      case "messages":
        return messagesNotifications.loading;
      case "world":
        return worldNotifications.loading;
      case "community":
        return communityNotifications.loading;
      default:
        return allNotifications.loading;
    }
  };

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      const allIds = allNotifications.notifications.map((n) => n.id);
      allNotifications.syncReadState(allIds);
      messagesNotifications.syncReadState(
        messagesNotifications.notifications.map((n) => n.id)
      );
      worldNotifications.syncReadState(
        worldNotifications.notifications.map((n) => n.id)
      );
      communityNotifications.syncReadState(
        communityNotifications.notifications.map((n) => n.id)
      );
      socialNotifications.syncReadState(
        socialNotifications.notifications.map((n) => n.id)
      );
      notificationCache.invalidate("counts");
      notificationCache.invalidate("notifications:");
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <div className={cn(semanticColors.background.primary, "min-h-screen")}>
      <PageSection>
        <div className={cn("space-y-6", componentSpacing.stack.xl)}>
          {/* Header */}
          <div className={cn("flex flex-col", componentSpacing.stack.md)}>
            <div className="flex items-center gap-4 mb-4">
              <div
                className={cn(
                  "p-3 rounded-lg",
                  "bg-gradient-to-br from-blue-500 to-cyan-500"
                )}
              >
                <Bell className={cn("w-8 h-8 text-white")} />
              </div>
              <div>
                <h1
                  className={cn(
                    typography.displayLg.size,
                    typography.displayLg.weight,
                    semanticColors.text.primary
                  )}
                >
                  Notifications
                </h1>
                <p
                  className={cn(
                    typography.bodyMd.size,
                    semanticColors.text.secondary,
                    "mt-1"
                  )}
                >
                  Stay updated with your messages and activity
                </p>
              </div>
            </div>

            {/* Search and Filter Controls */}
            <div
              className={cn(
                "flex gap-2 flex-wrap items-center",
                componentSpacing.gap.md
              )}
            >
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("flex-1 min-w-64", borders.default, transitions.normal)}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex items-center gap-2",
                      transitions.normal
                    )}
                  >
                    <Filter size={16} />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuCheckboxItem
                    checked={readFilter === "all"}
                    onCheckedChange={() => setReadFilter("all")}
                  >
                    All Notifications
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={readFilter === "unread"}
                    onCheckedChange={() => setReadFilter("unread")}
                  >
                    Unread Only
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={readFilter === "read"}
                    onCheckedChange={() => setReadFilter("read")}
                  >
                    Read Only
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                className={cn("flex items-center gap-2", transitions.normal)}
              >
                <Check size={16} />
                Mark All Read
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled
                className={cn("flex items-center gap-2", transitions.normal)}
                title="Archive all selected"
              >
                <Archive size={16} />
                Archive
              </Button>
            </div>

            {/* Results Info */}
            {!getCurrentLoading() && (
              <p
                className={cn(
                  typography.bodySm.size,
                  semanticColors.text.secondary,
                  "mt-2"
                )}
              >
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {filteredNotifications.length}
                </span>{" "}
                notification{filteredNotifications.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Divider */}
          <div
            className={cn("h-px", transitions.normal)}
            style={{ backgroundColor: `var(--border)` }}
          />

          {/* Tab Navigation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
            <Button
              onClick={() => setActiveTab("overview")}
              variant={activeTab === "overview" ? "default" : "outline"}
              className={cn(
                "justify-center gap-2",
                transitions.normal,
                activeTab === "overview"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 border-0 text-white"
                  : cn(borders.subtle, "bg-transparent")
              )}
            >
              <Bell size={16} />
              <span className="hidden sm:inline">Overview</span>
              {counts.total > 0 && (
                <span className="ml-1 text-xs font-bold">
                  {counts.total}
                </span>
              )}
            </Button>

            <Button
              onClick={() => setActiveTab("messages")}
              variant={activeTab === "messages" ? "default" : "outline"}
              className={cn(
                "justify-center gap-2",
                transitions.normal,
                activeTab === "messages"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 border-0 text-white"
                  : cn(borders.subtle, "bg-transparent")
              )}
            >
              <span className="w-5 h-5">💬</span>
              <span className="hidden sm:inline">Messages</span>
              {counts.messages > 0 && (
                <span className="ml-1 text-xs font-bold">
                  {counts.messages}
                </span>
              )}
            </Button>

            <Button
              onClick={() => setActiveTab("world")}
              variant={activeTab === "world" ? "default" : "outline"}
              className={cn(
                "justify-center gap-2",
                transitions.normal,
                activeTab === "world"
                  ? "bg-gradient-to-r from-orange-600 to-red-600 border-0 text-white"
                  : cn(borders.subtle, "bg-transparent")
              )}
            >
              <span className="w-5 h-5">🌍</span>
              <span className="hidden sm:inline">World</span>
              {counts.world + counts.social > 0 && (
                <span className="ml-1 text-xs font-bold">
                  {counts.world + counts.social}
                </span>
              )}
            </Button>

            <Button
              onClick={() => setActiveTab("community")}
              variant={activeTab === "community" ? "default" : "outline"}
              className={cn(
                "justify-center gap-2",
                transitions.normal,
                activeTab === "community"
                  ? "bg-gradient-to-r from-amber-600 to-yellow-600 border-0 text-white"
                  : cn(borders.subtle, "bg-transparent")
              )}
            >
              <span className="w-5 h-5">🏛️</span>
              <span className="hidden sm:inline">Community</span>
              {counts.community > 0 && (
                <span className="ml-1 text-xs font-bold">
                  {counts.community}
                </span>
              )}
            </Button>

          </div>

          {/* Divider */}
          <div
            className={cn("h-px", transitions.normal)}
            style={{ backgroundColor: `var(--border)` }}
          />

          {/* Loading State */}
          {getCurrentLoading() && (
            <div className={cn("space-y-3", componentSpacing.stack.md)}>
              {[...Array(5)].map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Tab Content */}
          {!getCurrentLoading() && (
            <>
              {activeTab === "overview" && (
                <OverviewTab
                  allNotifications={filteredNotifications}
                  counts={{
                    total: counts.total,
                    messages: counts.messages,
                    world: counts.world + counts.social,
                    community: counts.community,
                  }}
                  loading={allNotifications.loading}
                  onMarkAsRead={async (id) => {
                    await allNotifications.markAsRead(id);
                    messagesNotifications.syncReadState([id]);
                    worldNotifications.syncReadState([id]);
                    communityNotifications.syncReadState([id]);
                    socialNotifications.syncReadState([id]);
                  }}
                  onMarkManyAsRead={async (ids) => {
                    await allNotifications.markManyAsRead(ids);
                    messagesNotifications.syncReadState(ids);
                    worldNotifications.syncReadState(ids);
                    communityNotifications.syncReadState(ids);
                    socialNotifications.syncReadState(ids);
                  }}
                  onArchive={allNotifications.archive}
                />
              )}

              {activeTab === "messages" && (
                <MessagesTab
                  notifications={filteredNotifications}
                  loading={handlers.loading}
                  hasMore={handlers.hasMore}
                  onLoadMore={handlers.loadMore}
                  onMarkAsRead={async (id) => {
                    await handlers.markAsRead(id);
                    allNotifications.syncReadState([id]);
                    worldNotifications.syncReadState([id]);
                    communityNotifications.syncReadState([id]);
                    socialNotifications.syncReadState([id]);
                  }}
                  onMarkManyAsRead={async (ids) => {
                    if (handlers.markManyAsRead) {
                      await handlers.markManyAsRead(ids);
                    } else if (handlers.markAsRead) {
                      await Promise.all(ids.map((id) => handlers.markAsRead(id)));
                    }
                    allNotifications.syncReadState(ids);
                    worldNotifications.syncReadState(ids);
                    communityNotifications.syncReadState(ids);
                    socialNotifications.syncReadState(ids);
                  }}
                  onArchive={handlers.archive}
                />
              )}

              {activeTab === "world" && (
                <WorldTab
                  notifications={filteredNotifications}
                  loading={handlers.loading}
                  hasMore={handlers.hasMore}
                  onLoadMore={handlers.loadMore}
                  onMarkAsRead={async (id) => {
                    await handlers.markAsRead(id);
                    allNotifications.syncReadState([id]);
                    messagesNotifications.syncReadState([id]);
                    communityNotifications.syncReadState([id]);
                  }}
                  onMarkManyAsRead={async (ids) => {
                    if (handlers.markManyAsRead) {
                      await handlers.markManyAsRead(ids);
                    } else if (handlers.markAsRead) {
                      await Promise.all(ids.map((id) => handlers.markAsRead(id)));
                    }
                    allNotifications.syncReadState(ids);
                    messagesNotifications.syncReadState(ids);
                    communityNotifications.syncReadState(ids);
                  }}
                  onArchive={handlers.archive}
                />
              )}

              {activeTab === "community" && (
                <CommunityTab
                  notifications={filteredNotifications}
                  loading={handlers.loading}
                  hasMore={handlers.hasMore}
                  onLoadMore={handlers.loadMore}
                  onMarkAsRead={async (id) => {
                    await handlers.markAsRead(id);
                    allNotifications.syncReadState([id]);
                    messagesNotifications.syncReadState([id]);
                    worldNotifications.syncReadState([id]);
                    socialNotifications.syncReadState([id]);
                  }}
                  onMarkManyAsRead={async (ids) => {
                    if (handlers.markManyAsRead) {
                      await handlers.markManyAsRead(ids);
                    } else if (handlers.markAsRead) {
                      await Promise.all(ids.map((id) => handlers.markAsRead(id)));
                    }
                    allNotifications.syncReadState(ids);
                    messagesNotifications.syncReadState(ids);
                    worldNotifications.syncReadState(ids);
                    socialNotifications.syncReadState(ids);
                  }}
                  onArchive={handlers.archive}
                />
              )}
            </>
          )}
        </div>
      </PageSection>
    </div>
  );
};

export default NotificationsPage;

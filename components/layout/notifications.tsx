"use client";

import { FC, useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { borders } from "@/lib/design-system";
import {
  NotificationCategory,
  NotificationUI,
  isWorldTabNotification,
} from "@/lib/types/notifications";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useNotificationCounts } from "@/lib/hooks/use-notifications";
import { OverviewTab } from "@/components/notifications/tabs/overview-tab";
import { MessagesTab } from "@/components/notifications/tabs/messages-tab";
import { WorldTab } from "@/components/notifications/tabs/world-tab";
import { CommunityTab } from "@/components/notifications/tabs/community-tab";
import { realtimeManager } from "@/lib/services/notification-service";
import { toast } from "sonner";

// Skeleton loading component for notifications
const NotificationSkeleton = () => (
  <div className={cn("space-y-3 p-4", borders.faint, "border-b")}>
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
        <div className="h-2 bg-muted rounded w-1/2 animate-pulse" />
      </div>
    </div>
  </div>
);

const DropdownSkeleton = () => (
  <div className="space-y-2 p-4">
    {[...Array(3)].map((_, i) => (
      <NotificationSkeleton key={i} />
    ))}
  </div>
);

export const Notifications: FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "messages" | "world" | "community">("overview");

  // Fetch all notifications for overview
  const allNotifications = useNotifications({
    limit: 50,
    enabled: true,
  });

  // Fetch notifications by category
  const messagesNotifications = useNotifications({
    category: NotificationCategory.MESSAGES,
    limit: 20,
    enabled: activeTab === "messages",
  });

  const worldNotifications = useNotifications({
    category: NotificationCategory.WORLD,
    limit: 20,
    enabled: activeTab === "world",
  });

  const communityNotifications = useNotifications({
    category: NotificationCategory.COMMUNITY,
    limit: 20,
    enabled: activeTab === "community",
  });

  const socialNotifications = useNotifications({
    category: NotificationCategory.SOCIAL,
    limit: 20,
    enabled: activeTab === "world",
  });

  // Fetch counts
  const { counts } = useNotificationCounts(true);

  // Subscribe to new notification arrivals to show toast
  useEffect(() => {
    const unsubscribe = realtimeManager.subscribeToNewNotifications((notification) => {
      console.log("[Notifications] New notification received:", notification);
      // Show a subtle toast for new notifications
      toast.info(notification.title || "New notification", {
        description: notification.body || undefined,
        duration: 3000,
      });
    });

    return unsubscribe;
  }, []);

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

  const mergedWorldNotifications = useMemo(() => {
    if (activeTab !== "world") {
      return worldNotifications.notifications;
    }

    return mergeAndFilterWorldNotifications([
      ...worldNotifications.notifications,
      ...socialNotifications.notifications,
    ]);
  }, [
    activeTab,
    worldNotifications.notifications,
    socialNotifications.notifications,
    mergeAndFilterWorldNotifications,
  ]);

  const mergedWorldHasMore =
    worldNotifications.hasMore || socialNotifications.hasMore;

  const handleWorldMarkAsRead = (notificationId: string) => {
    const isSocial = socialNotifications.notifications.some(
      (notification) => notification.id === notificationId
    );
    if (isSocial) {
      return socialNotifications.markAsRead(notificationId);
    }
    return worldNotifications.markAsRead(notificationId);
  };

  const handleWorldArchive = (notificationId: string) => {
    const isSocial = socialNotifications.notifications.some(
      (notification) => notification.id === notificationId
    );
    if (isSocial) {
      return socialNotifications.archive(notificationId);
    }
    return worldNotifications.archive(notificationId);
  };

  const handleWorldLoadMore = () => {
    if (worldNotifications.hasMore) {
      worldNotifications.loadMore();
    }
    if (socialNotifications.hasMore) {
      socialNotifications.loadMore();
    }
  };

  // Get current loading state
  const getCurrentLoading = () => {
    switch (activeTab) {
      case "messages":
        return messagesNotifications.loading;
      case "world":
        return worldNotifications.loading || socialNotifications.loading;
      case "community":
        return communityNotifications.loading;
      default:
        return allNotifications.loading;
    }
  };

  const isLoading = getCurrentLoading();

  return (
    <div className="w-full flex flex-col h-full min-h-0">
      {/* Tabs Header */}
      <Tabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab(val as "overview" | "messages" | "world" | "community")
          }
          className="w-full flex flex-col flex-1 overflow-hidden min-h-0"
        >
          <TabsList className="w-full rounded-none border-b flex-shrink-0">
            <TabsTrigger
              value="overview"
              className="flex-1 rounded-none text-xs"
            >
              Overview
              {counts.total > 0 && (
                <span className="ml-1 text-xs font-semibold">
                  {counts.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="messages"
              className="flex-1 rounded-none text-xs"
            >
              Messages
              {counts.messages > 0 && (
                <span className="ml-1 text-xs font-semibold">
                  {counts.messages}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="world" className="flex-1 rounded-none text-xs">
              World
              {counts.world + counts.social > 0 && (
                <span className="ml-1 text-xs font-semibold">
                  {counts.world + counts.social}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="community" className="flex-1 rounded-none text-xs">
              Community
              {counts.community > 0 && (
                <span className="ml-1 text-xs font-semibold">
                  {counts.community}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

        {/* Tab Content */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {isLoading ? (
            <DropdownSkeleton />
          ) : (
            <>
              <TabsContent value="overview" className="m-0 h-full min-h-0 overflow-y-auto">
                  <OverviewTab
                    allNotifications={allNotifications.notifications}
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
                </TabsContent>

                <TabsContent value="messages" className="m-0 h-full min-h-0">
                  <MessagesTab
                    notifications={messagesNotifications.notifications}
                    loading={messagesNotifications.loading}
                    hasMore={messagesNotifications.hasMore}
                    onLoadMore={messagesNotifications.loadMore}
                    onMarkAsRead={async (id) => {
                      await messagesNotifications.markAsRead(id);
                      allNotifications.syncReadState([id]);
                      worldNotifications.syncReadState([id]);
                      communityNotifications.syncReadState([id]);
                      socialNotifications.syncReadState([id]);
                    }}
                    onMarkManyAsRead={async (ids) => {
                      await messagesNotifications.markManyAsRead(ids);
                      allNotifications.syncReadState(ids);
                      worldNotifications.syncReadState(ids);
                      communityNotifications.syncReadState(ids);
                      socialNotifications.syncReadState(ids);
                    }}
                    onArchive={messagesNotifications.archive}
                  />
                </TabsContent>

                <TabsContent value="world" className="m-0 h-full min-h-0">
                  <WorldTab
                    notifications={mergedWorldNotifications}
                    loading={worldNotifications.loading || socialNotifications.loading}
                    hasMore={mergedWorldHasMore}
                    onLoadMore={handleWorldLoadMore}
                    onMarkAsRead={async (id) => {
                      await handleWorldMarkAsRead(id);
                      allNotifications.syncReadState([id]);
                      messagesNotifications.syncReadState([id]);
                      communityNotifications.syncReadState([id]);
                    }}
                    onMarkManyAsRead={async (ids) => {
                      await Promise.all(ids.map(handleWorldMarkAsRead));
                      allNotifications.syncReadState(ids);
                      messagesNotifications.syncReadState(ids);
                      communityNotifications.syncReadState(ids);
                    }}
                    onArchive={handleWorldArchive}
                  />
                </TabsContent>

                <TabsContent value="community" className="m-0 h-full min-h-0">
                  <CommunityTab
                    notifications={communityNotifications.notifications}
                    loading={communityNotifications.loading}
                    hasMore={communityNotifications.hasMore}
                    onLoadMore={communityNotifications.loadMore}
                    onMarkAsRead={async (id) => {
                      await communityNotifications.markAsRead(id);
                      allNotifications.syncReadState([id]);
                      messagesNotifications.syncReadState([id]);
                      worldNotifications.syncReadState([id]);
                      socialNotifications.syncReadState([id]);
                    }}
                    onMarkManyAsRead={async (ids) => {
                      await communityNotifications.markManyAsRead(ids);
                      allNotifications.syncReadState(ids);
                      messagesNotifications.syncReadState(ids);
                      worldNotifications.syncReadState(ids);
                      socialNotifications.syncReadState(ids);
                    }}
                    onArchive={communityNotifications.archive}
                  />
                </TabsContent>
              </>
            )}
        </div>
      </Tabs>

      {/* Footer */}
      <div
        className="border-t p-2 flex-shrink-0"
        style={{ borderColor: `var(--border)` }}
      >
        <Link href="/notifications?tab=overview" className="w-full block">
          <Button variant="outline" size="sm" className="w-full text-xs h-8">
            View All
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default Notifications;

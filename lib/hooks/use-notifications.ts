"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  NotificationCategory,
  NotificationUI,
  NotificationCounts,
  transformToUINotification,
  NotificationRealtimePayload,
} from "@/lib/types/notifications";
import {
  getCachedOrFetchCounts,
  markNotificationAsRead,
  archiveNotification,
  batchMarkNotificationsAsRead,
  fetchNotifications,
  realtimeManager,
  notificationCache,
} from "@/lib/services/notification-service";

// ==================== useNotifications Hook ====================

interface UseNotificationsOptions {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
  search?: string;
  enabled?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { category, unreadOnly = false, limit = 20, search, enabled = true } =
    options;

  const [notifications, setNotifications] = useState<NotificationUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const notificationsRef = useRef<NotificationUI[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Initialize real-time subscription once (user context handled via auth from server)
  useEffect(() => {
    // Real-time initialization happens in the Notifications component
    // This is handled at a higher level to avoid duplicate subscriptions
  }, []);

  // Fetch initial notifications
  useEffect(() => {
    if (!enabled) return;

    const fetchInitial = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchNotifications({
          category,
          unreadOnly,
          limit,
          offset: 0,
          search,
        });

        setNotifications(
          dedupeNotifications(
            data.notifications.map((n) => transformToUINotification(n))
          )
        );

        setHasMore(data.hasMore);
        setOffset(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch notifications");
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();

    if (search && search.trim()) return;

    const unsubscribe = realtimeManager.subscribeToChanges((payload) => {
      console.log("[useNotifications] Received real-time update:", payload);
      setNotifications((prev) => {
        const updated = applyRealtimeChange(prev, payload, {
          category: category ?? "all",
          unreadOnly,
          limit,
        });
        console.log("[useNotifications] Updated notifications:", {
          prevCount: prev.length,
          updatedCount: updated.length,
          eventType: payload.eventType,
        });
        return updated;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, category, unreadOnly, limit, search]);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    try {
      setLoading(true);
      const newOffset = offset + limit;

      const data = await fetchNotifications({
        category,
        unreadOnly,
        limit,
        offset: newOffset,
        search,
      });

      setNotifications((prev) =>
        dedupeNotifications([
          ...prev,
          ...data.notifications.map((n) => transformToUINotification(n)),
        ])
      );

      setHasMore(data.hasMore);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
      console.error("Error loading more notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [offset, limit, category, unreadOnly, search, hasMore, loading]);

  // Mark as read
  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      const notification = notificationsRef.current.find(
        (n) => n.id === notificationId
      );
      const wasUnread = !!notification?.isUnread;

      console.log("[useNotifications] handleMarkAsRead:", {
        notificationId,
        wasUnread,
        category: notification?.category,
      });

      try {
        // Mark as optimistic to prevent double-counting from real-time
        realtimeManager.markOptimisticOperation(notificationId);

        // Optimistic UI update only - counts will come from server
        if (unreadOnly) {
          setNotifications((prev) =>
            prev.filter((n) => n.id !== notificationId)
          );
        } else {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, isUnread: false } : n
            )
          );
        }

        // Server will return updated counts and broadcast them
        await markNotificationAsRead(notificationId);
      } catch (err) {
        // Revert optimistic UI update on error
        setNotifications((prev) => {
          if (unreadOnly) {
            // Refetch on error
            return prev;
          } else {
            return prev.map((n) =>
              n.id === notificationId ? { ...n, isUnread: true } : n
            );
          }
        });

        setError(err instanceof Error ? err.message : "Failed to mark as read");
      }
    },
    [unreadOnly]
  );

  const handleMarkManyAsRead = useCallback(
    async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return;
      const idSet = new Set(notificationIds);

      console.log("[useNotifications] handleMarkManyAsRead:", {
        count: notificationIds.length,
      });

      try {
        // Mark all as optimistic to prevent double-counting from real-time
        notificationIds.forEach((id) => {
          realtimeManager.markOptimisticOperation(id);
        });

        // Optimistic UI update only - counts will come from server
        if (unreadOnly) {
          setNotifications((prev) => prev.filter((n) => !idSet.has(n.id)));
        } else {
          setNotifications((prev) =>
            prev.map((n) => (idSet.has(n.id) ? { ...n, isUnread: false } : n))
          );
        }

        // Server will return updated counts and broadcast them
        await batchMarkNotificationsAsRead(notificationIds);
      } catch (err) {
        // Worst-case: refetch to recover UI state
        const data = await fetchNotifications({
          category,
          unreadOnly,
          limit,
          offset: 0,
          search,
        });
        setNotifications(data.notifications.map((n) => transformToUINotification(n)));
        setError(err instanceof Error ? err.message : "Failed to mark as read");
      }
    },
    [category, unreadOnly, limit, search]
  );

  const syncReadState = useCallback(
    (notificationIds: string[], isRead = true) => {
      if (notificationIds.length === 0) return;
      const idSet = new Set(notificationIds);

      setNotifications((prev) => {
        if (unreadOnly && isRead) {
          return prev.filter((n) => !idSet.has(n.id));
        }
        return prev.map((n) =>
          idSet.has(n.id) ? { ...n, isUnread: !isRead } : n
        );
      });
    },
    [unreadOnly]
  );

  // Archive notification
  const handleArchive = useCallback(async (notificationId: string) => {
    console.log("[useNotifications] handleArchive:", { notificationId });

    try {
      // Mark as optimistic to prevent double-counting from real-time
      realtimeManager.markOptimisticOperation(notificationId);

      // Optimistic UI update only - counts will come from server
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      );

      // Server will return updated counts and broadcast them
      await archiveNotification(notificationId);
    } catch (err) {
      // Refetch on error to recover UI state
      const data = await fetchNotifications({ category, unreadOnly, limit });
      setNotifications(
        data.notifications.map((n) => transformToUINotification(n))
      );
      setError(err instanceof Error ? err.message : "Failed to archive");
    }
  }, [category, unreadOnly, limit]);

  return {
    notifications,
    loading,
    error,
    hasMore,
    loadMore,
    markAsRead: handleMarkAsRead,
    markManyAsRead: handleMarkManyAsRead,
    syncReadState,
    archive: handleArchive,
  };
}

// ==================== useNotificationCounts Hook ====================

export function useNotificationCounts(enabled = true) {
  const [counts, setCounts] = useState<NotificationCounts>(() => {
    // First try to get from realtime manager (most accurate)
    const currentCounts = realtimeManager.getCurrentCounts();
    if (currentCounts) {
      console.log("[useNotificationCounts] Initial counts from realtimeManager:", currentCounts);
      return currentCounts;
    }

    // Then try localStorage (persists across page navigation)
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("notification-counts");
        if (stored) {
          const parsed = JSON.parse(stored) as NotificationCounts;
          console.log("[useNotificationCounts] Initial counts from localStorage:", parsed);
          return parsed;
        }
      } catch (error) {
        console.error("[useNotificationCounts] Failed to load from localStorage:", error);
      }
    }

    // Finally, try cache
    const cached = notificationCache.get<NotificationCounts>("counts");
    if (cached) {
      console.log("[useNotificationCounts] Initial counts from cache:", cached);
      return cached;
    }

    console.log("[useNotificationCounts] No initial counts available, using zero");
    return {
      total: 0,
      messages: 0,
      world: 0,
      social: 0,
      community: 0,
    };
  });
  const [loading, setLoading] = useState(() => {
    // Don't show loading if we have counts from any source
    return realtimeManager.getCurrentCounts() === null &&
           notificationCache.get("counts") === null &&
           (typeof window === "undefined" || !window.localStorage.getItem("notification-counts"));
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch counts from server with retry logic
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    const fetchCounts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getCachedOrFetchCounts(true);
        if (!cancelled) {
          console.log("[useNotificationCounts] Fetched counts from server:", data);
          setCounts(data);
          // Broadcast immediately to update all subscribers
          realtimeManager.broadcastCounts(data, true);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useNotificationCounts] Error fetching counts:", err);
          // Retry once if fetch fails
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            console.log("[useNotificationCounts] Retrying fetch, attempt:", retryCount);
            setTimeout(fetchCounts, 1000);
          } else {
            setError(err instanceof Error ? err.message : "Failed to fetch counts");
            setLoading(false);
          }
        }
      }
    };

    console.log("[useNotificationCounts] Initializing, fetching counts");
    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Subscribe to real-time count updates (separate effect to avoid re-subscription)
  useEffect(() => {
    if (!enabled) return;

    console.log("[useNotificationCounts] Setting up count subscription");
    const unsubscribe = realtimeManager.subscribeToCounts((updated) => {
      console.log("[useNotificationCounts] Received count update from realtimeManager:", updated);
      // Always update state with the new counts
      setCounts(updated);
    });

    return () => {
      console.log("[useNotificationCounts] Cleaning up count subscription");
      unsubscribe();
    };
  }, [enabled]);

  return {
    counts,
    loading,
    error,
    totalUnread: counts.total,
  };
}

// ==================== useNotificationActions Hook ====================

export function useNotificationActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        setLoading(true);
        setError(null);
        await markNotificationAsRead(notificationId);
        realtimeManager.requestCountsReconcile();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to mark as read");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const archive = useCallback(async (notificationId: string) => {
    try {
      setLoading(true);
      setError(null);
      await archiveNotification(notificationId);
      realtimeManager.requestCountsReconcile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    markAsRead,
    archive,
    loading,
    error,
  };
}

function applyRealtimeChange(
  prev: NotificationUI[],
  payload: NotificationRealtimePayload,
  options: { category: NotificationCategory | "all"; unreadOnly: boolean; limit: number }
): NotificationUI[] {
  const { new: newNotif, old: oldNotif, eventType } = payload ?? {};
  const id: string | undefined = newNotif?.id ?? oldNotif?.id;
  if (!id) return prev;

  if (eventType === "DELETE") {
    return prev.filter((n) => n.id !== id);
  }

  const notification = newNotif ? transformToUINotification(newNotif) : null;
  if (!notification) return prev;

  const shouldInclude = matchesSubscription(notification, options);
  const existingIndex = prev.findIndex((n) => n.id === id);

  if (!shouldInclude) {
    if (existingIndex === -1) return prev;
    return prev.filter((n) => n.id !== id);
  }

  const next = existingIndex === -1
    ? [notification, ...prev]
    : prev.map((n) => (n.id === id ? notification : n));

  const ordered = dedupeNotifications(next).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (options.limit > 0 && ordered.length > options.limit) {
    return ordered.slice(0, options.limit);
  }
  return ordered;
}

function matchesSubscription(
  notification: NotificationUI,
  options: { category: NotificationCategory | "all"; unreadOnly: boolean }
): boolean {
  if (notification.isArchived) return false;
  if (options.category !== "all" && notification.category !== options.category) {
    return false;
  }
  if (options.unreadOnly && !notification.isUnread) return false;
  return true;
}

function categoryCountKey(
  category: NotificationCategory
): Exclude<keyof NotificationCounts, "total" | "lastNotificationAt"> {
  switch (category) {
    case NotificationCategory.MESSAGES:
      return "messages";
    case NotificationCategory.WORLD:
      return "world";
    case NotificationCategory.COMMUNITY:
      return "community";
    case NotificationCategory.SOCIAL:
      return "social";
  }
}

function deltaForCategory(
  category: NotificationCategory,
  delta: number
): Partial<NotificationCounts> {
  const key = categoryCountKey(category);
  return { total: delta, [key]: delta };
}

function dedupeNotifications(notifications: NotificationUI[]): NotificationUI[] {
  const seen = new Set<string>();
  const result: NotificationUI[] = [];
  for (const notification of notifications) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    result.push(notification);
  }
  return result;
}

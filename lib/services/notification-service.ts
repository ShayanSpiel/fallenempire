/**
 * Notification Service Layer
 * Handles all notification API interactions, caching, and real-time subscriptions
 */

import {
  Notification,
  NotificationCategory,
  NotificationCounts,
  NotificationListResponse,
  NotificationBatchAction,
  transformToUINotification,
  NotificationUI,
  getNotificationCategory,
  NotificationRealtimePayload,
} from "@/lib/types/notifications";

// ==================== API Wrappers ====================

/**
 * Fetch notifications with optional filtering and pagination
 */
export async function fetchNotifications({
  category,
  unreadOnly = false,
  limit = 20,
  offset = 0,
  search,
}: {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
} = {}): Promise<NotificationListResponse> {
  const params = new URLSearchParams();

  params.append("action", "list");
  if (category) params.append("category", category);
  if (unreadOnly) params.append("unreadOnly", "true");
  params.append("limit", limit.toString());
  params.append("offset", offset.toString());
  if (search) params.append("search", search);

  const response = await fetch(`/api/notifications?${params.toString()}`);

  if (response.status === 401) {
    // Session may be refreshing; avoid throwing and breaking UI.
    return {
      notifications: [],
      total: 0,
      hasMore: false,
      nextOffset: undefined,
    };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch notifications: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch unread notification counts by category
 */
export async function fetchNotificationCounts(): Promise<NotificationCounts> {
  const response = await fetch("/api/notifications?action=counts");

  if (response.status === 401) {
    return { total: 0, messages: 0, world: 0, community: 0, social: 0 };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch counts: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<void> {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "markAsRead",
      notificationId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mark as read: ${response.statusText}`);
  }

  try {
    const data = await response.json();
    console.log("[markNotificationAsRead] Server response:", data);
    if (data?.counts) {
      console.log("[markNotificationAsRead] Broadcasting server counts immediately:", data.counts);
      // Broadcast with immediate=true to ensure it gets to subscribers right away
      realtimeManager.broadcastCounts(data.counts, true);
      // Also save to cache and localStorage for immediate UI updates
      notificationCache.set("counts", data.counts, 1 * 60 * 1000);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("notification-counts", JSON.stringify(data.counts));
        } catch (e) {
          console.error("[markNotificationAsRead] Failed to save to localStorage:", e);
        }
      }
      return;
    }
  } catch (error) {
    console.error("[markNotificationAsRead] Failed to parse response:", error);
  }

  console.log("[markNotificationAsRead] No counts in response, requesting reconcile");
  realtimeManager.requestCountsReconcile();
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "markAllAsRead",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mark all as read: ${response.statusText}`);
  }

  try {
    const data = await response.json();
    console.log("[markAllNotificationsAsRead] Server response:", data);
    if (data?.counts) {
      console.log("[markAllNotificationsAsRead] Broadcasting server counts immediately:", data.counts);
      realtimeManager.broadcastCounts(data.counts, true);
      notificationCache.set("counts", data.counts, 1 * 60 * 1000);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("notification-counts", JSON.stringify(data.counts));
        } catch (e) {
          console.error("[markAllNotificationsAsRead] Failed to save to localStorage:", e);
        }
      }
      return;
    }
  } catch (error) {
    console.error("[markAllNotificationsAsRead] Failed to parse response:", error);
  }

  console.log("[markAllNotificationsAsRead] No counts in response, requesting reconcile");
  realtimeManager.requestCountsReconcile();
}

/**
 * Archive a single notification
 */
export async function archiveNotification(
  notificationId: string
): Promise<void> {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "archive",
      notificationId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to archive notification: ${response.statusText}`);
  }

  try {
    const data = await response.json();
    console.log("[archiveNotification] Server response:", data);
    if (data?.counts) {
      console.log("[archiveNotification] Broadcasting server counts immediately:", data.counts);
      realtimeManager.broadcastCounts(data.counts, true);
      notificationCache.set("counts", data.counts, 1 * 60 * 1000);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("notification-counts", JSON.stringify(data.counts));
        } catch (e) {
          console.error("[archiveNotification] Failed to save to localStorage:", e);
        }
      }
      return;
    }
  } catch (error) {
    console.error("[archiveNotification] Failed to parse response:", error);
  }

  console.log("[archiveNotification] No counts in response, requesting reconcile");
  realtimeManager.requestCountsReconcile();
}

/**
 * Archive all notifications of a specific type
 */
export async function archiveNotificationsByType(
  type: string
): Promise<void> {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "archiveType",
      type,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to archive type: ${response.statusText}`);
  }
  realtimeManager.requestCountsReconcile();
}

/**
 * Batch operations on notifications
 */
export async function batchNotificationAction(
  action: NotificationBatchAction
): Promise<void> {
  const operation =
    action.action === "read"
      ? "read"
      : action.action === "archive"
        ? "archive"
        : action.action === "delete"
          ? "delete"
          : null;

  if (!operation) {
    throw new Error(`Unsupported batch action: ${action.action}`);
  }

  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "batch",
      ids: action.ids,
      operation,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to perform batch action: ${response.statusText}`);
  }
  realtimeManager.requestCountsReconcile();
}

export async function batchMarkNotificationsAsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "batch",
      ids,
      operation: "read",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to batch mark as read: ${response.statusText}`);
  }

  try {
    const data = await response.json();
    console.log("[batchMarkNotificationsAsRead] Server response:", data);
    if (data?.counts) {
      console.log("[batchMarkNotificationsAsRead] Broadcasting server counts immediately:", data.counts);
      realtimeManager.broadcastCounts(data.counts, true);
      notificationCache.set("counts", data.counts, 1 * 60 * 1000);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("notification-counts", JSON.stringify(data.counts));
        } catch (e) {
          console.error("[batchMarkNotificationsAsRead] Failed to save to localStorage:", e);
        }
      }
      return;
    }
  } catch (error) {
    console.error("[batchMarkNotificationsAsRead] Failed to parse response:", error);
  }

  console.log("[batchMarkNotificationsAsRead] No counts in response, requesting reconcile");
  realtimeManager.requestCountsReconcile();
}

/**
 * Accept a follow request or community invite
 */
export async function acceptSocialRequest(
  notificationId: string,
  requestType: "follow" | "invite"
): Promise<void> {
  const endpoint =
    requestType === "follow"
      ? "/api/social/follow"
      : "/api/social/community-invite";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "accept",
      notificationId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to accept ${requestType} request: ${response.statusText}`
    );
  }
}

/**
 * Reject a follow request or community invite
 */
export async function rejectSocialRequest(
  notificationId: string,
  requestType: "follow" | "invite"
): Promise<void> {
  const endpoint =
    requestType === "follow"
      ? "/api/social/follow"
      : "/api/social/community-invite";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reject",
      notificationId,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to reject ${requestType} request: ${response.statusText}`
    );
  }
}

// ==================== Caching & State Management ====================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // milliseconds
}

class NotificationCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private invalidationListeners = new Set<(pattern?: string) => void>();

  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.DEFAULT_TTL,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  invalidate(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }

    this.notifyInvalidation(pattern);
  }

  invalidateByCategory(category?: NotificationCategory): void {
    if (category) {
      this.invalidate(`notifications:${category}`);
    } else {
      this.invalidate("notifications:");
    }
  }

  onInvalidate(listener: (pattern?: string) => void): () => void {
    this.invalidationListeners.add(listener);
    return () => {
      this.invalidationListeners.delete(listener);
    };
  }

  private notifyInvalidation(pattern?: string): void {
    this.invalidationListeners.forEach((listener) => listener(pattern));
  }
}

export const notificationCache = new NotificationCache();

// ==================== Real-time Subscription Manager ====================

interface SubscriptionOptions {
  category?: NotificationCategory | "all";
  unreadOnly?: boolean;
  limit?: number;
}

type RealtimeCallback = (notifications: NotificationUI[], options: SubscriptionOptions) => void;
type CountsCallback = (counts: NotificationCounts) => void;
type NewNotificationCallback = (notification: NotificationUI) => void;
type ChangeCallback = (payload: NotificationRealtimePayload) => void;

type RealtimeChannelLike = {
  on: (
    type: "postgres_changes",
    filter: { event: string; schema: string; table: string; filter: string },
    callback: (payload: NotificationRealtimePayload) => void
  ) => RealtimeChannelLike;
  subscribe: () => RealtimeChannelLike;
  unsubscribe: () => void;
};

type SupabaseClientLike = {
  channel: (name: string) => RealtimeChannelLike;
};

class RealtimeManager {
  private subscriptions = new Map<string, { callback: RealtimeCallback; options: SubscriptionOptions }>();
  private countSubscriptions = new Map<string, CountsCallback>();
  private newNotificationListeners = new Set<NewNotificationCallback>();
  private changeSubscriptions = new Map<string, ChangeCallback>();
  private channel: RealtimeChannelLike | null = null;
  private userId: string | null = null;
  private currentCounts: NotificationCounts | null = null;
  private countsReconcileTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOptimisticOps = new Map<string, number>(); // notification ID -> timestamp
  private lastBroadcastTime = 0;
  private BROADCAST_THROTTLE_MS = 100;
  private broadcastThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingBroadcast: NotificationCounts | null = null;

  /**
   * Initialize real-time subscription for a user
   * Must be called with user context (typically from Auth)
   */
  async initialize(userId: string, supabaseClient: SupabaseClientLike): Promise<void> {
    if (this.userId === userId && this.channel) {
      console.log("[RealtimeManager] Already initialized for user:", userId);
      return; // Already initialized for this user
    }

    console.log("[RealtimeManager] Initializing for user:", userId);
    this.cleanup();
    this.userId = userId;

    // Restore counts from localStorage to prevent reset on page navigation
    const storedCounts = this.loadCountsFromStorage();
    if (storedCounts) {
      console.log("[RealtimeManager] Restored counts from localStorage:", storedCounts);
      this.currentCounts = storedCounts;
      // Immediately broadcast to subscribers so the bell shows correct count
      this.broadcastCounts(storedCounts, true);
    }

    try {
      this.channel = supabaseClient
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload: NotificationRealtimePayload) => {
            console.log("[RealtimeManager] Raw Supabase payload received:", payload);
            this.handleRealtimeUpdate(payload);
          }
        )
        .subscribe();
      console.log("[RealtimeManager] Subscribed to notifications channel");
    } catch (error) {
      console.error("Failed to initialize real-time notifications:", error);
    }

    // Fetch fresh counts from server in the background to ensure accuracy
    try {
      const freshCounts = await fetchNotificationCounts();
      console.log("[RealtimeManager] Fetched fresh counts on initialization:", freshCounts);
      this.broadcastCounts(freshCounts, true);
    } catch (error) {
      console.error("[RealtimeManager] Failed to fetch fresh counts on initialization:", error);
    }
  }

  setCurrentCounts(counts: NotificationCounts): void {
    this.currentCounts = counts;
  }

  getCurrentCounts(): NotificationCounts | null {
    return this.currentCounts;
  }

  /**
   * Subscribe to notification updates for a specific category
   * Deprecated: prefer subscribeToChanges and update local state in the hook.
   */
  subscribe(
    category: NotificationCategory | "all" = "all",
    callback: RealtimeCallback,
    options: SubscriptionOptions = {}
  ): () => void {
    const key = `notifs:${category}:${Math.random()}`;
    this.subscriptions.set(key, {
      callback,
      options: { category, ...options },
    });

    return () => {
      this.subscriptions.delete(key);
    };
  }

  /**
   * Subscribe to count updates
   */
  subscribeToCounts(callback: CountsCallback): () => void {
    const key = `counts:${Math.random()}`;
    this.countSubscriptions.set(key, callback);

    return () => {
      this.countSubscriptions.delete(key);
    };
  }

  /**
   * Manually broadcast new count values to all subscribers
   * Throttled to prevent rapid-fire updates
   */
  broadcastCounts(counts: NotificationCounts, immediate = false): void {
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcastTime;

    console.log("[RealtimeManager] broadcastCounts called:", { counts, immediate, timeSinceLastBroadcast, hasSubscribers: this.countSubscriptions.size });

    // Always update current counts immediately for getCurrentCounts()
    this.currentCounts = counts;

    // If immediate or enough time has passed, broadcast now
    if (immediate || timeSinceLastBroadcast >= this.BROADCAST_THROTTLE_MS) {
      this.executeBroadcast(counts);

      // Clear any pending broadcast
      if (this.broadcastThrottleTimer) {
        clearTimeout(this.broadcastThrottleTimer);
        this.broadcastThrottleTimer = null;
      }
      this.pendingBroadcast = null;
    } else {
      // Throttle: schedule broadcast for later
      this.pendingBroadcast = counts;

      if (!this.broadcastThrottleTimer) {
        const delay = this.BROADCAST_THROTTLE_MS - timeSinceLastBroadcast;
        this.broadcastThrottleTimer = setTimeout(() => {
          this.broadcastThrottleTimer = null;
          if (this.pendingBroadcast) {
            console.log("[RealtimeManager] Executing throttled broadcast:", this.pendingBroadcast);
            this.executeBroadcast(this.pendingBroadcast);
            this.pendingBroadcast = null;
          }
        }, delay);
      }
    }
  }

  private executeBroadcast(counts: NotificationCounts): void {
    console.log("[RealtimeManager] Broadcasting counts:", counts, "to", this.countSubscriptions.size, "subscribers");
    this.lastBroadcastTime = Date.now();

    // Persist to both cache and localStorage
    notificationCache.set("counts", counts, 1 * 60 * 1000);
    this.saveCountsToStorage(counts);

    // Broadcast to all subscribers
    this.countSubscriptions.forEach((callback) => {
      try {
        callback(counts);
      } catch (error) {
        console.error("[RealtimeManager] Count callback error:", error);
      }
    });
  }

  subscribeToChanges(callback: ChangeCallback): () => void {
    const key = `changes:${Math.random()}`;
    this.changeSubscriptions.set(key, callback);

    return () => {
      this.changeSubscriptions.delete(key);
    };
  }

  subscribeToNewNotifications(callback: NewNotificationCallback): () => void {
    this.newNotificationListeners.add(callback);

    return () => {
      this.newNotificationListeners.delete(callback);
    };
  }

  /**
   * Handle real-time updates from Supabase
   * Notifies subscribers with fresh data matching their subscription options
   */
  private handleRealtimeUpdate(payload: NotificationRealtimePayload): void {
    const { new: newNotif, eventType } = payload;
    console.log("[RealtimeManager] handleRealtimeUpdate:", { eventType, newNotif, old: payload.old });

    this.applyCountsFromRealtime(payload);
    this.changeSubscriptions.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error("Change subscription callback error:", error);
      }
    });

    if (eventType === "INSERT" && newNotif) {
      const uiNotification = transformToUINotification(newNotif);
      console.log("[RealtimeManager] New notification INSERT, notifying listeners:", uiNotification);
      this.newNotificationListeners.forEach((listener) => {
        try {
          listener(uiNotification);
        } catch (error) {
          console.error("New notification listener error:", error);
        }
      });
    }
  }

  requestCountsReconcile(): void {
    if (this.countsReconcileTimer) {
      clearTimeout(this.countsReconcileTimer);
    }

    // Reduced debounce from 100ms to 50ms for faster sync
    this.countsReconcileTimer = setTimeout(() => {
      this.countsReconcileTimer = null;
      console.log("[RealtimeManager] Reconciling counts from server");
      fetchNotificationCounts()
        .then((counts) => {
          console.log("[RealtimeManager] Reconciled counts:", counts);
          this.broadcastCounts(counts, true);
        })
        .catch((error) => console.error("Counts reconcile failed:", error));
    }, 50);
  }

  getLastBroadcastTime(): number {
    return this.lastBroadcastTime;
  }

  /**
   * Mark an operation as optimistic to prevent double-counting when real-time event arrives
   */
  markOptimisticOperation(notificationId: string): void {
    const now = Date.now();
    this.pendingOptimisticOps.set(notificationId, now);

    // Clear after 3 seconds to prevent memory leak
    setTimeout(() => {
      const timestamp = this.pendingOptimisticOps.get(notificationId);
      // Only delete if it's the same operation (not a newer one)
      if (timestamp === now) {
        this.pendingOptimisticOps.delete(notificationId);
      }
    }, 3000);
  }

  /**
   * Check if an operation is optimistic and consume it (one-time check)
   */
  private isOptimisticOperation(notificationId: string): boolean {
    const timestamp = this.pendingOptimisticOps.get(notificationId);
    if (!timestamp) return false;

    const age = Date.now() - timestamp;
    const isRecent = age < 3000; // 3 second window

    if (isRecent) {
      // Consume the optimistic flag
      this.pendingOptimisticOps.delete(notificationId);
      console.log("[RealtimeManager] Consumed optimistic operation for:", notificationId, "age:", age, "ms");
      return true;
    }

    // Too old, treat as normal real-time event
    this.pendingOptimisticOps.delete(notificationId);
    return false;
  }

  applyCountsDelta(delta: Partial<NotificationCounts> = {}): void {
    if (!this.currentCounts) {
      this.currentCounts = {
        total: 0,
        messages: 0,
        world: 0,
        community: 0,
        social: 0,
      };
    }

    const safeDelta = delta ?? {};
    console.log("[RealtimeManager] Applying delta:", safeDelta, "to current:", this.currentCounts);
    const next: NotificationCounts = {
      ...this.currentCounts,
      total: clampNonNegative((this.currentCounts.total ?? 0) + (safeDelta.total ?? 0)),
      messages: clampNonNegative((this.currentCounts.messages ?? 0) + (safeDelta.messages ?? 0)),
      world: clampNonNegative((this.currentCounts.world ?? 0) + (safeDelta.world ?? 0)),
      community: clampNonNegative((this.currentCounts.community ?? 0) + (safeDelta.community ?? 0)),
      social: clampNonNegative((this.currentCounts.social ?? 0) + (safeDelta.social ?? 0)),
    };

    console.log("[RealtimeManager] New counts after delta:", next);
    this.broadcastCounts(next);
  }

  private applyCountsFromRealtime(payload: NotificationRealtimePayload): void {
    if (!this.currentCounts) {
      this.currentCounts = {
        total: 0,
        messages: 0,
        world: 0,
        community: 0,
        social: 0,
      };
    }

    const { new: newNotif, old: oldNotif, eventType } = payload ?? {};
    const notificationId = newNotif?.id ?? oldNotif?.id;

    // Skip if this is an optimistic operation to prevent double-counting
    if (notificationId && this.isOptimisticOperation(notificationId)) {
      console.log("[RealtimeManager] Skipping real-time update for optimistic operation:", notificationId);
      this.pendingOptimisticOps.delete(notificationId);
      return;
    }

    if (eventType === "UPDATE") {
      const oldHasFlags =
        !!oldNotif &&
        typeof oldNotif.is_read === "boolean" &&
        typeof oldNotif.is_archived === "boolean";
      const newHasFlags =
        !!newNotif &&
        typeof newNotif.is_read === "boolean" &&
        typeof newNotif.is_archived === "boolean";

      // Some Realtime UPDATE payloads may omit fields depending on replication identity;
      // fall back to a server reconciliation to keep the bell dot accurate.
      if (!oldHasFlags || !newHasFlags) {
        console.warn("[RealtimeManager] UPDATE payload missing flags; requesting counts reconcile", {
          oldHasFlags,
          newHasFlags,
        });
        this.requestCountsReconcile();
        return;
      }
    }

    const oldCounted = oldNotif ? isUnreadCounted(oldNotif) : false;
    const newCounted = newNotif ? isUnreadCounted(newNotif) : false;

    console.log("[RealtimeManager] applyCountsFromRealtime:", {
      eventType,
      oldCounted,
      newCounted,
      oldIsRead: oldNotif?.is_read,
      newIsRead: newNotif?.is_read,
      oldIsArchived: oldNotif?.is_archived,
      newIsArchived: newNotif?.is_archived,
    });

    if (eventType === "INSERT" && newNotif && newCounted) {
      console.log("[RealtimeManager] INSERT: incrementing count for new unread notification");
      this.applyCountsDelta(deltaForCategory(getNotificationCategory(newNotif.type), +1));
      return;
    }

    if (eventType === "DELETE" && oldNotif && oldCounted) {
      console.log("[RealtimeManager] DELETE: decrementing count for deleted unread notification");
      this.applyCountsDelta(deltaForCategory(getNotificationCategory(oldNotif.type), -1));
      return;
    }

    if (eventType === "UPDATE" && (oldNotif || newNotif)) {
      if (oldNotif && newNotif) {
        const oldCategory = getNotificationCategory(oldNotif.type);
        const newCategory = getNotificationCategory(newNotif.type);

        if (oldCounted && !newCounted) {
          console.log("[RealtimeManager] UPDATE: notification marked as read/archived, decrementing");
          this.applyCountsDelta(deltaForCategory(oldCategory, -1));
          return;
        }

        if (!oldCounted && newCounted) {
          console.log("[RealtimeManager] UPDATE: notification became unread, incrementing");
          this.applyCountsDelta(deltaForCategory(newCategory, +1));
          return;
        }

        if (oldCounted && newCounted && oldCategory !== newCategory) {
          console.log("[RealtimeManager] UPDATE: notification changed category");
          this.applyCountsDelta({
            ...deltaForCategory(oldCategory, -1),
            ...deltaForCategory(newCategory, +1),
          });
        }
      }
    }
  }

  /**
   * Save counts to localStorage for persistence across page navigation
   */
  private saveCountsToStorage(counts: NotificationCounts): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("notification-counts", JSON.stringify(counts));
    } catch (error) {
      console.error("[RealtimeManager] Failed to save counts to localStorage:", error);
    }
  }

  /**
   * Load counts from localStorage
   */
  private loadCountsFromStorage(): NotificationCounts | null {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem("notification-counts");
      if (!stored) return null;
      return JSON.parse(stored) as NotificationCounts;
    } catch (error) {
      console.error("[RealtimeManager] Failed to load counts from localStorage:", error);
      return null;
    }
  }

  cleanup(): void {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
    this.userId = null;
    this.subscriptions.clear();
    this.countSubscriptions.clear();
    this.newNotificationListeners.clear();
    this.changeSubscriptions.clear();
    // DON'T clear currentCounts - it should persist across page navigation
    // this.currentCounts = null;
    if (this.countsReconcileTimer) {
      clearTimeout(this.countsReconcileTimer);
      this.countsReconcileTimer = null;
    }
    if (this.broadcastThrottleTimer) {
      clearTimeout(this.broadcastThrottleTimer);
      this.broadcastThrottleTimer = null;
    }
    this.pendingBroadcast = null;
  }
}

export const realtimeManager = new RealtimeManager();

// ==================== Utilities ====================

/**
 * Get cached notifications with fallback to API
 */
export async function getCachedOrFetchNotifications({
  category,
  unreadOnly = false,
  limit = 20,
  offset = 0,
  search,
  useCache = true,
}: {
  category?: NotificationCategory;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  useCache?: boolean;
} = {}): Promise<NotificationUI[]> {
  if (!search) {
    // Only cache if not searching
    const cacheKey = `notifications:${category ?? "all"}:${unreadOnly}:${limit}:${offset}`;
    if (useCache) {
      const cached = notificationCache.get<NotificationUI[]>(cacheKey);
      if (cached) return cached;
    }

    const response = await fetchNotifications({
      category,
      unreadOnly,
      limit,
      offset,
    });

    const uiNotifications = response.notifications.map((n) =>
      transformToUINotification(n)
    );

    notificationCache.set(cacheKey, uiNotifications, 2 * 60 * 1000); // 2 minutes
    return uiNotifications;
  }

  // Don't cache search results
  const response = await fetchNotifications({
    category,
    unreadOnly,
    limit,
    offset,
    search,
  });

  return response.notifications.map((n) => transformToUINotification(n));
}

/**
 * Get cached counts with fallback to API
 */
export async function getCachedOrFetchCounts(
  useCache = true
): Promise<NotificationCounts> {
  const cacheKey = "counts";

  if (useCache) {
    const cached = notificationCache.get<NotificationCounts>(cacheKey);
    if (cached) return cached;
  }

  const counts = await fetchNotificationCounts();
  notificationCache.set(cacheKey, counts, 1 * 60 * 1000); // 1 minute

  return counts;
}

/**
 * Fetch the latest notification counts, refresh the cache, and notify subscribers.
 */
export async function refreshNotificationCounts(): Promise<NotificationCounts> {
  const counts = await fetchNotificationCounts();
  const cacheKey = "counts";
  notificationCache.set(cacheKey, counts, 1 * 60 * 1000);
  realtimeManager.broadcastCounts(counts, true);
  return counts;
}

function isUnreadCounted(notification: Notification): boolean {
  return !notification.is_read && !notification.is_archived;
}

function deltaForCategory(
  category: NotificationCategory,
  delta: number
): Partial<NotificationCounts> {
  switch (category) {
    case NotificationCategory.MESSAGES:
      return { total: delta, messages: delta };
    case NotificationCategory.WORLD:
      return { total: delta, world: delta };
    case NotificationCategory.COMMUNITY:
      return { total: delta, community: delta };
    case NotificationCategory.SOCIAL:
      return { total: delta, social: delta };
    default:
      return { total: delta };
  }
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

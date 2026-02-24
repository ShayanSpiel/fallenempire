/**
 * Notification System Type Definitions
 * All types are synchronized with the database schema
 */

// ==================== Enums ====================

/**
 * Notification categories for grouping in UI
 */
export enum NotificationCategory {
  MESSAGES = "messages",
  WORLD = "world",
  COMMUNITY = "community",
  SOCIAL = "social",
}

/**
 * All possible notification types from database
 * Maps to CHECK constraint in notifications table
 */
export enum NotificationType {
  // Messages
  DIRECT_MESSAGE = "direct_message",
  GROUP_MESSAGE = "group_message",

  // World/Governance
  LAW_PROPOSAL = "law_proposal",
  HEIR_PROPOSAL = "heir_proposal",
  GOVERNANCE_CHANGE = "governance_change",
  WAR_DECLARATION = "war_declaration",
  ANNOUNCEMENT = "announcement",

  // Community - Law Lifecycle
  LAW_PASSED = "law_passed",
  LAW_REJECTED = "law_rejected",
  LAW_EXPIRED = "law_expired",

  // Community - Governance Changes
  KING_CHANGED = "king_changed",
  KING_LEFT = "king_left",
  HEIR_APPOINTED = "heir_appointed",
  SECRETARY_APPOINTED = "secretary_appointed",
  SECRETARY_REMOVED = "secretary_removed",

  // Community - Revolution & Civil War
  REVOLUTION_STARTED = "revolution_started",
  CIVIL_WAR_STARTED = "civil_war_started",

  // Community - Battles
  BATTLE_STARTED = "battle_started",
  BATTLE_WON = "battle_won",
  BATTLE_LOST = "battle_lost",
  BATTLE_MOMENTUM = "battle_momentum",
  BATTLE_DISARRAY = "battle_disarray",
  BATTLE_EXHAUSTION = "battle_exhaustion",
  BATTLE_RAGE = "battle_rage",

  // Community - General
  COMMUNITY_UPDATE = "community_update",

  // Social (future - needs DB triggers)
  FOLLOW_REQUEST = "follow_request",
  COMMUNITY_INVITE = "community_invite",
  FOLLOW_ACCEPTED = "follow_accepted",

  // Mentions
  MENTION = "mention",

  // Social - Feed interactions
  POST_COMMENT = "post_comment",
  POST_LIKE = "post_like",
  POST_DISLIKE = "post_dislike",

  // Feed summary
  FEED_SUMMARY = "feed_summary",
}

/**
 * Notification read/archived status
 */
export enum NotificationStatus {
  UNREAD = "unread",
  READ = "read",
  ARCHIVED = "archived",
}

// ==================== Core Types ====================

/**
 * Database representation of a notification
 * Mirrors the notifications table schema
 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;

  // Polymorphic references
  direct_message_id?: string | null;
  group_message_id?: string | null;
  proposal_id?: string | null;
  community_id?: string | null;
  battle_id?: string | null;
  mentioned_by_user_id?: string | null;
  triggered_by_user_id?: string | null;

  // Metadata and navigation
  metadata?: Record<string, unknown> | null;
  action_url?: string | null;

  // Status
  is_read: boolean;
  is_archived: boolean;
  read_at?: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Notification with computed properties for UI
 */
export interface NotificationUI extends Notification {
  category: NotificationCategory;
  timestamp: Date;
  relativeTime: string;
  isUnread: boolean;
  isArchived: boolean;
}

/**
 * Unread counts grouped by category
 */
export interface NotificationCounts {
  total: number;
  messages: number;
  world: number;
  community: number;
  social: number;
  lastNotificationAt?: string;
}

/**
 * Paginated notification list response
 */
export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * Grouped notification display (by date)
 */
export interface GroupedNotifications {
  label: string; // "Today", "Yesterday", "Last 7 days"
  date: Date;
  notifications: NotificationUI[];
}

/**
 * API request/response for batch operations
 */
export interface NotificationBatchAction {
  ids: string[];
  action: "read" | "unread" | "archive" | "delete";
}

/**
 * Real-time subscription payload from Supabase
 */
export interface NotificationRealtimePayload {
  id: string;
  new?: Notification;
  old?: Notification;
  eventType: "INSERT" | "UPDATE" | "DELETE";
}

// ==================== Type Guards & Helpers ====================

/**
 * Determine category from notification type
 */
export function getNotificationCategory(
  type: NotificationType
): NotificationCategory {
  const categoryMap: Record<NotificationType, NotificationCategory> = {
    // Messages
    [NotificationType.DIRECT_MESSAGE]: NotificationCategory.MESSAGES,
    [NotificationType.GROUP_MESSAGE]: NotificationCategory.MESSAGES,

    // World
    [NotificationType.LAW_PROPOSAL]: NotificationCategory.WORLD,
    [NotificationType.HEIR_PROPOSAL]: NotificationCategory.WORLD,
    [NotificationType.GOVERNANCE_CHANGE]: NotificationCategory.WORLD,
    [NotificationType.WAR_DECLARATION]: NotificationCategory.WORLD,
    [NotificationType.ANNOUNCEMENT]: NotificationCategory.WORLD,
    [NotificationType.FEED_SUMMARY]: NotificationCategory.WORLD,

    // Community
    [NotificationType.LAW_PASSED]: NotificationCategory.COMMUNITY,
    [NotificationType.LAW_REJECTED]: NotificationCategory.COMMUNITY,
    [NotificationType.LAW_EXPIRED]: NotificationCategory.COMMUNITY,
    [NotificationType.KING_CHANGED]: NotificationCategory.COMMUNITY,
    [NotificationType.KING_LEFT]: NotificationCategory.COMMUNITY,
    [NotificationType.HEIR_APPOINTED]: NotificationCategory.COMMUNITY,
    [NotificationType.SECRETARY_APPOINTED]: NotificationCategory.COMMUNITY,
    [NotificationType.SECRETARY_REMOVED]: NotificationCategory.COMMUNITY,
    [NotificationType.REVOLUTION_STARTED]: NotificationCategory.COMMUNITY,
    [NotificationType.CIVIL_WAR_STARTED]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_STARTED]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_WON]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_LOST]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_MOMENTUM]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_DISARRAY]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_EXHAUSTION]: NotificationCategory.COMMUNITY,
    [NotificationType.BATTLE_RAGE]: NotificationCategory.COMMUNITY,
    [NotificationType.COMMUNITY_UPDATE]: NotificationCategory.COMMUNITY,

    // Social
    [NotificationType.MENTION]: NotificationCategory.SOCIAL,
    [NotificationType.FOLLOW_REQUEST]: NotificationCategory.SOCIAL,
    [NotificationType.COMMUNITY_INVITE]: NotificationCategory.SOCIAL,
    [NotificationType.FOLLOW_ACCEPTED]: NotificationCategory.SOCIAL,
    [NotificationType.POST_COMMENT]: NotificationCategory.SOCIAL,
    [NotificationType.POST_LIKE]: NotificationCategory.SOCIAL,
    [NotificationType.POST_DISLIKE]: NotificationCategory.SOCIAL,
  };

  return categoryMap[type] ?? NotificationCategory.WORLD;
}

/**
 * Type guard for checking if notification is a message
 */
export function isMessageNotification(
  notification: Notification
): notification is Notification & {
  direct_message_id?: string;
  group_message_id?: string;
} {
  return (
    notification.type === NotificationType.DIRECT_MESSAGE ||
    notification.type === NotificationType.GROUP_MESSAGE
  );
}

/**
 * Type guard for checking if notification is a governance action
 */
export function isGovernanceNotification(
  notification: Notification
): notification is Notification & { proposal_id?: string } {
  return (
    notification.type === NotificationType.LAW_PROPOSAL ||
    notification.type === NotificationType.HEIR_PROPOSAL ||
    notification.type === NotificationType.GOVERNANCE_CHANGE
  );
}

/**
 * Type guard for checking if notification is a social request
 */
export function isSocialNotification(
  notification: Notification
): notification is Notification {
  return (
    notification.type === NotificationType.FOLLOW_REQUEST ||
    notification.type === NotificationType.COMMUNITY_INVITE
  );
}

export const SOCIAL_ACTIVITY_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.MENTION,
  NotificationType.FOLLOW_REQUEST,
  NotificationType.COMMUNITY_INVITE,
  NotificationType.FOLLOW_ACCEPTED,
  NotificationType.POST_COMMENT,
  NotificationType.POST_LIKE,
  NotificationType.POST_DISLIKE,
];

export function isSocialActivityNotification(
  notification: Notification
): boolean {
  return SOCIAL_ACTIVITY_NOTIFICATION_TYPES.includes(notification.type);
}

export function isBattleProposalNotification(
  notification: Notification
): boolean {
  return (
    notification.type === NotificationType.LAW_PROPOSAL &&
    notification.metadata?.law_type === "DECLARE_WAR"
  );
}

export function isWorldTabNotification(notification: Notification): boolean {
  return (
    isSocialActivityNotification(notification) ||
    isBattleProposalNotification(notification) ||
    notification.type === NotificationType.WAR_DECLARATION ||
    notification.type === NotificationType.REVOLUTION_STARTED ||
    notification.type === NotificationType.CIVIL_WAR_STARTED ||
    notification.type === NotificationType.BATTLE_STARTED
  );
}

/**
 * Type guard for checking if notification has inline actions
 */
export function hasInlineActions(notification: Notification): boolean {
  return isSocialNotification(notification);
}

/**
 * Get icon name for notification type (for use with icon library)
 */
export function getNotificationIcon(type: NotificationType): string {
  const iconMap: Record<NotificationType, string> = {
    [NotificationType.DIRECT_MESSAGE]: "Mail",
    [NotificationType.GROUP_MESSAGE]: "Mail",
    [NotificationType.LAW_PROPOSAL]: "FileText",
    [NotificationType.HEIR_PROPOSAL]: "Crown",
    [NotificationType.GOVERNANCE_CHANGE]: "Settings",
    [NotificationType.WAR_DECLARATION]: "Sword",
    [NotificationType.ANNOUNCEMENT]: "Bell",
    [NotificationType.LAW_PASSED]: "Check",
    [NotificationType.LAW_REJECTED]: "X",
    [NotificationType.LAW_EXPIRED]: "Clock",
    [NotificationType.KING_CHANGED]: "Crown",
    [NotificationType.KING_LEFT]: "LogOut",
    [NotificationType.HEIR_APPOINTED]: "Crown",
    [NotificationType.SECRETARY_APPOINTED]: "UserCheck",
    [NotificationType.SECRETARY_REMOVED]: "UserMinus",
    [NotificationType.REVOLUTION_STARTED]: "Flame",
    [NotificationType.CIVIL_WAR_STARTED]: "Swords",
    [NotificationType.BATTLE_STARTED]: "Sword",
    [NotificationType.BATTLE_WON]: "Trophy",
    [NotificationType.BATTLE_LOST]: "Skull",
    [NotificationType.BATTLE_MOMENTUM]: "Zap",
    [NotificationType.BATTLE_DISARRAY]: "AlertTriangle",
    [NotificationType.BATTLE_EXHAUSTION]: "BatteryLow",
    [NotificationType.BATTLE_RAGE]: "Flame",
    [NotificationType.COMMUNITY_UPDATE]: "Building2",
    [NotificationType.MENTION]: "AtSign",
    [NotificationType.FOLLOW_REQUEST]: "UserPlus",
    [NotificationType.COMMUNITY_INVITE]: "UserCheck",
    [NotificationType.FOLLOW_ACCEPTED]: "UserCheck",
    [NotificationType.POST_COMMENT]: "MessageCircle",
    [NotificationType.POST_LIKE]: "Heart",
    [NotificationType.POST_DISLIKE]: "ThumbsDown",
    [NotificationType.FEED_SUMMARY]: "Bell",
  };

  return iconMap[type];
}

/**
 * Get human-readable label for notification type
 */
export function getNotificationTypeLabel(type: NotificationType): string {
  const labelMap: Record<NotificationType, string> = {
    [NotificationType.DIRECT_MESSAGE]: "Direct Message",
    [NotificationType.GROUP_MESSAGE]: "Group Message",
    [NotificationType.LAW_PROPOSAL]: "Law Proposal",
    [NotificationType.HEIR_PROPOSAL]: "Heir Proposal",
    [NotificationType.GOVERNANCE_CHANGE]: "Governance Change",
    [NotificationType.WAR_DECLARATION]: "War Declaration",
    [NotificationType.ANNOUNCEMENT]: "Announcement",
    [NotificationType.LAW_PASSED]: "Law Passed",
    [NotificationType.LAW_REJECTED]: "Law Rejected",
    [NotificationType.LAW_EXPIRED]: "Law Expired",
    [NotificationType.KING_CHANGED]: "King Changed",
    [NotificationType.KING_LEFT]: "King Left",
    [NotificationType.HEIR_APPOINTED]: "Heir Appointed",
    [NotificationType.SECRETARY_APPOINTED]: "Secretary Appointed",
    [NotificationType.SECRETARY_REMOVED]: "Secretary Removed",
    [NotificationType.REVOLUTION_STARTED]: "Revolution Started",
    [NotificationType.CIVIL_WAR_STARTED]: "Civil War Started",
    [NotificationType.BATTLE_STARTED]: "Battle Started",
    [NotificationType.BATTLE_WON]: "Battle Won",
    [NotificationType.BATTLE_LOST]: "Battle Lost",
    [NotificationType.BATTLE_MOMENTUM]: "Momentum",
    [NotificationType.BATTLE_DISARRAY]: "Disarray",
    [NotificationType.BATTLE_EXHAUSTION]: "Exhaustion",
    [NotificationType.BATTLE_RAGE]: "Vengeance Rage",
    [NotificationType.COMMUNITY_UPDATE]: "Community Update",
    [NotificationType.MENTION]: "Mention",
    [NotificationType.FOLLOW_REQUEST]: "Follow Request",
    [NotificationType.COMMUNITY_INVITE]: "Community Invite",
    [NotificationType.FOLLOW_ACCEPTED]: "Follow Accepted",
    [NotificationType.POST_COMMENT]: "Comment",
    [NotificationType.POST_LIKE]: "Like",
    [NotificationType.POST_DISLIKE]: "Dislike",
    [NotificationType.FEED_SUMMARY]: "Feed Summary",
  };

  return labelMap[type];
}

/**
 * Get badge variant for notification type
 */
export function getNotificationBadgeVariant(
  type: NotificationType
): "default" | "accent" | "success" | "warning" | "destructive" {
  // Governance types
  if (
    type === NotificationType.LAW_PROPOSAL ||
    type === NotificationType.HEIR_PROPOSAL ||
    type === NotificationType.GOVERNANCE_CHANGE
  ) {
    return "accent";
  }
  // Positive community events
  if (
    type === NotificationType.LAW_PASSED ||
    type === NotificationType.HEIR_APPOINTED ||
    type === NotificationType.SECRETARY_APPOINTED ||
    type === NotificationType.BATTLE_WON ||
    type === NotificationType.BATTLE_MOMENTUM
  ) {
    return "success";
  }
  // Negative community events
  if (
    type === NotificationType.LAW_REJECTED ||
    type === NotificationType.LAW_EXPIRED ||
    type === NotificationType.SECRETARY_REMOVED ||
    type === NotificationType.KING_LEFT ||
    type === NotificationType.BATTLE_LOST
  ) {
    return "destructive";
  }
  // Warning/high priority community events
  if (
    type === NotificationType.REVOLUTION_STARTED ||
    type === NotificationType.CIVIL_WAR_STARTED ||
    type === NotificationType.BATTLE_STARTED ||
    type === NotificationType.BATTLE_DISARRAY ||
    type === NotificationType.BATTLE_EXHAUSTION ||
    type === NotificationType.BATTLE_RAGE ||
    type === NotificationType.WAR_DECLARATION ||
    type === NotificationType.KING_CHANGED
  ) {
    return "warning";
  }
  // Social types
  if (
    type === NotificationType.FOLLOW_REQUEST ||
    type === NotificationType.COMMUNITY_INVITE
  ) {
    return "success";
  }
  if (type === NotificationType.POST_LIKE) return "success";
  if (type === NotificationType.POST_DISLIKE) return "destructive";
  if (type === NotificationType.POST_COMMENT) return "accent";
  return "default";
}

/**
 * Format timestamp to relative time string
 */
export function getRelativeTime(date: Date | string, referenceTime?: Date | number): string {
  const now =
    referenceTime instanceof Date
      ? referenceTime
      : referenceTime
      ? new Date(referenceTime)
      : new Date();
  const notificationDate = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - notificationDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return notificationDate.toLocaleDateString();
}

/**
 * Group notifications by date
 */
export function groupNotificationsByDate(
  notifications: NotificationUI[]
): GroupedNotifications[] {
  const groups: Map<string, NotificationUI[]> = new Map();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  notifications.forEach((notif) => {
    const notifDate = new Date(notif.created_at);
    const notifDateOnly = new Date(
      notifDate.getFullYear(),
      notifDate.getMonth(),
      notifDate.getDate()
    );

    let groupKey: string;
    if (notifDateOnly.getTime() === today.getTime()) {
      groupKey = "today";
    } else if (notifDateOnly.getTime() === yesterday.getTime()) {
      groupKey = "yesterday";
    } else if (notifDate > weekAgo) {
      groupKey = "last-7-days";
    } else {
      groupKey = notifDateOnly.toISOString().split("T")[0];
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(notif);
  });

  // Convert to array with labels
  const result: GroupedNotifications[] = [];
  const keyOrder = ["today", "yesterday", "last-7-days"];

  keyOrder.forEach((key) => {
    if (groups.has(key)) {
      const label =
        key === "today"
          ? "Today"
          : key === "yesterday"
            ? "Yesterday"
            : "Last 7 days";
      result.push({
        label,
        date: new Date(), // Approximate
        notifications: groups.get(key)!,
      });
    }
  });

  // Add remaining dates in reverse chronological order
  groups.forEach((notifs, key) => {
    if (!keyOrder.includes(key)) {
      result.push({
        label: new Date(key).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        date: new Date(key),
        notifications: notifs,
      });
    }
  });

  return result;
}

export const WORLD_EVENT_NOTIFICATION_TYPES = [
  NotificationType.WAR_DECLARATION,
  NotificationType.GOVERNANCE_CHANGE,
  NotificationType.LAW_PROPOSAL,
  NotificationType.HEIR_PROPOSAL,
  NotificationType.ANNOUNCEMENT,
  NotificationType.KING_CHANGED,
  NotificationType.KING_LEFT,
  NotificationType.REVOLUTION_STARTED,
  NotificationType.CIVIL_WAR_STARTED,
  NotificationType.BATTLE_STARTED,
];

export const COMMUNITY_EVENT_NOTIFICATION_TYPES = [
  NotificationType.COMMUNITY_UPDATE,
  NotificationType.LAW_PASSED,
  NotificationType.LAW_REJECTED,
  NotificationType.LAW_EXPIRED,
  NotificationType.KING_CHANGED,
  NotificationType.KING_LEFT,
  NotificationType.HEIR_APPOINTED,
  NotificationType.SECRETARY_APPOINTED,
  NotificationType.SECRETARY_REMOVED,
  NotificationType.REVOLUTION_STARTED,
  NotificationType.CIVIL_WAR_STARTED,
  NotificationType.BATTLE_STARTED,
  NotificationType.BATTLE_WON,
  NotificationType.BATTLE_LOST,
  NotificationType.BATTLE_MOMENTUM,
  NotificationType.BATTLE_DISARRAY,
  NotificationType.BATTLE_EXHAUSTION,
  NotificationType.BATTLE_RAGE,
];

/**
 * Transform database notification to UI notification with computed properties
 */
export function transformToUINotification(
  notification: Notification
): NotificationUI {
  const timestamp = new Date(notification.created_at);
  return {
    ...notification,
    category: getNotificationCategory(notification.type),
    timestamp,
    relativeTime: getRelativeTime(timestamp),
    isUnread: !notification.is_read,
    isArchived: notification.is_archived,
  };
}

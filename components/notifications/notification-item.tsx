"use client";

import { FC, ReactNode } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { Check } from "lucide-react";
import { NotificationUI, getNotificationIcon, getNotificationBadgeVariant } from "@/lib/types/notifications";
import { borders, layout } from "@/lib/design-system";
import { Badge } from "@/components/ui/badge";

interface NotificationItemProps {
  notification: NotificationUI;
  onMarkAsRead?: (id: string) => void;
  onArchive?: (id: string) => void;
  actions?: ReactNode; // For inline action buttons (Social tab)
  isHovering?: boolean;
}

export const NotificationItem: FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onArchive,
  actions,
  isHovering,
}) => {
  const canMarkAsRead = !!onMarkAsRead && notification.isUnread;

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking actions
    if (actions && (e.target as HTMLElement).closest("[data-notification-actions]")) {
      return;
    }

    onMarkAsRead?.(notification.id);
  };

  const handleNavigate = () => {
    onMarkAsRead?.(notification.id);
  };

  // Get icon style based on notification type using design system colors
  const getIconStyle = (type: string): React.CSSProperties => {
    // All notification types use accent color from design system
    // This ensures 100% consistency with the app theme
    return {
      color: "var(--accent)",
      backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)"
    };
  };

  const NotificationContent = (
    <div className="flex gap-3 w-full min-w-0 p-3">
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="flex items-center justify-center rounded-lg w-9 h-9 transition-transform hover:scale-110"
          style={getIconStyle(notification.type)}
        >
          {(() => {
            const iconName = getNotificationIcon(notification.type);
            const IconComponent = Icons[iconName as keyof typeof Icons] as any;
            return IconComponent ? (
              <IconComponent size={18} className="transition-colors" style={{ color: "var(--accent)" }} />
            ) : null;
          })()}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Title and Badge */}
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-tight truncate" style={{ color: "var(--card-foreground)" }}>
            {notification.title}
          </h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {notification.isUnread && (
              <div
                className="w-2.5 h-2.5 rounded-full shadow-sm"
                style={{ backgroundColor: "var(--accent)" }}
              />
            )}
            {canMarkAsRead && (
              <button
                type="button"
                data-notification-actions
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMarkAsRead?.(notification.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-accent/10"
                title="Mark as read"
                aria-label="Mark as read"
              >
                <Check size={14} className="text-accent" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {notification.body && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            {notification.body}
          </p>
        )}

        {/* Footer: Timestamp and Type Badge */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)", opacity: "0.7" }}>
            {notification.relativeTime}
          </span>
          <Badge
            variant={getNotificationBadgeVariant(notification.type)}
            className="text-xs font-medium px-2 py-0.5"
          >
            {notification.type.split("_").join(" ")}
          </Badge>
        </div>
      </div>
    </div>
  );

  const resolveActionUrl = (actionUrl?: string | null) => {
    if (!actionUrl) return null;
    let path = actionUrl;
    try {
      if (actionUrl.startsWith("http")) {
        const url = new URL(actionUrl);
        path = `${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      path = actionUrl;
    }

    if (!path.startsWith("/communities/")) return path;

    const [basePath, queryString] = path.split("?");
    const segments = basePath.split("/").filter(Boolean);
    const slug = segments[1];
    const tab = segments[2];
    const params = new URLSearchParams(queryString ?? "");
    const validTabs = new Set([
      "home",
      "governance",
      "politics",
      "ideology",
      "military",
      "economy",
    ]);

    if (tab && validTabs.has(tab)) {
      params.set("tab", tab);
    }

    const query = params.toString();
    return `/community/${slug}${query ? `?${query}` : ""}`;
  };

  const actionUrl = resolveActionUrl(notification.action_url);

  // If has action_url, wrap in link
  if (actionUrl) {
    return (
      <Link
        href={actionUrl}
        onClick={handleNavigate}
        className="group flex flex-col transition-colors"
      >
        <div
          className={`border-l-2 transition-all ${
            notification.isUnread
              ? "border-accent bg-accent/5"
              : "border-transparent hover:bg-secondary"
          }`}
          style={
            notification.isUnread
              ? {
                  backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)",
                }
              : {}
          }
        >
          {NotificationContent}
        </div>
        {actions && (
          <div
            data-notification-actions
            className="px-3 pb-2 border-t border-dashed"
            style={{ borderColor: `var(--border)` }}
          >
            {actions}
          </div>
        )}
      </Link>
    );
  }

  // No action_url, render as regular item
  return (
    <div
      className="group flex flex-col transition-colors hover:bg-secondary"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        className={`border-l-2 transition-all ${
          notification.isUnread
            ? "border-accent bg-accent/5"
            : "border-transparent"
        }`}
        style={
          notification.isUnread
            ? {
                backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)",
              }
            : {}
        }
      >
        {NotificationContent}
      </div>
      {actions && (
        <div
          data-notification-actions
          className="px-3 pb-2 border-t border-dashed"
          style={{ borderColor: `var(--border)` }}
        >
          {actions}
        </div>
      )}
    </div>
  );
};

export default NotificationItem;

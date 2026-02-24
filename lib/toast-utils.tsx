/**
 * Toast styling utilities for consistent notification design
 * Uses Sonner toast library with design system tokens from app/globals.css
 * All colors use CSS custom properties for proper theme support
 */

import type React from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Crown,
  Gavel,
  Sword,
  Users,
  Megaphone,
  TrendingUp,
  Mail,
  Heart,
  Ban,
  X,
  Plane,
} from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  description?: React.ReactNode;
  duration?: number;
}

// Icon components using design system colors via CSS variables
const toastIcons = {
  success: (
    <div className="flex items-center justify-center w-5 h-5 rounded-full" style={{
      backgroundColor: "color-mix(in srgb, var(--success) 15%, transparent)"
    }}>
      <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success)" }} />
    </div>
  ),
  error: (
    <div className="flex items-center justify-center w-5 h-5 rounded-full" style={{
      backgroundColor: "color-mix(in srgb, var(--destructive) 15%, transparent)"
    }}>
      <AlertTriangle className="w-4 h-4" style={{ color: "var(--destructive)" }} />
    </div>
  ),
  warning: (
    <div className="flex items-center justify-center w-5 h-5 rounded-full" style={{
      backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)"
    }}>
      <AlertCircle className="w-4 h-4" style={{ color: "var(--warning)" }} />
    </div>
  ),
  info: (
    <div className="flex items-center justify-center w-5 h-5 rounded-full" style={{
      backgroundColor: "color-mix(in srgb, var(--info) 15%, transparent)"
    }}>
      <Info className="w-4 h-4" style={{ color: "var(--info)" }} />
    </div>
  ),
};

// CSS variable-based styling for different toast types
// These use the design system colors defined in globals.css
const toastClasses = {
  success: "group",
  error: "group",
  warning: "group",
  info: "group",
};

/**
 * Show a success toast notification
 * Uses design system success color (--success)
 */
export function showSuccessToast(message: string, options?: ToastOptions) {
  return toast.success(message, {
    icon: toastIcons.success,
    duration: options?.duration || 3500,
    description: options?.description,
    className: toastClasses.success,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--success)",
    } as React.CSSProperties,
  });
}

/**
 * Show an error toast notification
 * Uses design system destructive color (--destructive)
 */
export function showErrorToast(message: string, options?: ToastOptions) {
  return toast.error(message, {
    icon: toastIcons.error,
    duration: options?.duration || 4000,
    description: options?.description,
    className: toastClasses.error,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--destructive)",
    } as React.CSSProperties,
  });
}

/**
 * Show a warning toast notification
 * Uses design system warning color (--warning)
 */
export function showWarningToast(message: string, options?: ToastOptions) {
  return toast.warning(message, {
    icon: toastIcons.warning,
    duration: options?.duration || 3500,
    description: options?.description,
    className: toastClasses.warning,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--warning)",
    } as React.CSSProperties,
  });
}

/**
 * Show an info toast notification
 * Uses design system info color (--info)
 */
export function showInfoToast(message: string, options?: ToastOptions) {
  return toast.info(message, {
    icon: toastIcons.info,
    duration: options?.duration || 3000,
    description: options?.description,
    className: toastClasses.info,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--info)",
    } as React.CSSProperties,
  });
}

/**
 * Show a location-required error toast
 * Used when user must be in specific location to perform action
 */
export function showTravelRequiredToast(options: {
  title?: string;
  description: string;
  href?: string;
  duration?: number;
}) {
  const {
    title = "Travel required",
    description,
    href = "/map",
    duration = 10000,
  } = options;

  return showErrorToast(title, {
    duration,
    description: (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex-1 min-w-0 truncate">{description}</span>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap"
        >
          <Plane className="h-3 w-3" />
          <span>Travel</span>
        </a>
      </span>
    ),
  });
}

/**
 * Show location-based access error with community name
 * Unified toast for all location-restricted operations (market, jobs, exchange)
 */
export function showLocationAccessError(options: {
  communityName: string;
  action: "purchase" | "sell" | "apply" | "trade" | "create" | "work";
  href?: string;
}) {
  const { communityName, action, href = "/map" } = options;

  const actionMessages = {
    purchase: `Purchase items from ${communityName} market`,
    sell: `Sell items in ${communityName} market`,
    apply: `Apply to jobs in ${communityName}`,
    trade: `Trade ${communityName} currency`,
    create: `Create listings in ${communityName}`,
    work: `Work at companies in ${communityName}`,
  };

  const title = `Must be in ${communityName} territory`;
  const actionMessage = actionMessages[action] || `Perform actions in ${communityName}`;

  return showTravelRequiredToast({
    title,
    description: `Travel to ${communityName} territory to ${actionMessage.toLowerCase()}.`,
    href,
    duration: 8000,
  });
}

/**
 * Specialized context-specific toasts
 */

/**
 * Show a governance-related toast (laws, proposals, etc.)
 * Uses design system accent color with secondary emphasis
 */
export function showGovernanceToast(
  message: string,
  type: "success" | "error" = "success"
) {
  const icon = (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.25rem",
      height: "1.25rem",
      borderRadius: "50%",
      backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)"
    }}>
      <Gavel className="w-4 h-4" style={{ color: "var(--accent)" }} />
    </div>
  );

  const toastStyle = {
    background: "var(--card)",
    color: "var(--card-foreground)",
    border: "1px solid var(--border)",
    borderLeft: `3px solid var(--${type === "success" ? "accent" : "destructive"})`,
  } as React.CSSProperties;

  if (type === "success") {
    return toast.success(message, {
      icon,
      duration: 4000,
      style: toastStyle,
    });
  } else {
    return toast.error(message, {
      icon,
      duration: 4000,
      style: toastStyle,
    });
  }
}

/**
 * Show a military-related toast (wars, battles, etc.)
 * Uses design system destructive color for emphasis
 */
export function showMilitaryToast(
  message: string,
  type: "success" | "error" = "success"
) {
  const icon = (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.25rem",
      height: "1.25rem",
      borderRadius: "50%",
      backgroundColor: "color-mix(in srgb, var(--destructive) 15%, transparent)"
    }}>
      <Sword className="w-4 h-4" style={{ color: "var(--destructive)" }} />
    </div>
  );

  const toastStyle = {
    background: "var(--card)",
    color: "var(--card-foreground)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid var(--destructive)",
  } as React.CSSProperties;

  if (type === "success") {
    return toast.success(message, {
      icon,
      duration: 4000,
      style: toastStyle,
    });
  } else {
    return toast.error(message, {
      icon,
      duration: 4000,
      style: toastStyle,
    });
  }
}

/**
 * Show a community-related toast (joins, leaves, etc.)
 * Uses design system accent color
 */
export function showCommunityToast(
  message: string,
  type: "success" | "error" = "success"
) {
  const icon = (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.25rem",
      height: "1.25rem",
      borderRadius: "50%",
      backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)"
    }}>
      <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
    </div>
  );

  const toastStyle = {
    background: "var(--card)",
    color: "var(--card-foreground)",
    border: "1px solid var(--border)",
    borderLeft: `3px solid var(--${type === "success" ? "accent" : "destructive"})`,
  } as React.CSSProperties;

  if (type === "success") {
    return toast.success(message, {
      icon,
      duration: 4000,
      style: toastStyle,
    });
  } else {
    return toast.error(message, {
      icon,
      duration: 4000,
      style: toastStyle,
    });
  }
}

/**
 * Show an announcement toast
 * Uses design system warning color for visibility
 */
export function showAnnounceToast(message: string) {
  const icon = (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.25rem",
      height: "1.25rem",
      borderRadius: "50%",
      backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)"
    }}>
      <Megaphone className="w-4 h-4" style={{ color: "var(--warning)" }} />
    </div>
  );

  return toast.info(message, {
    icon,
    duration: 5000,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--warning)",
    } as React.CSSProperties,
  });
}

/**
 * Show a like notification toast
 * Uses design system success color
 */
export function showLikeToast(message: string, username?: string) {
  const fullMessage = username ? `${username} liked your post` : message;

  return showSuccessToast(fullMessage, {
    description: message,
    duration: 3000,
  });
}

/**
 * Show a dislike notification toast
 * Uses design system destructive color
 */
export function showDislikeToast(message: string, username?: string) {
  const fullMessage = username ? `${username} disliked your post` : message;

  return showErrorToast(fullMessage, {
    description: message,
    duration: 3000,
  });
}

/**
 * Show a comment notification toast
 * Uses design system info color
 */
export function showCommentToast(message: string, username?: string, preview?: string) {
  const fullMessage = username ? `${username} commented on your post` : message;

  return showInfoToast(fullMessage, {
    description: preview || message,
    duration: 3500,
  });
}

/**
 * Show a follow notification toast
 * Uses design system accent color
 */
export function showFollowToast(message: string, username?: string) {
  const fullMessage = username ? `${username} started following you` : message;

  const icon = (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "1.25rem",
      height: "1.25rem",
      borderRadius: "50%",
      backgroundColor: "color-mix(in srgb, var(--success) 15%, transparent)"
    }}>
      <Users className="w-4 h-4" style={{ color: "var(--success)" }} />
    </div>
  );

  return toast.success(fullMessage, {
    icon,
    description: message,
    duration: 3500,
    style: {
      background: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderLeft: "3px solid var(--success)",
    } as React.CSSProperties,
  });
}

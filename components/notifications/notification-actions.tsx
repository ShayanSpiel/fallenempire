"use client";

import { FC, useState } from "react";
import { Check, X, Archive } from "lucide-react";
import { Notification, NotificationType } from "@/lib/types/notifications";
import {
  acceptSocialRequest,
  rejectSocialRequest,
  markNotificationAsRead,
  archiveNotification,
} from "@/lib/services/notification-service";
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils";
import { Button } from "@/components/ui/button";

interface NotificationActionProps {
  notification: Notification;
  onSuccess?: () => void;
  variant?: "inline" | "compact"; // inline for dropdown, compact for page
}

/**
 * Social request inline actions (Accept/Reject)
 */
export const SocialRequestActions: FC<NotificationActionProps> = ({
  notification,
  onSuccess,
  variant = "inline",
}) => {
  const [loading, setLoading] = useState(false);

  const requestType =
    notification.type === NotificationType.FOLLOW_REQUEST ? "follow" : "invite";

  const handleAccept = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await acceptSocialRequest(notification.id, requestType);
      showSuccessToast(`${requestType} request accepted`);
      onSuccess?.();
    } catch (error) {
      showErrorToast(`Failed to accept ${requestType} request`);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await rejectSocialRequest(notification.id, requestType);
      showSuccessToast(`${requestType} request rejected`);
      onSuccess?.();
    } catch (error) {
      showErrorToast(`Failed to reject ${requestType} request`);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "inline") {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleAccept}
          disabled={loading}
          className="text-xs"
        >
          <Check size={14} className="mr-1" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReject}
          disabled={loading}
          className="text-xs text-destructive"
        >
          <X size={14} className="mr-1" />
          Reject
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleAccept}
        disabled={loading}
        className="flex-1"
        variant="default"
      >
        <Check size={16} className="mr-2" />
        Accept
      </Button>
      <Button
        onClick={handleReject}
        disabled={loading}
        className="flex-1"
        variant="outline"
      >
        <X size={16} className="mr-2" />
        Reject
      </Button>
    </div>
  );
};

/**
 * Read/Archive actions for dropdown
 */
export const DropdownNotificationActions: FC<{
  notification: Notification;
  onMarkAsRead?: () => void;
  onArchive?: () => void;
}> = ({ notification, onMarkAsRead, onArchive }) => {
  const [loading, setLoading] = useState(false);

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await markNotificationAsRead(notification.id);
      onMarkAsRead?.();
    } catch (error) {
      showErrorToast("Failed to mark as read");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await archiveNotification(notification.id);
      onArchive?.();
    } catch (error) {
      showErrorToast("Failed to archive notification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      {notification.is_read === false && (
        <button
          onClick={handleMarkAsRead}
          disabled={loading}
          className="p-1 hover:bg-secondary rounded transition-colors"
          title="Mark as read"
        >
          <Check size={14} />
        </button>
      )}
      <button
        onClick={handleArchive}
        disabled={loading}
        className="p-1 hover:bg-secondary rounded transition-colors"
        title="Archive"
      >
        <Archive size={14} />
      </button>
    </div>
  );
};

export default SocialRequestActions;

"use client";

import { FC } from "react";
import { Bell, MessageCircle, Globe, Users, Search } from "lucide-react";
import { NotificationCategory } from "@/lib/types/notifications";
import { layout } from "@/lib/design-system";

interface EmptyStateProps {
  category?: NotificationCategory;
  isSearching?: boolean;
}

export const EmptyState: FC<EmptyStateProps> = ({
  category,
  isSearching,
}) => {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <Search
          className="opacity-30 mb-3"
          size={24}
        />
        <h3 className="text-sm font-medium mb-1">No results found</h3>
        <p className="text-xs text-muted-foreground">
          Try adjusting your search terms
        </p>
      </div>
    );
  }

  const getIcon = () => {
    switch (category) {
      case NotificationCategory.MESSAGES:
        return <MessageCircle className="opacity-30 mb-3" size={24} />;
      case NotificationCategory.WORLD:
        return <Globe className="opacity-30 mb-3" size={24} />;
      case NotificationCategory.SOCIAL:
        return <Users className="opacity-30 mb-3" size={24} />;
      default:
        return <Bell className="opacity-30 mb-3" size={24} />;
    }
  };

  const emptyStateConfig: Record<
    NotificationCategory | "all",
    { title: string; description: string }
  > = {
    all: {
      title: "No notifications yet",
      description: "You're all caught up! Notifications will appear here.",
    },
    [NotificationCategory.MESSAGES]: {
      title: "No messages",
      description: "You'll receive notifications when someone sends you a message.",
    },
    [NotificationCategory.WORLD]: {
      title: "No world events",
      description: "Governance proposals and announcements will appear here.",
    },
    [NotificationCategory.COMMUNITY]: {
      title: "No community updates",
      description: "Community activities and updates will appear here.",
    },
    [NotificationCategory.SOCIAL]: {
      title: "No social requests",
      description: "Follow requests and invites will appear here.",
    },
  };

  const config = emptyStateConfig[category ?? "all"];

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {getIcon()}
      <h3 className="text-sm font-medium mb-1">{config.title}</h3>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        {config.description}
      </p>
    </div>
  );
};

export default EmptyState;

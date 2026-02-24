"use client";

import { FC, useState, useMemo } from "react";
import { Filter } from "lucide-react";
import { NotificationCategory, NotificationUI, NotificationType } from "@/lib/types/notifications";
import { NotificationList } from "../notification-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface SocialTabProps {
  notifications: NotificationUI[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMarkAsRead?: (id: string) => void;
  onMarkManyAsRead?: (ids: string[]) => Promise<void> | void;
  onArchive?: (id: string) => void;
}

type SocialFilter = "all" | "follows" | "invites" | "mentions";

export const SocialTab: FC<SocialTabProps> = ({
  notifications,
  loading = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onMarkManyAsRead,
  onArchive,
}) => {
  const [filter, setFilter] = useState<SocialFilter>("all");

  // Filter notifications
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "follows") {
        return [
          NotificationType.FOLLOW_REQUEST,
          NotificationType.FOLLOW_ACCEPTED,
        ].includes(n.type);
      }
      if (filter === "invites") {
        return n.type === NotificationType.COMMUNITY_INVITE;
      }
      if (filter === "mentions") {
        return n.type === NotificationType.MENTION;
      }
      return (
        [
          NotificationType.FOLLOW_REQUEST,
          NotificationType.FOLLOW_ACCEPTED,
          NotificationType.COMMUNITY_INVITE,
          NotificationType.MENTION,
          NotificationType.POST_COMMENT,
          NotificationType.POST_LIKE,
          NotificationType.POST_DISLIKE,
        ].includes(n.type)
      );
    });
  }, [notifications, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter Controls */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Social
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Filter size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={filter === "all"}
              onCheckedChange={() => setFilter("all")}
            >
              All
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "follows"}
              onCheckedChange={() => setFilter("follows")}
            >
              Follow Requests
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "invites"}
              onCheckedChange={() => setFilter("invites")}
            >
              Community Invites
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "mentions"}
              onCheckedChange={() => setFilter("mentions")}
            >
              Mentions
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <NotificationList
          notifications={filtered}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          onMarkAsRead={onMarkAsRead}
          onMarkManyAsRead={onMarkManyAsRead}
          onArchive={onArchive}
          category={NotificationCategory.SOCIAL}
        />
      </div>
    </div>
  );
};

export default SocialTab;

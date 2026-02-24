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

interface MessagesTabProps {
  notifications: NotificationUI[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMarkAsRead?: (id: string) => void;
  onMarkManyAsRead?: (ids: string[]) => Promise<void> | void;
  onArchive?: (id: string) => void;
}

type MessageFilter = "all" | "direct" | "group";

export const MessagesTab: FC<MessagesTabProps> = ({
  notifications,
  loading = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onMarkManyAsRead,
  onArchive,
}) => {
  const [filter, setFilter] = useState<MessageFilter>("all");

  // Filter notifications
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "direct") return n.type === NotificationType.DIRECT_MESSAGE;
      if (filter === "group") return n.type === NotificationType.GROUP_MESSAGE;
      return (
        n.type === NotificationType.DIRECT_MESSAGE ||
        n.type === NotificationType.GROUP_MESSAGE
      );
    });
  }, [notifications, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter Controls */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Messages
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
              All Messages
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "direct"}
              onCheckedChange={() => setFilter("direct")}
            >
              Direct Messages
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "group"}
              onCheckedChange={() => setFilter("group")}
            >
              Group Chats
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
          category={NotificationCategory.MESSAGES}
        />
      </div>
    </div>
  );
};

export default MessagesTab;

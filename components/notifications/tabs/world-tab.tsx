"use client";

import { FC, useState, useMemo } from "react";
import { Filter } from "lucide-react";
import {
  NotificationCategory,
  NotificationUI,
  NotificationType,
  isBattleProposalNotification,
  isSocialActivityNotification,
  isWorldTabNotification,
} from "@/lib/types/notifications";
import { NotificationList } from "../notification-list";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface WorldTabProps {
  notifications: NotificationUI[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMarkAsRead?: (id: string) => void;
  onMarkManyAsRead?: (ids: string[]) => Promise<void> | void;
  onArchive?: (id: string) => void;
}

type WorldFilter = "all" | "proposals" | "revolutions" | "battles" | "social";

export const WorldTab: FC<WorldTabProps> = ({
  notifications,
  loading = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onMarkManyAsRead,
  onArchive,
}) => {
  const [filter, setFilter] = useState<WorldFilter>("all");

  // Filter notifications
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "proposals") {
        return (
          isBattleProposalNotification(n) ||
          n.type === NotificationType.WAR_DECLARATION
        );
      }
      if (filter === "revolutions") {
        return [
          NotificationType.REVOLUTION_STARTED,
          NotificationType.CIVIL_WAR_STARTED,
        ].includes(n.type);
      }
      if (filter === "battles") {
        return [NotificationType.BATTLE_STARTED].includes(n.type);
      }
      if (filter === "social") {
        return isSocialActivityNotification(n);
      }
      return isWorldTabNotification(n);
    });
  }, [notifications, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter Controls */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          World Events
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
              All Events
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "proposals"}
              onCheckedChange={() => setFilter("proposals")}
            >
              Battle Proposals
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "revolutions"}
              onCheckedChange={() => setFilter("revolutions")}
            >
              Revolutions
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "battles"}
              onCheckedChange={() => setFilter("battles")}
            >
              Battle Attacks
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "social"}
              onCheckedChange={() => setFilter("social")}
            >
              Social
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
          category={NotificationCategory.WORLD}
        />
      </div>
    </div>
  );
};

export default WorldTab;

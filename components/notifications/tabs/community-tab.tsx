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

interface CommunityTabProps {
  notifications: NotificationUI[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onMarkAsRead?: (id: string) => void;
  onMarkManyAsRead?: (ids: string[]) => Promise<void> | void;
  onArchive?: (id: string) => void;
}

type CommunityFilter = "all" | "laws" | "governance" | "battles" | "conflicts";

export const CommunityTab: FC<CommunityTabProps> = ({
  notifications,
  loading = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onMarkManyAsRead,
  onArchive,
}) => {
  const [filter, setFilter] = useState<CommunityFilter>("all");

  // Filter notifications
  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "laws") {
        return [
          NotificationType.LAW_PASSED,
          NotificationType.LAW_REJECTED,
          NotificationType.LAW_EXPIRED,
        ].includes(n.type);
      }
      if (filter === "governance") {
        return [
          NotificationType.KING_CHANGED,
          NotificationType.KING_LEFT,
          NotificationType.HEIR_APPOINTED,
          NotificationType.SECRETARY_APPOINTED,
          NotificationType.SECRETARY_REMOVED,
        ].includes(n.type);
      }
      if (filter === "battles") {
        return [NotificationType.BATTLE_STARTED].includes(n.type);
      }
      if (filter === "conflicts") {
        return [
          NotificationType.REVOLUTION_STARTED,
          NotificationType.CIVIL_WAR_STARTED,
        ].includes(n.type);
      }
      return true;
    });
  }, [notifications, filter]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter Controls */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">
          Community Events
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
              checked={filter === "laws"}
              onCheckedChange={() => setFilter("laws")}
            >
              Laws & Proposals
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "governance"}
              onCheckedChange={() => setFilter("governance")}
            >
              Leadership Changes
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "battles"}
              onCheckedChange={() => setFilter("battles")}
            >
              Battles & Wars
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={filter === "conflicts"}
              onCheckedChange={() => setFilter("conflicts")}
            >
              Revolutions & Civil Wars
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
          category={NotificationCategory.COMMUNITY}
        />
      </div>
    </div>
  );
};

export default CommunityTab;

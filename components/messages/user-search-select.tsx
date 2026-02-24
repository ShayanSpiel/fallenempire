"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveAvatar } from "@/lib/avatar";
import { spacing, typography, transitions, semanticColors, borders, componentSpacing } from "@/lib/design-system";

export type SelectedUser = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

interface UserSearchSelectProps {
  onUsersSelected: (users: SelectedUser[]) => void;
  maxUsers?: number;
  isLoading?: boolean;
  placeholder?: string;
  excludeUserIds?: string[];
}

export function UserSearchSelect({
  onUsersSelected,
  maxUsers = 1,
  isLoading = false,
  placeholder = "Search users...",
  excludeUserIds = [],
}: UserSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [searchResults, setSearchResults] = useState<SelectedUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/users/search?q=${encodeURIComponent(query.trim())}&limit=10`
      );
      const data = await response.json();

      // Filter out already selected users and excluded users
      const selectedIds = selectedUsers.map((u) => u.id);
      const allExcludedIds = new Set([...selectedIds, ...excludeUserIds]);
      const users = Array.isArray(data) ? data : (data.users || []);
      const filtered = users.filter(
        (user: SelectedUser) => !allExcludedIds.has(user.id)
      );

      setSearchResults(filtered);
      setShowResults(filtered.length > 0);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedUsers, excludeUserIds]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleSelectUser = (user: SelectedUser) => {
    if (selectedUsers.length < maxUsers) {
      const newSelected = [...selectedUsers, user];
      setSelectedUsers(newSelected);
      onUsersSelected(newSelected);
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);

      // Auto-focus search for next user if max not reached
      if (newSelected.length < maxUsers) {
        // Focus would happen via ref in real implementation
      }
    }
  };

  const handleRemoveUser = (userId: string) => {
    const newSelected = selectedUsers.filter((u) => u.id !== userId);
    setSelectedUsers(newSelected);
    onUsersSelected(newSelected);
  };

  const canAddMore = selectedUsers.length < maxUsers;

  return (
    <div className="space-y-3">
      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <Badge
              key={user.id}
              variant="default"
              className="flex items-center gap-1 px-3 py-1"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={resolveAvatar({
                    avatarUrl: user.avatar_url,
                    seed: user.username ?? "User",
                  })}
                />
                <AvatarFallback>{user.username?.[0]}</AvatarFallback>
              </Avatar>
              <span className={typography.bodySm.size}>{user.username}</span>
              <button
                onClick={() => handleRemoveUser(user.id)}
                className="hover:opacity-70 transition-opacity"
              >
                <X size={14} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
            disabled={!canAddMore || isLoading}
            className="pl-10"
          />
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <Card
            variant="subtle"
            className={cn(
              "absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto p-1 border",
              borders.subtle
            )}
          >
            <div className="space-y-1">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left rounded-md",
                    transitions.fast,
                    "hover:bg-muted/50"
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage
                      src={resolveAvatar({
                        avatarUrl: user.avatar_url,
                        seed: user.username ?? "User",
                      })}
                    />
                    <AvatarFallback>{user.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn(typography.headingSm.size, typography.headingSm.weight, "truncate")}>
                      {user.username}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* No Results Message */}
        {showResults && searchResults.length === 0 && !isSearching && searchQuery.trim() && (
          <Card
            variant="subtle"
            className={cn(
              "absolute top-full left-0 right-0 z-50 mt-1 p-4 border text-center",
              borders.subtle
            )}
          >
            <p className={cn(typography.bodySm.size, semanticColors.text.secondary)}>
              No users found
            </p>
          </Card>
        )}
      </div>

      {/* Helper Text */}
      {selectedUsers.length > 0 && maxUsers > 1 && canAddMore && (
        <p className={cn(typography.bodySm.size, semanticColors.text.secondary)}>
          {maxUsers - selectedUsers.length} more {maxUsers - selectedUsers.length === 1 ? "person" : "people"} can be added
        </p>
      )}

      {!canAddMore && selectedUsers.length > 0 && (
        <p className={cn(typography.bodySm.size, "text-warning")}>
          Maximum {maxUsers} {maxUsers === 1 ? "user" : "users"} selected
        </p>
      )}
    </div>
  );
}

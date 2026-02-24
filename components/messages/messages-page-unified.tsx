"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Users, Info, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveAvatar } from "@/lib/avatar";
import { UserSearchSelect, type SelectedUser } from "@/components/messages/user-search-select";
import { H1, H3, Meta, P } from "@/components/ui/typography";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Badge } from "@/components/ui/badge";
import { transitions, borders } from "@/lib/design-system";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Conversation = {
  userId?: string;
  groupId?: string;
  username?: string | null;
  name?: string;
  avatar_url?: string | null;
  lastMessage: string;
  lastMessageTime: string;
  isFromYou: boolean;
  type: "1to1" | "group" | "ai";
  participantCount?: number;
};

type MessagesPageUnifiedProps = {
  currentUserId: string;
  currentUsername: string | null;
  currentAvatarUrl: string | null;
  conversations: Conversation[];
};

export function MessagesPageUnified({
  currentUserId,
  conversations: initialConversations,
}: MessagesPageUnifiedProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [conversationsList, setConversationsList] = useState<Conversation[]>(initialConversations);
  const [composerKey, setComposerKey] = useState(0);

  const buildGroupName = (users: SelectedUser[]) => {
    const names = users.map((user) => user.username).filter(Boolean) as string[];
    if (names.length > 0) {
      return names.join(", ");
    }
    return "Group chat";
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const truncateMessage = (msg: string, length: number = 50) => {
    return msg.length > length ? `${msg.substring(0, length)}...` : msg;
  };

  const handleStartConversation = async () => {
    if (!selectedUsers.length) return;

    setIsStartingChat(true);
    try {
      if (selectedUsers.length === 1) {
        const userId = selectedUsers[0].id;
        router.push(`/messages/${userId}`);
        return;
      }

      const response = await fetch("/api/group-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: groupName.trim() || buildGroupName(selectedUsers),
          participantIds: [currentUserId, ...selectedUsers.map((u) => u.id)],
          isAiEnabled: false,
        }),
      });

      const data = await response.json();

      if (response.ok && data.group) {
        router.push(`/messages/group/${data.group.id}`);
      } else {
        console.error("Failed to create group:", data.error || data?.message);
      }
    } catch (error) {
      console.error("Failed to start conversation:", error);
    } finally {
      setIsStartingChat(false);
      setGroupName("");
      setSelectedUsers([]);
      setComposerKey((prev) => prev + 1);
    }
  };

  // Subscribe to real-time message updates
  useEffect(() => {
    let isMounted = true;

    const channel = supabase
      .channel(`direct_messages_changes:${currentUserId}`, {
        config: { broadcast: { self: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `or(sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId})`,
        },
        async (payload: any) => {
          if (!isMounted || !payload?.new) return;
          const newMessage = payload.new;
          const otherUserId =
            newMessage.sender_id === currentUserId
              ? newMessage.recipient_id
              : newMessage.sender_id;

          const { data: otherUser } = await supabase
            .from("users")
            .select("id, username, avatar_url, is_bot")
            .eq("id", otherUserId)
            .maybeSingle();

          if (!otherUser) return;

          setConversationsList((prev) => {
            const existingIndex = prev.findIndex((conv) => conv.userId === otherUserId);

            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                lastMessage: newMessage.content,
                lastMessageTime: newMessage.created_at,
                isFromYou: newMessage.sender_id === currentUserId,
              };
              return [updated[existingIndex], ...updated.slice(0, existingIndex), ...updated.slice(existingIndex + 1)];
            } else {
              const newConversation: Conversation = {
                userId: otherUserId,
                username: otherUser.username,
                avatar_url: otherUser.avatar_url,
                lastMessage: newMessage.content,
                lastMessageTime: newMessage.created_at,
                isFromYou: newMessage.sender_id === currentUserId,
                type: otherUser.is_bot ? "ai" : "1to1",
              };
              return [newConversation, ...prev];
            }
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, supabase]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className={cn("border-b", borders.subtle, "bg-background")}>
        <div className="mx-auto w-full px-[var(--layout-horizontal-padding)] py-6 lg:py-8">
          <div className="space-y-1">
            <H1>Messages</H1>
            <P className="max-w-2xl text-muted-foreground/80">
              Start a direct or group conversation from one place.
            </P>
          </div>
        </div>
      </div>

      {/* New Conversation */}
      <div className={cn("border-b", borders.subtle, "bg-background")}>
        <div className="mx-auto w-full px-[var(--layout-horizontal-padding)] py-5">
          <div className="space-y-4 px-6 py-6">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-muted-foreground" />
              <div className="flex items-center gap-1">
                <H3 className="!text-base">New conversation</H3>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info size={16} className="text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs text-foreground">
                      Add at least one person to start chatting.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start">
                <div className="flex-1 min-w-0">
                  <UserSearchSelect
                    key={composerKey}
                    onUsersSelected={setSelectedUsers}
                    maxUsers={50}
                    placeholder="Search users to add..."
                    excludeUserIds={[currentUserId]}
                    isLoading={isStartingChat}
                  />
                </div>
                <Button
                  onClick={handleStartConversation}
                  disabled={!selectedUsers.length || isStartingChat}
                  variant="follow"
                  size="lg"
                  className="w-full lg:w-[200px] xl:w-[240px] flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  {isStartingChat
                    ? "Starting..."
                    : selectedUsers.length > 1
                      ? "Create Group"
                      : "Add Message"}
                </Button>
              </div>
            </div>

            {selectedUsers.length > 1 && (
              <Input
                placeholder="Group name (optional)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            )}

            {selectedUsers.length > 0 && (
              <P className="text-sm text-muted-foreground mb-0">
                {selectedUsers.length === 1
                  ? "This will open a direct message."
                  : "This will create a group chat."}
              </P>
            )}
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversationsList.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 px-6 py-12">
            <Mail className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center space-y-1">
              <H3>No messages yet</H3>
              <P className="text-muted-foreground/70">
                Start a conversation from the search bar above.
              </P>
            </div>
          </div>
        ) : (
          <div className={cn("divide-y", borders.subtle)}>
            {conversationsList.map((conversation) => {
              const displayName =
                conversation.type === "group"
                  ? conversation.name
                  : conversation.username || "Unknown User";
              const href =
                conversation.type === "group"
                  ? `/messages/group/${conversation.groupId}`
                  : `/messages/${conversation.userId}`;

              return (
                <Link
                  key={conversation.groupId || conversation.userId}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-[var(--layout-horizontal-padding)] py-4",
                    transitions.fast,
                    "hover:bg-muted/50 active:bg-muted"
                  )}
                >
                  <Avatar className={cn("h-12 w-12 shrink-0", borders.default)}>
                    {conversation.type === "group" ? (
                      <div className={cn("h-full w-full bg-muted flex items-center justify-center", borders.default)}>
                        <Users size={20} className="text-muted-foreground" />
                      </div>
                    ) : (
                      <>
                        <AvatarImage
                          src={resolveAvatar({
                            avatarUrl: conversation.avatar_url,
                            seed: conversation.username ?? "User",
                          })}
                        />
                        <AvatarFallback>{conversation.username?.[0] ?? "?"}</AvatarFallback>
                      </>
                    )}
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <H3 className="truncate">{displayName}</H3>
                        {conversation.type === "group" && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {conversation.participantCount || 2}
                          </Badge>
                        )}
                        {conversation.type === "ai" && (
                          <Badge variant="secondary" className="text-xs shrink-0">AI</Badge>
                        )}
                      </div>
                      <Meta className="shrink-0">{formatTime(conversation.lastMessageTime)}</Meta>
                    </div>
                    <P className="text-muted-foreground truncate text-sm">
                      {conversation.isFromYou && <span className="font-semibold">You: </span>}
                      {truncateMessage(conversation.lastMessage)}
                    </P>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

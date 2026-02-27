"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Users, Settings, Plus, ImageIcon, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UserNameDisplay } from "@/components/ui/user-name-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { resolveAvatar } from "@/lib/avatar";
import { H3, Meta, P, Small } from "@/components/ui/typography";
import { UserSearchSelect, type SelectedUser } from "@/components/messages/user-search-select";
import { Badge } from "@/components/ui/badge";
import {
  typography,
  transitions,
  semanticColors,
  borders,
} from "@/lib/design-system";

// Type definition (was in _deprecated folder)
type DirectMessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { username: string };
};

type Participant = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  is_bot?: boolean;
  role?: "admin" | "member";
};

type ThreadMessage = {
  id: string;
  sender_id: string;
  recipient_id?: string;
  group_conversation_id?: string;
  content: string;
  created_at: string;
  sender?: Participant;
};

type MessageThreadUnifiedProps = {
  currentUserId: string;
  currentUsername: string | null;
  currentAvatarUrl: string | null;
  threadType: "1to1" | "group" | "ai"; // Thread type
  threadId: string; // otherUserId for 1to1/ai, groupId for group
  participants: Participant[]; // All participants in thread
  initialMessages: ThreadMessage[];
  threadName?: string;
};

function mapDirectToThreadMessage(
  directMessage: DirectMessageRow,
  participants: Participant[]
): ThreadMessage {
  const sender = (
    directMessage.sender ||
    participants.find((participant) => participant.id === directMessage.sender_id) || {
      id: directMessage.sender_id,
      username: null,
      avatar_url: null,
    }
  ) as Participant;

  // Infer recipient_id as the other participant (for 1-to-1 conversations)
  const recipient_id = participants.find((p) => p.id !== directMessage.sender_id)?.id;

  return {
    id: directMessage.id,
    sender_id: directMessage.sender_id,
    recipient_id,
    content: directMessage.content,
    created_at: directMessage.created_at,
    sender,
  };
}

export function MessageThreadUnified({
  currentUserId,
  currentUsername,
  currentAvatarUrl,
  threadType,
  threadId,
  participants,
  initialMessages,
  threadName,
}: MessageThreadUnifiedProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [threadParticipants, setThreadParticipants] = useState<Participant[]>(participants);
  const [pendingParticipants, setPendingParticipants] = useState<SelectedUser[]>([]);
  const [isUpdatingParticipants, setIsUpdatingParticipants] = useState(false);
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [participantSelectKey, setParticipantSelectKey] = useState(0);
  const [groupNameInput, setGroupNameInput] = useState(threadName ?? "");
  const [threadDisplayName, setThreadDisplayName] = useState(threadName ?? "Group chat");
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const participantsRef = useRef<Participant[]>(participants);
  useEffect(() => {
    participantsRef.current = threadParticipants;
  }, [threadParticipants]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const otherParticipant =
    threadType === "1to1" || threadType === "ai"
      ? threadParticipants.find((p) => p.id !== currentUserId)
      : null;

  const isGroupThread = threadType === "group";
  const canManageParticipants = threadType !== "ai";
  const currentParticipant = threadParticipants.find((participant) => participant.id === currentUserId);
  const isAdmin = isGroupThread && currentParticipant?.role === "admin";
  const composerRef = useRef<HTMLDivElement | null>(null);
  const showComposerActions = isComposerFocused || input.trim().length > 0;

  useEffect(() => {
    if (!showParticipants) {
      setPendingParticipants([]);
      setParticipantError(null);
      setParticipantSelectKey((prev) => prev + 1);
      setRenameError(null);
      setIsRenamingGroup(false);
    }
  }, [showParticipants]);

  useEffect(() => {
    setThreadDisplayName(threadName ?? "Group chat");
    setGroupNameInput(threadName ?? "");
  }, [threadName]);

  const handleRenameGroup = async () => {
    if (!isAdmin || isRenamingGroup) return;
    const trimmedName = groupNameInput.trim();
    if (!trimmedName) {
      setRenameError("Group name cannot be empty.");
      return;
    }

    setIsRenamingGroup(true);
    setRenameError(null);

    try {
      const response = await fetch("/api/group-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renameGroup",
          groupId: threadId,
          name: trimmedName,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setRenameError(data?.error || data?.message || "Failed to rename group.");
        return;
      }

      setThreadDisplayName(trimmedName);
      setGroupNameInput(trimmedName);
    } catch (error) {
      console.error("Failed to rename group:", error);
      setRenameError("Failed to rename group.");
    } finally {
      setIsRenamingGroup(false);
    }
  };

  const handleAddParticipants = async () => {
    if (!pendingParticipants.length || isUpdatingParticipants) return;

    setIsUpdatingParticipants(true);
    setParticipantError(null);

    try {
      if (isGroupThread) {
        const responses = await Promise.all(
          pendingParticipants.map((participant) =>
            fetch("/api/group-chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "addParticipant",
                groupId: threadId,
                userId: participant.id,
              }),
            })
          )
        );

        const payloads = await Promise.all(
          responses.map(async (response) => {
            try {
              return await response.json();
            } catch {
              return null;
            }
          })
        );

        const failedIndex = responses.findIndex((response) => !response.ok);
        if (failedIndex !== -1) {
          setParticipantError(payloads[failedIndex]?.error || payloads[failedIndex]?.message || "Failed to add participant.");
          return;
        }

        setThreadParticipants((prev) => {
          const existingIds = new Set(prev.map((participant) => participant.id));
          const additions = pendingParticipants
            .filter((participant) => !existingIds.has(participant.id))
            .map((participant) => ({
              id: participant.id,
              username: participant.username,
              avatar_url: participant.avatar_url,
              role: "member" as const,
            }));
          return [...prev, ...additions];
        });

        setPendingParticipants([]);
        setParticipantSelectKey((prev) => prev + 1);
        return;
      }

      if (threadType === "1to1") {
        const participantIds = Array.from(
          new Set([currentUserId, threadId, ...pendingParticipants.map((participant) => participant.id)])
        );
        const nameParts = [
          otherParticipant?.username,
          ...pendingParticipants.map((participant) => participant.username),
        ].filter(Boolean) as string[];
        const name = nameParts.length > 0 ? nameParts.join(", ") : "Group chat";

        const response = await fetch("/api/group-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            name,
            participantIds,
            isAiEnabled: false,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.group) {
          setParticipantError(data?.error || data?.message || "Failed to create group.");
          return;
        }

        setPendingParticipants([]);
        setParticipantSelectKey((prev) => prev + 1);
        router.push(`/messages/group/${data.group.id}`);
      }
    } catch (error) {
      console.error("Failed to update participants:", error);
      setParticipantError("Failed to update participants.");
    } finally {
      setIsUpdatingParticipants(false);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if ((!isAdmin && participantId !== currentUserId) || isUpdatingParticipants) return;

    setIsUpdatingParticipants(true);
    setParticipantError(null);

    try {
      const response = await fetch("/api/group-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "removeParticipant",
          groupId: threadId,
          userId: participantId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setParticipantError(data?.error || data?.message || "Failed to remove participant.");
        return;
      }

      if (participantId === currentUserId) {
        router.push("/messages");
        return;
      }

      setThreadParticipants((prev) => prev.filter((participant) => participant.id !== participantId));
    } catch (error) {
      console.error("Failed to remove participant:", error);
      setParticipantError("Failed to remove participant.");
    } finally {
      setIsUpdatingParticipants(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [messages.length]);

  // Subscribe to new messages based on thread type
  useEffect(() => {
    let isMounted = true;
    let channel: any;

    if (threadType === "1to1" || threadType === "ai") {
      const channelName =
        threadType === "ai"
          ? `ai:${threadId}`
          : `dm:${[currentUserId, threadId].sort().join("-")}`;
      channel = supabase
        .channel(channelName, {
          config: { broadcast: { self: true } },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
            filter: `or(and(sender_id.eq.${currentUserId},recipient_id.eq.${threadId}),and(sender_id.eq.${threadId},recipient_id.eq.${currentUserId}))`,
          },
          (payload: any) => {
            if (!isMounted || !payload?.new) return;
            const threadMessage = mapDirectToThreadMessage(
              payload.new as DirectMessageRow,
              participantsRef.current
            );
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === threadMessage.id)) return prev;
              return [...prev, threadMessage];
            });
          }
        )
        .subscribe();
    } else if (threadType === "group") {
      channel = supabase
        .channel(`group:${threadId}`, {
          config: { broadcast: { self: true } },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "group_messages",
            filter: `group_conversation_id.eq.${threadId}`,
          },
          (payload: any) => {
            if (!isMounted || !payload?.new) return;
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();
    }

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUserId, threadId, threadType, supabase]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput("");
    setIsSending(true);

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: ThreadMessage = {
      id: tempId,
      sender_id: currentUserId,
      content: trimmed,
      created_at: new Date().toISOString(),
      sender: {
        id: currentUserId,
        username: currentUsername,
        avatar_url: currentAvatarUrl,
      },
    };

    if (threadType === "1to1") {
      optimisticMessage.recipient_id = threadId;
    } else if (threadType === "group") {
      optimisticMessage.group_conversation_id = threadId;
    }

    setMessages((prev) => [...prev, optimisticMessage]);
    if (threadType === "ai") {
      setIsAgentTyping(true);
    }

    try {
      const endpoint =
        threadType === "1to1"
          ? "/api/messages"
          : threadType === "group"
          ? "/api/group-chat"
          : "/api/chat/ai";

      const body =
        threadType === "1to1"
          ? { recipientId: threadId, content: trimmed }
          : threadType === "group"
          ? { action: "sendMessage", groupId: threadId, content: trimmed }
          : { agent_id: threadId, message: trimmed };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to send message:", data.error || response.statusText);
        setInput(trimmed);
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      } else {
        if (threadType === "ai") {
          const humanThreadMessage = data.human_message
            ? mapDirectToThreadMessage(
                data.human_message as DirectMessageRow,
                threadParticipants
              )
            : null;

          if (humanThreadMessage) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId
                  ? {
                      ...msg,
                      ...humanThreadMessage,
                    }
                  : msg
              )
            );
          }

          const agentThreadMessage = data.agent_message
            ? mapDirectToThreadMessage(
                data.agent_message as DirectMessageRow,
                threadParticipants
              )
            : null;

          if (agentThreadMessage) {
            setMessages((prev) => {
              if (prev.some((msg) => msg.id === agentThreadMessage.id)) {
                return prev;
              }
              return [...prev, agentThreadMessage];
            });
          } else if (data.agent_response) {
            const fallbackAgentMessage: ThreadMessage = {
              id: `agent-${Date.now()}`,
              sender_id: threadId,
              recipient_id: currentUserId,
              content: data.agent_response,
              created_at: new Date().toISOString(),
              sender: otherParticipant ?? undefined,
            };
            setMessages((prev) => [...prev, fallbackAgentMessage]);
          }
        } else {
          const messageData = data.message;
          if (messageData) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId
                  ? {
                      ...msg,
                      id: messageData.id,
                      created_at: messageData.created_at,
                    }
                  : msg
              )
            );
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setInput(trimmed);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setIsSending(false);
      setIsComposerFocused(true);
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      if (threadType === "ai") {
        setIsAgentTyping(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleComposerBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && composerRef.current?.contains(relatedTarget)) {
      return;
    }
    setIsComposerFocused(false);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const displayName =
    threadType === "group"
      ? threadDisplayName
      : otherParticipant?.username || "User";

  const isAiThread = threadType === "ai" || (otherParticipant?.is_bot === true);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className={cn("flex items-center justify-between border-b bg-background", borders.subtle, "px-[var(--layout-horizontal-padding)] py-4")}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link href="/messages" className={cn("text-muted-foreground hover:text-foreground", transitions.fast)}>
            <ArrowLeft size={20} />
          </Link>

          {threadType === "group" ? (
            <div className="flex items-center gap-2">
              <Users size={20} className="text-muted-foreground" />
              <div className="min-w-0">
                <H3 className="!text-base truncate">{displayName}</H3>
                <Small className="text-muted-foreground">{threadParticipants.length} participants</Small>
              </div>
            </div>
          ) : (
            <>
              <UserAvatar
                username={otherParticipant?.username ?? "User"}
                avatarUrl={otherParticipant?.avatar_url}
                size="md"
                className={cn("border shrink-0", borders.default)}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <H3 className="!text-base truncate">{displayName}</H3>
                  {isAiThread && <Badge variant="secondary" className="shrink-0 text-xs">AI</Badge>}
                </div>
                <Small className="text-muted-foreground">
                  <UserNameDisplay
                    username={otherParticipant?.username}
                    userTier={otherParticipant?.user_tier ?? "alpha"}
                    showLink={false}
                    badgeSize="xs"
                    className="text-xs"
                  />
                </Small>
              </div>
            </>
          )}
        </div>

        {canManageParticipants && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowParticipants(!showParticipants)}
            className="shrink-0"
          >
            {showParticipants ? <X size={20} /> : <Settings size={20} />}
          </Button>
        )}
      </div>

      {/* Participants sidebar */}
      {showParticipants && canManageParticipants && (
        <div className={cn("border-b", borders.subtle, "bg-background px-[var(--layout-horizontal-padding)] py-4")}>
          {isGroupThread ? (
            <div className="space-y-4">
              {isAdmin ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <Input
                      className="flex-1 min-w-0"
                      value={groupNameInput}
                      onChange={(e) => setGroupNameInput(e.target.value)}
                      placeholder="Group name"
                      disabled={isRenamingGroup}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRenameGroup}
                      disabled={isRenamingGroup || !groupNameInput.trim()}
                    >
                      {isRenamingGroup ? "Saving..." : "Change Name"}
                    </Button>
                  </div>
                  {renameError && (
                    <Small className="text-warning">{renameError}</Small>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <UserSearchSelect
                        key={participantSelectKey}
                        onUsersSelected={setPendingParticipants}
                        maxUsers={50}
                        placeholder="Add people to this group..."
                        excludeUserIds={threadParticipants.map((participant) => participant.id)}
                        isLoading={isUpdatingParticipants}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddParticipants}
                      disabled={!pendingParticipants.length || isUpdatingParticipants}
                      className="h-11 w-11 rounded-xl p-0 flex items-center justify-center"
                      aria-label="Add selected people"
                      title="Add selected people"
                    >
                      <Plus size={18} />
                    </Button>
                  </div>
                </div>
              ) : (
                <Small className="text-muted-foreground">
                  Only group admins can add or remove participants.
                </Small>
              )}

              {participantError && (
                <Small className="text-warning">{participantError}</Small>
              )}

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {threadParticipants.map((participant) => (
                  <div key={participant.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage
                        src={resolveAvatar({
                          avatarUrl: participant.avatar_url,
                          seed: participant.username ?? "User",
                        })}
                      />
                      <AvatarFallback>{participant.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Small className="font-semibold truncate">{participant.username}</Small>
                    </div>
                    {participant.role === "admin" && (
                      <Badge variant="secondary" className="text-xs shrink-0">Admin</Badge>
                    )}
                    {participant.id === currentUserId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveParticipant(participant.id)}
                        disabled={isUpdatingParticipants}
                      >
                        Leave
                      </Button>
                    ) : (
                      isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveParticipant(participant.id)}
                          disabled={isUpdatingParticipants}
                          title="Remove participant"
                        >
                          <X size={14} />
                        </Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start">
                <div className="flex-1 min-w-0">
                  <UserSearchSelect
                    key={participantSelectKey}
                    onUsersSelected={setPendingParticipants}
                    maxUsers={50}
                    placeholder="Add people to start a group chat..."
                    excludeUserIds={threadParticipants.map((participant) => participant.id)}
                    isLoading={isUpdatingParticipants}
                  />
                </div>
                <Button
                  onClick={handleAddParticipants}
                  disabled={!pendingParticipants.length || isUpdatingParticipants}
                  variant="follow"
                  size="lg"
                  className="w-full lg:w-[200px] xl:w-[240px] flex items-center justify-center gap-2"
                >
                  {isUpdatingParticipants ? "Creating..." : "Create Group"}
                </Button>
              </div>
              <Small className="text-muted-foreground">
                This will create a new group chat with everyone selected.
              </Small>
              {participantError && (
                <Small className="text-warning">{participantError}</Small>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-3xl px-[var(--layout-horizontal-padding)] py-6 flex flex-col gap-4">
            {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3 py-12">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                {threadType === "group" ? (
                  <Users className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <Avatar className={cn("h-full w-full border-2", borders.default)}>
                    <AvatarImage
                      src={resolveAvatar({
                        avatarUrl: otherParticipant?.avatar_url,
                        seed: otherParticipant?.username ?? "User",
                      })}
                    />
                    <AvatarFallback>{otherParticipant?.username?.[0]}</AvatarFallback>
                  </Avatar>
                )}
              </div>
              <div className="text-center space-y-1">
                <H3>Start a conversation</H3>
                <P className="text-muted-foreground/70 max-w-xs">
                  {threadType === "group"
                    ? `Chat with ${threadParticipants.length} participants`
                    : isAiThread
                    ? `Chat with AI agent @${displayName}`
                    : `Message @${displayName} to begin`}
                </P>
              </div>
            </div>
              ) : (
                <div className="space-y-4 mb-4">
              {messages.map((message) => {
                const isCurrentUser = message.sender_id === currentUserId;
                const senderInfo = message.sender || threadParticipants.find((p) => p.id === message.sender_id);

                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-2 items-start", isCurrentUser && "flex-row-reverse")}
                  >
                    <UserAvatar
                      username={isCurrentUser ? currentUsername : senderInfo?.username ?? "User"}
                      avatarUrl={isCurrentUser ? currentAvatarUrl : senderInfo?.avatar_url}
                      size="sm"
                      className={cn("border shrink-0 mt-0.5", borders.default)}
                    />

                    <div className={cn("flex flex-col gap-1 max-w-xs", isCurrentUser && "items-end")}>
                      {threadType === "group" && !isCurrentUser && (
                        <Small className={cn(semanticColors.text.secondary, "px-1")}>
                          <UserNameDisplay
                            username={senderInfo?.username}
                            userTier={senderInfo?.user_tier ?? "alpha"}
                            showLink={false}
                            badgeSize="xs"
                            className="text-xs"
                          />
                        </Small>
                      )}
                      <div
                        className={cn(
                          "px-3 py-2 rounded-lg break-words",
                          isCurrentUser
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted/60 text-foreground rounded-bl-sm"
                        )}
                      >
                        <p
                          className={cn(
                            typography.bodySm.size,
                            typography.bodySm.lineHeight,
                            "whitespace-pre-wrap"
                          )}
                        >
                          {message.content}
                        </p>
                      </div>
                      <Meta className={cn(semanticColors.text.secondary, "px-1 text-xs")}>
                        {formatTime(message.created_at)}
                      </Meta>
                    </div>
                  </div>
                );
              })}
              {threadType === "ai" && isAgentTyping && (
                <div className="flex items-center justify-start gap-2 px-4 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span>{otherParticipant?.username ?? "Agent"} is typing...</span>
                </div>
              )}
            </div>
          )}
          <div className="h-32 w-full" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        <div className="mx-auto w-full max-w-3xl px-[var(--layout-horizontal-padding)] pointer-events-auto pb-6">
          <div
            ref={composerRef}
            className={cn(
              "rounded-2xl border transition-all duration-300",
              showComposerActions ? "shadow-xl bg-card" : "shadow-sm bg-muted/70",
              showComposerActions ? borders.default : borders.subtle
            )}
          >
            <div className="flex items-start gap-4 p-4">
              <Avatar className={cn("h-10 w-10 rounded-full border border-border shadow-sm bg-card shrink-0", borders.default)}>
                <AvatarImage
                  src={resolveAvatar({
                    avatarUrl: currentAvatarUrl,
                    seed: currentUsername ?? "User",
                  })}
                />
                <AvatarFallback>{currentUsername?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsComposerFocused(true)}
                  onBlur={handleComposerBlur}
                  placeholder={isAiThread ? "Ask me anything..." : "Type a message... (Shift+Enter for new line)"}
                  className="w-full bg-transparent border-none placeholder:text-muted-foreground text-sm text-foreground resize-none focus-visible:ring-0 focus-visible:border-transparent min-h-[90px]"
                  maxLength={500}
                />
                <div
                  className={cn(
                    "flex items-center justify-between transition-all duration-300 overflow-hidden",
                    showComposerActions ? "opacity-100 max-h-12" : "opacity-0 max-h-0"
                  )}
                >
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      aria-label="Add media"
                    >
                      <ImageIcon size={18} />
                    </Button>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    onMouseDown={(event) => event.preventDefault()}
                    disabled={!input.trim() || isSending}
                    size="sm"
                    className="gap-2 px-4 font-semibold tracking-wide"
                  >
                    <span>Send</span>
                    <Rocket size={14} className={input.trim() ? "animate-pulse" : ""} />
                  </Button>
                </div>
                {input.length > 400 && (
                  <Meta className="text-warning px-4 pb-3">
                    {500 - input.length} characters remaining
                  </Meta>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

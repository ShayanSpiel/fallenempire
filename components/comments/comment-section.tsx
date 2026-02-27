"use client";

import { FormEvent, useEffect, useMemo, useState, useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import { Loader2, Send } from "lucide-react";
import type { RealtimePostgresInsertPayload } from "@supabase/realtime-js";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UserNameDisplay } from "@/components/ui/user-name-display";
import { resolveAvatar } from "@/lib/avatar";
import { IdentityLabel } from "@/components/ui/identity-label";
import { highlightMentions, detectTrigger, replaceAtPosition } from "@/lib/utils/mention-parser";
import { InlineAutocomplete } from "@/components/ui/inline-autocomplete";
import type { AutocompleteItem } from "@/components/ui/inline-autocomplete";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  is_agent: boolean;
  user: {
    id: string;
    username: string | null;
    identityLabel: string | null;
    avatarUrl?: string | null;
    userTier?: "alpha" | "sigma" | "omega" | null;
  } | null;
};

type CommentInsertRow = {
  id: string;
  content: string;
  created_at: string;
  is_agent: boolean;
  user_id: string | null;
  post_id: string;
};

type CommentSectionProps = {
  postId: string;
  viewerProfile: {
    id: string;
    username: string | null;
    identityLabel: string | null;
    avatarUrl?: string | null;
  };
  initialComments?: Comment[];
  feedContext?: "world" | "community" | "friends";
  communityId?: string | null;
};

export function CommentSection({
  postId,
  viewerProfile,
  initialComments = [],
  feedContext = "world",
  communityId = null,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Mention autocomplete state
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const [currentTrigger, setCurrentTrigger] = useState<'@' | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [users, setUsers] = useState<Array<{
    id: string;
    username: string;
    avatar_url: string | null;
  }>>([]);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    let isMounted = true;
    const fetchComments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/comments?postId=${postId}`);
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load comments");
        }
        const data = await response.json();
        if (isMounted) {
          setComments(data.comments ?? []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to fetch comments");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchComments();
    return () => {
      isMounted = false;
    };
  }, [postId]);

  // Load users for mention autocomplete
  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        let endpoint = "/api/users/search?q=";
        if (feedContext === "community") {
          endpoint = communityId
            ? `/api/users/community-members?communityId=${encodeURIComponent(communityId)}&q=`
            : "/api/users/community-members?q=";
        } else if (feedContext === "friends") {
          endpoint = "/api/users/following?q=";
        }

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to fetch users');

        const data = await response.json();
        if (isMounted) {
          setUsers(data || []);
        }
      } catch (error) {
        console.error('Failed to load users for mentions:', error);
      }
    }

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [communityId, feedContext]);

  // Handle input change with @mention detection
  const handleInputChange = useCallback((value: string) => {
    setContent(value);

    if (!inputRef.current) return;

    const trigger = detectTrigger(value, inputRef.current.selectionStart ?? 0);
    setCurrentTrigger(trigger.trigger as '@' | null);

    if (trigger.trigger === '@') {
      // Show users for mention
      const filtered = users.filter(u =>
        u.username.toLowerCase().includes(trigger.query.toLowerCase())
      ).slice(0, 6);

      const items: AutocompleteItem[] = filtered.map(user => ({
        id: user.id,
        label: `@${user.username}`,
        avatar: user.avatar_url || undefined,
      }));

      setAutocompleteItems(items);
      setAutocompleteOpen(items.length > 0);
      setAutocompleteSelectedIndex(0);
    } else {
      setAutocompleteOpen(false);
    }
  }, [users]);

  const handleAutocompleteSelect = useCallback((item: AutocompleteItem) => {
    if (!inputRef.current) return;

    const trigger = detectTrigger(content, inputRef.current.selectionStart ?? 0);
    if (!trigger.trigger) return;

    const replacement = item.label + ' ';
    const newText = replaceAtPosition(content, trigger.startIndex, trigger.endIndex, replacement);
    setContent(newText);
    setAutocompleteOpen(false);

    // Restore focus and position cursor
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      const newCursorPos = trigger.startIndex + replacement.length;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (autocompleteOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setAutocompleteSelectedIndex((prev) =>
          prev < autocompleteItems.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setAutocompleteSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      }
      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault();
        if (autocompleteItems[autocompleteSelectedIndex]) {
          handleAutocompleteSelect(autocompleteItems[autocompleteSelectedIndex]);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setAutocompleteOpen(false);
        return;
      }
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId, content: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to publish comment");
      }

      const data = await response.json();
      const newComment: Comment | undefined = data.comment;
      if (newComment) {
        setComments((prev) => {
          if (prev.some((existing) => existing.id === newComment.id)) {
            return prev;
          }
          return [...prev, newComment];
        });
        setContent("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to publish comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload: RealtimePostgresInsertPayload<CommentInsertRow>) => {
          let userData = null;
          if (payload.new.user_id) {
            const { data } = await supabase
              .from("users")
              .select("id, username, identity_label, avatar_url")
              .eq("id", payload.new.user_id)
              .single();
            userData = data;
          }

          const newComment: Comment = {
            id: payload.new.id,
            content: payload.new.content,
            created_at: payload.new.created_at,
            is_agent: payload.new.is_agent,
            user: userData
              ? {
                  id: userData.id,
                  username: userData.username,
                  identityLabel: userData.identity_label,
                  avatarUrl: userData.avatar_url ?? null,
                }
              : null,
          };

          setComments((prev) => {
            if (prev.some((existing) => existing.id === newComment.id)) {
              return prev;
            }
            return [...prev, newComment];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, supabase]);
  const commentCount = comments.length;

  return (
    <div className="space-y-3 text-sm">
      <div className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
        {commentCount} {commentCount === 1 ? "Comment" : "Comments"}
      </div>

      <div className="space-y-5 pl-4 border-l-2 border-border/50">
        {isLoading ? (
          <div className="space-y-4 py-4" aria-label="Loading comments" role="status">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-muted animate-pulse mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-2 w-10 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : commentCount === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No replies yet. Lead the dialogue.</p>
        ) : (
          comments.map((comment) => {
            const timeLabel = new Date(comment.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const usernameSlug = comment.user?.username?.trim();
          const profileUrl = usernameSlug ? `/profile/${encodeURIComponent(usernameSlug)}` : "/profile";
            return (
              <div
                key={comment.id}
                className="flex gap-3 items-start animate-in fade-in duration-500 group/comment"
              >
            <UserAvatar
              username={comment.user?.username ?? "guest"}
              avatarUrl={comment.user?.avatarUrl ?? null}
              size="xs"
              className="rounded-full mt-0.5 border border-border bg-card"
            />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <UserNameDisplay
                      username={comment.user?.username ?? "Unknown"}
                      userTier={comment.user?.userTier ?? "alpha"}
                      showLink={true}
                      badgeSize="xs"
                      className="text-xs font-bold text-foreground hover:underline"
                    />
                    <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
                  </div>
                  <IdentityLabel label={comment.user?.identityLabel} className="text-[10px]" />
                  <p className="text-[13px] text-foreground mt-0.5 leading-snug">
                    {(() => {
                      const parts = highlightMentions(comment.content);
                      return parts.map((part, idx) => {
                        if (typeof part === 'string') {
                          return <span key={idx}>{part}</span>;
                        }
                        return (
                          <Link
                            key={idx}
                            href={`/profile/${part.username}`}
                            className="text-primary hover:underline font-semibold"
                          >
                            @{part.username}
                          </Link>
                        );
                      });
                    })()}
                  </p>
                </div>
              </div>
            );
          })
        )}

        <form onSubmit={handleSubmit} className="pt-1">
          <div className="relative">
            <div className="flex items-center gap-3 border-b border-transparent pb-2 transition-colors focus-within:border-foreground">
              <Avatar className="h-8 w-8 rounded-full border border-border bg-card">
                <AvatarImage
                  src={resolveAvatar({
                    avatarUrl: viewerProfile.avatarUrl ?? null,
                    seed: viewerProfile.username ?? "viewer",
                  })}
                />
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
              <input
                ref={inputRef}
                className="flex-1 bg-transparent border-none outline-none placeholder:text-muted-foreground text-sm text-foreground py-1"
                placeholder="Write a reply..."
                value={content}
                onChange={(event) => handleInputChange(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={420}
              />
              <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
              >
                {isSubmitting ? (
                  <Loader2 className="size-3 animate-spin text-foreground" />
                ) : (
                  <Send className="size-3" />
                )}
              </button>
            </div>

            {/* Inline Autocomplete for @mentions */}
            {currentTrigger === '@' && (
              <InlineAutocomplete
                items={autocompleteItems}
                isOpen={autocompleteOpen}
                selectedIndex={autocompleteSelectedIndex}
                onSelect={handleAutocompleteSelect}
                onClose={() => setAutocompleteOpen(false)}
                trigger="@"
                maxItems={6}
              />
            )}
          </div>
          {error && <p className="pt-1 text-xs text-destructive">{error}</p>}
        </form>
      </div>
    </div>
  );
}

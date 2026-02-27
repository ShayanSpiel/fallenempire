'use client';

import { useEffect, useState, useCallback, useRef } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Small } from "@/components/ui/typography";
import { InlineAutocomplete } from "@/components/ui/inline-autocomplete";
import { Image as ImageIcon, Rocket } from "lucide-react";
import { resolveAvatar } from "@/lib/avatar";
import { useFeedContext } from "@/lib/feed-context";
import type { FeedPost } from "@/lib/feed";
import {
  detectTrigger,
  replaceAtPosition,
} from "@/lib/utils/mention-parser";
import type { AutocompleteItem } from "@/components/ui/inline-autocomplete";
import { getCaretCoordinates } from "@/lib/utils/get-caret-coordinates";

type PostComposerProps = {
  disabled?: boolean;
  viewerName?: string | null;
  viewerAvatarUrl?: string | null;
  viewerId?: string | null;
  viewerIdentityLabel?: string | null;
  viewerUserTier?: "alpha" | "sigma" | "omega" | null;
  feedContext?: "world" | "community" | "friends";
  communityId?: string | null; // Required when feedContext="community"
};

const POST_COOLDOWN_MS = 5 * 60 * 1000;

function formatCooldown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function PostComposer({
  disabled,
  viewerName,
  viewerAvatarUrl,
  viewerId,
  viewerIdentityLabel,
  viewerUserTier = "alpha",
  feedContext = "world",
  communityId = null,
}: PostComposerProps) {
  const { addPostToFeed, updatePost } = useFeedContext();
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPostTimestamp, setLastPostTimestamp] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  const [currentTrigger, setCurrentTrigger] = useState<'@' | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ top: number; left: number; height: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const needsCommunityId = feedContext === "community" && !communityId;

  // Fetch and cache users for mention autocomplete
  const [users, setUsers] = useState<Array<{
    id: string;
    username: string;
    avatar_url: string | null;
  }>>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        // Choose API endpoint based on feed context
        let endpoint = '/api/users/search?q=';
        if (feedContext === 'community') {
          endpoint = communityId
            ? `/api/users/community-members?communityId=${encodeURIComponent(communityId)}&q=`
            : '/api/users/community-members?q=';
        } else if (feedContext === 'friends') {
          endpoint = '/api/users/following?q=';
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

    if (!textareaRef.current) return;

    const trigger = detectTrigger(value, textareaRef.current.selectionStart ?? 0);
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

      // Calculate cursor position
      try {
        const coords = getCaretCoordinates(textareaRef.current, textareaRef.current.selectionStart ?? 0);
        setCursorCoords(coords);
      } catch (error) {
        console.error('Failed to get caret coordinates:', error);
        setCursorCoords(null);
      }
    } else {
      setAutocompleteOpen(false);
    }
  }, [users]);

  const handleAutocompleteSelect = useCallback((item: AutocompleteItem) => {
    if (!textareaRef.current) return;

    const trigger = detectTrigger(content, textareaRef.current.selectionStart ?? 0);
    if (!trigger.trigger) return;

    const replacement = item.label + ' ';
    const newText = replaceAtPosition(content, trigger.startIndex, trigger.endIndex, replacement);
    setContent(newText);
    setAutocompleteOpen(false);

    // Restore focus and position cursor
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const newCursorPos = trigger.startIndex + replacement.length;
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [content]);

  const handleSubmit = async () => {
    if (needsCommunityId) {
      setError("Select a community to post (open a community page).");
      return;
    }

    if (!content.trim()) {
      setError("Message cannot be empty");
      return;
    }

    const now = Date.now();
    if (lastPostTimestamp && now - lastPostTimestamp < POST_COOLDOWN_MS) {
      setError("Please wait before sending another post");
      return;
    }
    setError(null);
    const contentToPost = content.trim();
    const tempPostId = `temp-${Date.now()}-${Math.random()}`;

    // Create optimistic post immediately
    const optimisticPost: FeedPost = {
      id: tempPostId,
      content: contentToPost,
      createdAt: new Date().toISOString(),
      user: {
        id: viewerId ?? "unknown",
        username: viewerName ?? "You",
        identityLabel: viewerIdentityLabel ?? null,
        userTier: viewerUserTier ?? "alpha",
        isAgent: !!viewerId,
        avatarUrl: viewerAvatarUrl ?? null,
      },
      likeCount: 0,
      dislikeCount: 0,
      viewerReaction: null,
      initialComments: [],
      engagers: [],
      isPending: true,
    };

    // Add to feed IMMEDIATELY and clear input
    addPostToFeed(optimisticPost);
    setContent("");
    setIsFocused(false);
    setIsSubmitting(true);
    setLastPostTimestamp(now);

    let serverPostId: string | null = null;
    try {
      // Determine feed_type based on context
      const feed_type = feedContext === "community" ? "community" : feedContext === "friends" ? "followers" : "world";

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: contentToPost,
          feed_type,
          community_id: feedContext === "community" ? communityId : null,
        }),
      });

      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        setError(responseBody?.error ?? "Unable to publish post");
        setContent(contentToPost); // Restore content on error
      } else if (typeof responseBody?.postId === "string") {
        serverPostId = responseBody.postId;
      }
      // Capture the canonical post ID so the optimistic card transitions to the saved row
    } catch (err) {
      console.error("Post composer error", err);
      setError("Network error while posting");
      setContent(contentToPost); // Restore content on error
    } finally {
      const updatePayload: Partial<FeedPost> = { isPending: false };
      if (serverPostId) {
        updatePayload.id = serverPostId;
      }
      updatePost(tempPostId, updatePayload);
      setIsSubmitting(false);
      setIsFocused(false);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle autocomplete navigation
    if (autocompleteOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setAutocompleteSelectedIndex(prev =>
          prev < autocompleteItems.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setAutocompleteSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
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

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = disabled || isSubmitting;
  const isCooldownActive = cooldownRemaining > 0;
  const isButtonDisabled = isDisabled || isCooldownActive;
  const buttonLabel = isCooldownActive ? `Wait ${formatCooldown(cooldownRemaining)}` : "Post";
    const showActions = isFocused || content.trim().length > 0;

  useEffect(() => {
    if (!lastPostTimestamp) {
      setCooldownRemaining(0);
      return;
    }

    const updateRemaining = () => {
      const elapsed = Date.now() - lastPostTimestamp;
      setCooldownRemaining(Math.max(POST_COOLDOWN_MS - elapsed, 0));
    };

    updateRemaining();

    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [lastPostTimestamp]);

  return (
    <form className="space-y-3" onSubmit={handleFormSubmit}>
      <Card
        variant="default"
        className={cn(
          "transition-all duration-300 overflow-visible",
          showActions ? "shadow-xl" : "shadow-sm",
          isFocused ? "border-border bg-card" : "border-border/60 bg-muted/60"
        )}
      >
        <div className="flex gap-4">
          <Avatar className="h-10 w-10 rounded-full border border-border bg-card shadow-sm">
            <AvatarImage
              src={resolveAvatar({
                avatarUrl: viewerAvatarUrl ?? null,
                seed: viewerName ?? "current user",
              })}
            />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-3">
            <div className="relative">
              <Textarea
                value={content}
                onChange={(event) => handleInputChange(event.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => !content.trim() && setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder={needsCommunityId ? "Select a community to post..." : "What's happening?"}
                className="bg-transparent border-none focus-visible:ring-0 focus-visible:border-transparent placeholder:text-muted-foreground resize-none min-h-[90px]"
                maxLength={420}
                disabled={isDisabled || needsCommunityId}
                size="lg"
                ref={textareaRef}
              />

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
                  position="cursor"
                  cursorCoordinates={cursorCoords || undefined}
                />
              )}
            </div>

            <div
              className={cn(
                "flex items-center justify-between transition-all duration-300 overflow-hidden",
                showActions ? "opacity-100 max-h-12" : "opacity-0 max-h-0"
              )}
            >
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" disabled className="text-muted-foreground">
                  <ImageIcon size={18} />
                </Button>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={isButtonDisabled || needsCommunityId || !content.trim()}
                className="gap-2 px-4 font-semibold tracking-wide"
              >
                <span>{buttonLabel}</span>
                <Rocket
                  size={14}
                  className={content.trim() && !isCooldownActive ? "animate-pulse" : ""}
                />
              </Button>
            </div>
          </div>
        </div>
      </Card>
      {error && (
        <Small className="text-destructive font-semibold uppercase tracking-wide">
          {error}
        </Small>
      )}
      {!error && needsCommunityId && (
        <Small className="text-muted-foreground font-semibold uppercase tracking-wide">
          Open a community page to post.
        </Small>
      )}
    </form>
  );
}

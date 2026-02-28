"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Share2,
  Laugh,
  Angry,
  Bell,
  X,
} from "lucide-react";

import { FeedPost, FEED_PAGE_SIZE } from "@/lib/feed";
import { NotificationCategory, NotificationType } from "@/lib/types/notifications";
import { realtimeManager } from "@/lib/services/notification-service";
import { resolveAvatar } from "@/lib/avatar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UserNameDisplay } from "@/components/ui/user-name-display";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { IdentityLabel } from "@/components/ui/identity-label";
import { CommentSection } from "@/components/comments/comment-section";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FeedProvider } from "@/lib/feed-context";
import { PostComposer } from "@/components/feed/post-composer";
import { highlightMentions } from "@/lib/utils/mention-parser";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Toast = {
  id: string;
  message: string;
};

type FeedStreamProps = {
  initialPosts: FeedPost[];
  initialHasMore: boolean;
  viewerProfile: {
    id: string;
    username: string | null;
    identityLabel: string | null;
    avatarUrl: string | null;
    userTier?: "alpha" | "sigma" | "omega" | null;
  };
  feedContext?: "world" | "community" | "friends";
  externalInitialLoading?: boolean;
  communityId?: string | null; // Required when feedContext="community"
  communityOptions?: Array<{ id: string; name: string; slug: string | null }>;
};

type FeedItemProps = {
  post: FeedPost;
  viewerProfile: FeedStreamProps["viewerProfile"];
  showDivider?: boolean;
  feedContext?: "world" | "community" | "friends";
  communityId?: string | null;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// --- DYNAMIC FACE PILE ---
function EngagementFacePile({ seeds }: { seeds: string[] }) {
  if (!seeds || seeds.length === 0) return null;
  return (
    <div className="flex items-center -space-x-2 overflow-hidden py-2">
      {seeds.slice(0, 5).map((seed, i) => (
        <Avatar
          key={i}
          className="inline-block h-6 w-6 rounded-full ring-2 ring-[var(--nav-background)] bg-card"
        >
          <AvatarImage
            src={resolveAvatar({
              seed,
            })}
          />
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
      ))}
      {seeds.length > 5 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-[var(--nav-background)] bg-muted border border-border text-[9px] font-bold text-muted-foreground">
          +{seeds.length - 5}
        </div>
      )}
      <span className="ml-3 text-xs text-muted-foreground font-medium">
        engaged with this thread
      </span>
    </div>
  );
}

// --- FEED ITEM COMPONENT ---
const FeedItem = React.memo(function FeedItem({
  post,
  viewerProfile,
  showDivider,
  feedContext = "world",
  communityId = null,
}: FeedItemProps) {
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [dislikeCount, setDislikeCount] = useState(post.dislikeCount);
  const [userReaction, setUserReaction] = useState(post.viewerReaction);
  const [showComments, setShowComments] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const isPending = Boolean(post.isPending);

  const handleToggle = async (type: "like" | "dislike") => {
    if (isReacting) return;
    setIsReacting(true);

    const prevReaction = userReaction;
    const prevLikes = likeCount;
    const prevDislikes = dislikeCount;

    if (userReaction === type) {
      setUserReaction(null);
      if (type === "like") setLikeCount((c) => c - 1);
      else setDislikeCount((c) => c - 1);
    } else {
      setUserReaction(type);
      if (type === "like") {
        setLikeCount((c) => c + 1);
        if (prevReaction === "dislike") setDislikeCount((c) => c - 1);
      } else {
        setDislikeCount((c) => c + 1);
        if (prevReaction === "like") setLikeCount((c) => c - 1);
      }
    }

    try {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, type }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setUserReaction(prevReaction);
      setLikeCount(prevLikes);
      setDislikeCount(prevDislikes);
    } finally {
      setIsReacting(false);
    }
  };

  const username = post.user?.username ?? "Unknown";
  const time = new Date(post.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const role = post.user?.identityLabel ?? "Operative";

  const cardClasses = cn(
    "group transition duration-200 text-card-foreground mb-8",
    isPending && "cursor-wait opacity-80 filter grayscale brightness-90 focus-visible:outline-none"
  );

  return (
    <>
      <Card
        variant="bare"
        className={cardClasses}
        tabIndex={-1}
        aria-busy={isPending}
        data-feed-post-id={post.id}
      >
        <CardContent className="space-y-5 p-0">
          <div className="flex items-start gap-4">
            <UserAvatar
              username={username}
              avatarUrl={post.user?.avatarUrl ?? null}
              size="lg"
              className="rounded-full border border-border/60 shadow-sm bg-card"
            />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <UserNameDisplay
                  username={username}
                  userTier={(post.user?.userTier as "alpha" | "sigma" | "omega" | null | undefined) ?? "alpha"}
                  showLink={true}
                  badgeSize="sm"
                  className="text-base font-bold text-foreground hover:text-link"
                />
                <span className="text-[11px] text-muted-foreground font-semibold">
                  {time}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <IdentityLabel label={role} className="text-[10px]" />
              </div>
            </div>
          </div>

        <p className="text-foreground text-sm leading-relaxed font-medium whitespace-pre-wrap">
          {(() => {
            const parts = highlightMentions(post.content);
            return parts.map((part, idx) => {
              if (typeof part === 'string') {
                return <span key={idx}>{part}</span>;
              }
              return (
                <Link
                  key={idx}
                  href={`/profile/${part.username}`}
                  className="text-primary font-semibold hover:underline"
                >
                  @{part.username}
                </Link>
              );
            });
          })()}
        </p>

        <div className="mb-1 opacity-80 transition">
          <EngagementFacePile seeds={post.engagers} />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-1 py-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 rounded-full px-3",
                      userReaction === "like" && "bg-card shadow-sm text-success"
                    )}
                    aria-pressed={userReaction === "like"}
                    onClick={() => handleToggle("like")}
                    disabled={isReacting || isPending}
                  >
                    <Laugh
                      size={18}
                      className={cn(
                        "stroke-[2] text-muted-foreground",
                        userReaction === "like" && "text-success fill-success/10"
                      )}
                    />
                    <span className="text-xs font-bold">{likeCount}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs bg-card text-foreground border border-border">
                  Like
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-4 w-px bg-border/60" />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2 rounded-full px-3",
                      userReaction === "dislike" && "bg-card shadow-sm text-destructive"
                    )}
                    aria-pressed={userReaction === "dislike"}
                    onClick={() => handleToggle("dislike")}
                    disabled={isReacting || isPending}
                  >
                    <Angry
                      size={18}
                      className={cn(
                        "stroke-[2] text-muted-foreground",
                        userReaction === "dislike" && "text-destructive fill-destructive/10"
                      )}
                    />
                    <span className="text-xs font-bold">{dislikeCount}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs bg-card text-foreground border border-border">
                  Dislike
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-full px-3 text-muted-foreground hover:text-foreground"
            onClick={() => setShowComments(!showComments)}
            disabled={isPending}
          >
            <MessageCircle size={18} className="stroke-[2]" />
            <span className="text-xs font-bold">{post.initialComments.length}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-full px-3"
            aria-label="Share this post"
            disabled={isPending}
          >
            <Share2 size={18} className="stroke-[2]" />
          </Button>
        </div>

        {showComments && !isPending && (
          <Card variant="subtle" className="mt-4 border-border/50 border-l-2 bg-muted/10">
            <CardContent className="p-4">
              <CommentSection
                postId={post.id}
                viewerProfile={viewerProfile}
                initialComments={post.initialComments}
                feedContext={feedContext}
                communityId={communityId}
              />
            </CardContent>
          </Card>
        )}
        {showComments && isPending && (
          <Card variant="subtle" className="mt-4 border-border/50 border-l-2 bg-muted/10">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground text-center py-4">
                Publishing post...
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
      </Card>
      {showDivider && (
        <Separator className="bg-border/30 my-8" />
      )}
    </>
  );
});

const FEED_INITIAL_SKELETON_COUNT = 3;
const FEED_LOAD_MORE_SKELETON_COUNT = 2;

function FeedPostSkeleton() {
  return (
    <Card
      variant="bare"
      aria-hidden="true"
      className="animate-pulse border border-border/50 bg-muted/10"
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/5 rounded-full bg-muted" />
            <div className="h-2 w-1/3 rounded-full bg-muted" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 rounded-full bg-muted" />
          <div className="h-3 rounded-full bg-muted w-5/6" />
          <div className="h-3 rounded-full bg-muted w-2/3" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="h-2.5 w-14 rounded-full bg-muted" />
          <span className="h-2.5 w-12 rounded-full bg-muted" />
          <span className="h-2.5 w-10 rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function FeedSkeletonList({ count, prefix = "feed-skeleton" }: { count: number; prefix?: string }) {
  const skeletons: React.ReactNode[] = [];
  for (let i = 0; i < count; i += 1) {
    skeletons.push(<FeedPostSkeleton key={`${prefix}-${i}`} />);
  }
  return <>{skeletons}</>;
}

// --- STREAM CONTAINER ---
export function FeedStream({
  initialPosts,
  initialHasMore,
  viewerProfile,
  feedContext = "world",
  externalInitialLoading = false,
  communityId = null,
  communityOptions = [],
}: FeedStreamProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(initialPosts.length);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(communityId);

  useEffect(() => {
    setSelectedCommunityId(communityId);
  }, [communityId]);

  const effectiveCommunityId =
    feedContext === "community" ? (communityId ?? selectedCommunityId) : null;

  const canSelectCommunity =
    feedContext === "community" && !communityId && communityOptions.length > 0;

  useEffect(() => {
    setPosts(initialPosts);
    setHasMore(initialHasMore);
    setOffset(initialPosts.length);
  }, [initialHasMore, initialPosts]);
  const viewerId = viewerProfile?.id;
  const hasViewer = Boolean(viewerId);

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(`/api/feed?limit=${FEED_PAGE_SIZE}&offset=${offset}&feedType=${feedContext}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.posts) {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...data.posts.filter((p: FeedPost) => !ids.has(p.id))];
        });
        setOffset((prev) => prev + data.posts.length);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Failed to load more posts:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, offset, feedContext]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message }]);
      if (typeof window !== "undefined") {
        const timer = window.setTimeout(() => removeToast(id), 4000);
        toastTimersRef.current.set(id, timer);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!hasViewer) return () => {};

    const unsubscribe = realtimeManager.subscribeToNewNotifications((notification) => {
      if (
        notification.category !== NotificationCategory.SOCIAL &&
        notification.type !== NotificationType.FEED_SUMMARY
      ) {
        return;
      }

      const message = notification.title || notification.body;
      if (message) {
        addToast(message);
      }
    });

    return unsubscribe;
  }, [addToast, hasViewer]);

  // No longer need event listeners - using context for optimistic updates
  // Posts are added directly via context, real-time subscriptions handle sync

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) handleLoadMore();
      },
      { rootMargin: "300px" }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  // Direct functions to update posts for optimistic updates.
  const addPostToFeed = useCallback((post: FeedPost) => {
    setPosts((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === post.id)) {
        return prev;
      }
      return [post, ...prev];
    });
    setOffset((prev) => prev + 1);
  }, []);

  const updatePost = useCallback((postId: string, updates: Partial<FeedPost>) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === postId ? { ...post, ...updates } : post))
    );
  }, []);

  const isInitialLoading = (isLoading || externalInitialLoading) && posts.length === 0;
  const isLoadingMore = isLoading && posts.length > 0;

  return (
    <FeedProvider addPostToFeed={addPostToFeed} updatePost={updatePost}>
      <div className="space-y-8">
        {canSelectCommunity && (
          <div className="max-w-sm">
            <Select
              value={effectiveCommunityId ?? undefined}
              onValueChange={(value) => setSelectedCommunityId(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a community to post..." />
              </SelectTrigger>
              <SelectContent>
                {communityOptions.map((community) => (
                  <SelectItem key={community.id} value={community.id}>
                    {community.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <PostComposer
          viewerName={viewerProfile.username ?? "You"}
          viewerAvatarUrl={viewerProfile.avatarUrl ?? null}
          viewerId={viewerProfile.id}
          viewerIdentityLabel={viewerProfile.identityLabel}
          viewerUserTier={viewerProfile.userTier ?? "alpha"}
          feedContext={feedContext}
          communityId={effectiveCommunityId}
        />
        <div className="space-y-4">
          {posts.length === 0 && !isInitialLoading ? (
            <Card variant="subtle" className="p-8">
              <div className="text-center space-y-3">
                <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <span className="text-2xl">📝</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">No posts yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {feedContext === "community"
                      ? "Be the first to share something with your community!"
                      : feedContext === "friends"
                      ? "Be the first to share something with your friends!"
                      : "Share your thoughts with the world!"}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {posts.map((post, index) => (
                <FeedItem
                  key={post.id}
                  post={post}
                  viewerProfile={viewerProfile}
                  showDivider={index < posts.length - 1}
                  feedContext={feedContext}
                  communityId={effectiveCommunityId}
                />
              ))}
            </>
          )}
          {isInitialLoading && (
            <FeedSkeletonList count={FEED_INITIAL_SKELETON_COUNT} prefix="initial-load" />
          )}
          {isLoadingMore && (
            <FeedSkeletonList count={FEED_LOAD_MORE_SKELETON_COUNT} prefix="load-more" />
          )}
          <div ref={sentinelRef} className="py-8" aria-hidden="true" />
        </div>
      </div>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto max-w-sm flex items-start gap-3 rounded-lg px-4 py-3 shadow-lg transition-all animate-in slide-in-from-bottom-3 duration-300 group"
            style={{
              backgroundColor: "var(--card)",
              color: "var(--card-foreground)",
              border: "1px solid var(--border)",
              borderLeft: "3px solid var(--accent)",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)"
            }}
            onClick={() => removeToast(toast.id)}
          >
            <div className="flex-shrink-0 mt-0.5">
              <div
                className="flex items-center justify-center w-5 h-5 rounded-full"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)"
                }}
              >
                <Bell className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug" style={{ color: "var(--card-foreground)" }}>
                {toast.message}
              </p>
            </div>
            <button
              className="flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
              style={{
                color: "var(--muted-foreground)"
              }}
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </FeedProvider>
  );
}

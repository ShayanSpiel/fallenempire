"use client";

import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { FeedPost, FEED_PAGE_SIZE, transformFeedPosts, type FeedPostRow } from "@/lib/feed";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { FeedStream } from "@/components/feed/feed-stream";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";

type CommunityFeedTabProps = {
  communityId: string;
  communityName: string;
  communityGroupId?: string | null;
  viewerProfile: {
    id: string;
    username: string | null;
    identityLabel: string | null;
    avatarUrl: string | null;
  };
};

export function CommunityFeedTab({
  communityId,
  viewerProfile,
}: CommunityFeedTabProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch community-filtered feed
  useEffect(() => {
	    async function fetchCommunityFeed() {
	      try {
	        setIsLoading(true);
	        setError(null);
	        const supabase = createSupabaseBrowserClient();

	        // Fetch posts IN this community (feed_type='community' AND community_id matches)
	        const { data: rawPosts, error: postsError } = await supabase
	          .from("posts")
	          .select(
	            `
	            id,
	            content,
	            created_at,
	            user_id,
	            user:users(id, username, identity_label, is_bot, avatar_url),
	            post_reactions(
	              id,
	              user_id,
	              type,
	              user:users(username)
	            )
	          `
	          )
	          .eq("feed_type", "community")
	          .eq("community_id", communityId)
	          .order("created_at", { ascending: false })
	          .limit(FEED_PAGE_SIZE + 1);

        if (postsError) {
          console.error("Failed to fetch posts:", postsError);

          // Check if it's a column missing error
          if (postsError.message?.includes("feed_type") || postsError.code === "42703") {
            setError("Community feeds feature requires database migration. Please run the latest migrations.");
          } else {
            setError("Failed to load community posts: " + (postsError.message || "Unknown error"));
          }
	          setIsLoading(false);
	          return;
	        }

	        const normalizeRelation = <T extends Record<string, unknown>>(value: T | (T | null)[] | null | undefined) => {
	          if (Array.isArray(value)) {
	            return (value[0] ?? null) as T | null;
	          }
	          return (value ?? null) as T | null;
	        };

	        type RawFeedPostRow = Omit<FeedPostRow, "user" | "post_reactions"> & {
	          user: FeedPostRow["user"] | FeedPostRow["user"][] | null;
	          user_id: string;
	          post_reactions:
	            | (Omit<NonNullable<FeedPostRow["post_reactions"]>[number], "user"> & {
	                user: { username: string | null } | { username: string | null }[] | null;
	              })[]
	            | null;
	        };

	        const rawRows = (rawPosts ?? []) as unknown as RawFeedPostRow[];

	        const feedHasMore = rawRows.length > FEED_PAGE_SIZE;
	        const limitedRawRows = feedHasMore ? rawRows.slice(0, FEED_PAGE_SIZE) : rawRows;

	        // Fetch comments for these posts
	        const postIds = limitedRawRows.map((p) => p.id);
	        const commentsMap: Record<string, FeedPostRow["comments"]> = {};

	        if (postIds.length > 0) {
	          const { data: commentsData } = await supabase
	            .from("comments")
	            .select(`
	              id,
	              content,
	              created_at,
	              is_agent,
	              post_id,
	              user:users(id, username, identity_label, avatar_url)
	            `)
	            .in("post_id", postIds)
	            .order("created_at", { ascending: true });

	          if (commentsData) {
	            const normalizedComments = (commentsData as Array<{
	              id: string;
	              content: string;
	              created_at: string;
	              is_agent: boolean;
	              post_id: string;
	              user: FeedPostRow["user"] | FeedPostRow["user"][] | null;
	            }>).map((comment) => {
	              const normalizedUser = normalizeRelation(comment.user);
	              return {
	                id: comment.id,
	                content: comment.content,
	                created_at: comment.created_at,
	                is_agent: comment.is_agent,
	                post_id: comment.post_id,
	                user: normalizedUser ? {
	                  id: normalizedUser.id,
	                  username: normalizedUser.username,
	                  identityLabel: normalizedUser.identity_label,
	                  avatarUrl: normalizedUser.avatar_url,
	                } : null,
	              };
	            });

	            normalizedComments.forEach((comment) => {
	              if (!commentsMap[comment.post_id]) {
	                commentsMap[comment.post_id] = [];
	              }
	              commentsMap[comment.post_id]!.push(comment);
	            });
	          }
	        }

	        const rows: FeedPostRow[] = limitedRawRows.map((post) => {
	          const normalizedPostUser = normalizeRelation(post.user);
	          return {
	            id: post.id,
	            content: post.content,
	            created_at: post.created_at,
	            user: normalizedPostUser ? {
	              id: normalizedPostUser.id,
	              username: normalizedPostUser.username,
	              identity_label: normalizedPostUser.identity_label,
	              is_bot: normalizedPostUser.is_bot,
	              avatar_url: normalizedPostUser.avatar_url,
	            } : null,
	            post_reactions: Array.isArray(post.post_reactions)
	              ? post.post_reactions.map((reaction) => {
	                  const normalizedReactionUser = normalizeRelation(reaction.user);
	                  return {
	                    id: reaction.id,
	                    user_id: reaction.user_id,
	                    type: reaction.type,
	                    user: normalizedReactionUser ? {
	                      username: normalizedReactionUser.username,
	                    } : null,
	                  };
	                })
	              : null,
	            comments: commentsMap[post.id] ?? undefined,
	          };
	        });

        const transformedPosts = transformFeedPosts(rows, viewerProfile.id);

        setPosts(transformedPosts);
        setHasMore(feedHasMore);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching community feed:", err);
        setError("An unexpected error occurred");
        setIsLoading(false);
      }
    }

    fetchCommunityFeed();
  }, [communityId, viewerProfile.id]);

  if (isLoading) {
    return (
      <div className="space-y-6 px-2 sm:px-3">
        <SectionHeading
          title="Community Feed"
          icon={Building2}
        />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={`feed-skeleton-${index}`}
              variant="bare"
              aria-hidden="true"
              className="animate-pulse border border-border/50 bg-muted/10"
            >
              <div className="space-y-4 p-4">
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
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 px-2 sm:px-3">
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-3">
      <SectionHeading
        title="Community Feed"
        icon={Building2}
      />

      <FeedStream
        initialPosts={posts}
        initialHasMore={hasMore}
        viewerProfile={viewerProfile}
        feedContext="community"
        communityId={communityId}
      />
    </div>
  );
}

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { FEED_PAGE_SIZE, transformFeedPosts, type FeedPost, type FeedPostRow } from "@/lib/feed";

const MAX_FEED_LIMIT = 25;

// Simple in-memory cache for feed results
const feedCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

function getCacheKey(userId: string, feedType: string, limit: number, offset: number, skipComments: boolean): string {
  return `${userId}:${feedType}:${limit}:${offset}:${skipComments}`;
}

type CommentJoinRow = {
  id: string;
  content: string;
  created_at: string;
  is_agent: boolean;
  post_id: string;
  user:
    | { id: string; username: string | null; identity_label: string | null; avatar_url: string | null }
    | { id: string; username: string | null; identity_label: string | null; avatar_url: string | null }[]
    | null;
};

type FeedPostRowWithUserId = FeedPostRow & { user_id: string };

type RpcReaction = { user_id: string; type: string | null; username: string | null };
type RpcPost = {
  id: string;
  content: string;
  createdAt: string;
  user: FeedPost["user"];
  reactions?: RpcReaction[] | null;
  comments?: FeedPost["initialComments"] | null;
  userCommunityIds?: string[] | null;
};

function normalizeRelation<T extends Record<string, unknown>>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return (value ?? null) as T | null;
}

async function getFeedPostsFallback({
  supabase,
  profileId,
  feedType,
  limit,
  offset,
  skipComments,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  profileId: string;
  feedType: string;
  limit: number;
  offset: number;
  skipComments: boolean;
}) {
  const fetchLimit = limit + 1;

  let query = supabase
    .from("posts")
    .select(
      `
        id,
        content,
        created_at,
        user_id,
        feed_type,
        community_id,
        user:users(id, username, identity_label, is_bot, avatar_url),
        post_reactions(
          id,
          user_id,
          type,
          user:users(username)
        )
      `
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  if (feedType === "world") {
    query = query.eq("feed_type", "world");
  } else if (feedType === "community") {
    const { data: communityMembers } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", profileId)
      .is("left_at", null);
    const communityIds = (communityMembers ?? []).map((m) => m.community_id);
    if (!communityIds.length) return { posts: [], hasMore: false, nextOffset: 0 };
    query = query.eq("feed_type", "community").in("community_id", communityIds);
  } else if (feedType === "friends") {
    const { data: following } = await supabase
      .from("user_follows")
      .select("followed_id")
      .eq("follower_id", profileId);
    const followingIds = (following ?? []).map((f) => f.followed_id);
    if (!followingIds.length) return { posts: [], hasMore: false, nextOffset: 0 };
    query = query.eq("feed_type", "followers").in("user_id", followingIds);
  } else {
    return { posts: [], hasMore: false, nextOffset: 0 };
  }

  const { data: rawPosts, error } = await query;
  if (error) throw error;

  const normalizedRows = (rawPosts ?? []).map((post) => ({
    ...post,
    user: normalizeRelation(post.user),
    post_reactions: Array.isArray(post.post_reactions)
      ? post.post_reactions.map((reaction) => ({
          ...reaction,
          user: normalizeRelation(reaction.user),
        }))
      : post.post_reactions,
  })) as unknown as FeedPostRowWithUserId[];

  const hasMore = normalizedRows.length > limit;
  const pageRows = hasMore ? normalizedRows.slice(0, limit) : normalizedRows;

  const postIds = pageRows.map((row) => row.id);
  const authorIds = Array.from(new Set(pageRows.map((row) => row.user_id)));

  const userCommunitiesMap: Record<string, string[]> = {};
  if (authorIds.length > 0) {
    const { data: authorCommunities } = await supabase
      .from("community_members")
      .select("user_id, community_id")
      .in("user_id", authorIds)
      .is("left_at", null);

    (authorCommunities ?? []).forEach((membership) => {
      if (!userCommunitiesMap[membership.user_id]) userCommunitiesMap[membership.user_id] = [];
      userCommunitiesMap[membership.user_id]!.push(membership.community_id);
    });
  }

  const commentsMap: Record<string, FeedPostRow["comments"]> = {};
  if (!skipComments && postIds.length) {
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
      .order("created_at", { ascending: true })
      .returns<CommentJoinRow[]>();

    const normalizedComments = (commentsData ?? []).map((comment) => ({
      ...comment,
      user: normalizeRelation(comment.user),
    })) as unknown as Array<
      Omit<CommentJoinRow, "user"> & { user: { id: string; username: string | null; identity_label: string | null; avatar_url: string | null } | null }
    >;

    for (const comment of normalizedComments) {
      const list = commentsMap[comment.post_id] ?? [];
      list.push({
        id: comment.id,
        content: comment.content,
        created_at: comment.created_at,
        is_agent: comment.is_agent,
        user: comment.user
          ? {
              id: comment.user.id,
              username: comment.user.username,
              identityLabel: comment.user.identity_label,
              avatarUrl: comment.user.avatar_url,
            }
          : null,
      });
      commentsMap[comment.post_id] = list;
    }

    for (const key of Object.keys(commentsMap)) {
      const list = commentsMap[key];
      if (!list) continue;
      if (list.length > 3) commentsMap[key] = list.slice(-3);
    }
  }

  const rowsWithComments = pageRows.map((row) => ({
    ...row,
    comments: commentsMap[row.id] ?? [],
  })) as FeedPostRow[];

  const posts = transformFeedPosts(rowsWithComments, profileId, userCommunitiesMap);
  return { posts, hasMore, nextOffset: offset + posts.length };
}

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabase = await createSupabaseServerClient({ canSetCookies: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit") ?? FEED_PAGE_SIZE);
  const offsetParam = Number(url.searchParams.get("offset") ?? 0);
  const skipCommentsParam = url.searchParams.get("skipComments") === "true";
  const feedType = url.searchParams.get("feedType") ?? "world"; // world | community | friends

  let limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : FEED_PAGE_SIZE;
  limit = Math.min(limit, MAX_FEED_LIMIT);

  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check cache first (only for first page)
  const cacheKey = getCacheKey(profile.id, feedType, limit, offset, skipCommentsParam);
  if (offset === 0) {
    const cached = feedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const response = NextResponse.json(cached.data);
      response.headers.set('X-Cache', 'HIT');
      response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return response;
    }
  }

  try {
    // Use optimized RPC function that does everything in one query
    const { data: result, error } = await supabase.rpc('get_feed_posts_optimized', {
      p_user_id: profile.id,
      p_feed_type: feedType,
      p_limit: limit,
      p_offset: offset,
      p_skip_comments: skipCommentsParam
    });

    let processedPosts: FeedPost[] = [];
    let hasMore = false;
    let nextOffset = offset;

    if (error) {
      if (error.code === 'PGRST202') {
        const fallback = await getFeedPostsFallback({
          supabase,
          profileId: profile.id,
          feedType,
          limit,
          offset,
          skipComments: skipCommentsParam,
        });
        processedPosts = fallback.posts;
        hasMore = fallback.hasMore;
        nextOffset = fallback.nextOffset;
      } else {
        console.error('Feed RPC error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    } else {
      // Transform the RPC result to match expected format
      const rpcResult = (result ?? {}) as unknown as { posts?: unknown; hasMore?: unknown; nextOffset?: unknown };
      const posts = Array.isArray(rpcResult.posts) ? (rpcResult.posts as RpcPost[]) : [];
      hasMore = Boolean(rpcResult.hasMore);
      nextOffset = typeof rpcResult.nextOffset === "number" ? rpcResult.nextOffset : offset;

      // Process posts to match the expected format
      processedPosts = posts.map((post) => {
        const reactions = Array.isArray(post.reactions) ? post.reactions : [];

        const likeCount = reactions.filter((reaction) => reaction.type === "like").length;
        const dislikeCount = reactions.filter((reaction) => reaction.type === "dislike").length;

        const rawViewerReaction = reactions.find((reaction) => reaction.user_id === profile.id)?.type ?? null;
        const viewerReaction =
          rawViewerReaction === "like" || rawViewerReaction === "dislike" ? rawViewerReaction : null;

        const engagers = Array.from(
          new Set(
            reactions
              .map((reaction) => reaction.username)
              .filter((username): username is string => Boolean(username))
          )
        ).slice(0, 5);

        return {
          id: post.id,
          content: post.content,
          createdAt: post.createdAt,
          user: post.user,
          likeCount,
          dislikeCount,
          viewerReaction,
          initialComments: post.comments ?? [],
          engagers,
          isPending: false,
          userCommunityIds: post.userCommunityIds ?? []
        };
      });
    }

    const responseData = {
      posts: processedPosts,
      hasMore,
      nextOffset,
    };

    // Cache the result (only first page)
    if (offset === 0) {
      feedCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });

      // Clean up old cache entries
      if (feedCache.size > 100) {
        const oldestKey = Array.from(feedCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        feedCache.delete(oldestKey);
      }
    }

    const executionTime = Date.now() - startTime;

    // Record performance stats (fire and forget)
    if (offset === 0) {
      void supabase.rpc('record_feed_query_stat', {
        p_user_id: profile.id,
        p_feed_type: feedType,
        p_execution_time_ms: executionTime,
        p_post_count: processedPosts.length
      });
    }

    const response = NextResponse.json(responseData);

    // Enhanced caching headers
    response.headers.set('X-Cache', 'MISS');
    response.headers.set('X-Execution-Time', `${executionTime}ms`);

    // Longer cache for first page, shorter for pagination
    const cacheSeconds = offset === 0 ? 30 : 15;
    response.headers.set('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=60`);

    return response;
  } catch (error) {
    console.error('Feed API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const FEED_PAGE_SIZE = 10;

export type FeedPostRow = {
  id: string;
  content: string;
  created_at: string;
  user:
    | {
        id: string;
        username: string | null;
        identity_label: string | null;
        is_bot: boolean | null;
        avatar_url: string | null;
        user_tier?: string | null;
      }
    | null;
  post_reactions:
    | {
        id: string;
        user_id: string;
        type: string | null;
        user: { username: string | null } | null;
      }[]
    | null;
  comments?: FeedComment[];
};

export type FeedPost = {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    identityLabel: string | null;
    isAgent: boolean;
    avatarUrl?: string | null;
    userTier?: string | null;
  } | null;
  likeCount: number;
  dislikeCount: number;
  viewerReaction: "like" | "dislike" | null;
  initialComments: FeedComment[];
  engagers: string[];
  isPending?: boolean;
  userCommunityIds?: string[];
};

export type FeedComment = {
  id: string;
  content: string;
  created_at: string;
  is_agent: boolean;
  user:
    | {
        id: string;
        username: string | null;
        identityLabel: string | null;
        avatarUrl?: string | null;
      }
    | null;
};

function normalizeUser(
  user:
    | FeedPostRow["user"]
    | {
        id: string;
        username: string | null;
        identity_label: string | null;
        is_bot: boolean | null;
        user_tier?: string | null;
      }
    | null
) {
  if (!user) return null;
  const avatarUrl = "avatar_url" in user ? user.avatar_url : null;
  const userTier = "user_tier" in user ? user.user_tier : null;
  return {
    id: user.id,
    username: user.username,
    identityLabel: user.identity_label,
    isAgent: Boolean(user.is_bot),
    avatarUrl,
    userTier,
  };
}

export function transformFeedPosts(
  rows: FeedPostRow[],
  viewerId?: string,
  userCommunitiesMap?: Record<string, string[]>
): FeedPost[] {
  return rows.map((row) => {
    const reactions = Array.isArray(row.post_reactions) ? row.post_reactions : [];

    const likeCount = reactions.filter((reaction) => reaction.type === "like").length;
    const dislikeCount = reactions.filter((reaction) => reaction.type === "dislike").length;

    const viewerReaction =
      viewerId != null
        ? (reactions.find((reaction) => reaction.user_id === viewerId)?.type as "like" | "dislike" | null)
        : null;

    const engagers = Array.from(
      new Set(
        reactions
          .map((reaction) => reaction.user?.username)
          .filter((username): username is string => Boolean(username))
      )
    ).slice(0, 5);

    const userId = row.user?.id;
    const userCommunityIds = userId && userCommunitiesMap ? userCommunitiesMap[userId] : undefined;

    return {
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      user: normalizeUser(row.user),
      likeCount,
      dislikeCount,
      viewerReaction: viewerReaction ?? null,
      initialComments: row.comments ?? [],
      engagers,
      isPending: false,
      userCommunityIds,
    };
  });
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { FeedTabsWrapper } from "@/components/feed/feed-tabs-wrapper";
import { FEED_PAGE_SIZE, FeedPostRow, transformFeedPosts } from "@/lib/feed";
import { BattleListSidebar } from "@/components/feed/battle-list-sidebar";
import { WorldEventsSidebar } from "@/components/feed/world-events-sidebar";
import { CommunityEventsSidebar } from "@/components/feed/community-events-sidebar";
import { MissionSidebarWrapper } from "@/components/feed/mission-sidebar-wrapper";
import { getUserMissions } from "@/app/actions/missions";
import { PageSection } from "@/components/layout/page-section";
import {
  getRelativeTime,
  WORLD_EVENT_NOTIFICATION_TYPES,
  COMMUNITY_EVENT_NOTIFICATION_TYPES,
} from "@/lib/types/notifications";
import { H1, P } from "@/components/ui/typography";
import { BattlePassWrapper } from "@/components/battlepass/battle-pass-wrapper";

function normalizeRelation<T extends Record<string, unknown>>(value: T | (T | null)[] | null | undefined) {
  if (Array.isArray(value)) {
    return (value[0] ?? null) as T | null;
  }

  return (value ?? null) as T | null;
}

type CommentJoinRow = {
  id: string;
  content: string;
  created_at: string;
  is_agent: boolean;
  post_id: string;
  user: {
    id: string;
    username: string | null;
    identity_label: string | null;
    avatar_url: string | null;
    user_tier?: string | null;
  } | null;
};

type CommentQueryRow = Omit<CommentJoinRow, "user"> & {
  user: CommentJoinRow["user"] | CommentJoinRow["user"][] | null;
};

type FeedPostQueryRow = Omit<FeedPostRow, "user" | "post_reactions"> & {
  user: FeedPostRow["user"] | FeedPostRow["user"][] | null;
  post_reactions:
    | ({
        id: string;
        user_id: string;
        type: string | null;
        user: { username: string | null } | { username: string | null }[] | null;
      })[]
    | null;
};

type UserCommunityJoinRow = {
  community: { id: string; name: string; slug: string | null } | { id: string; name: string; slug: string | null }[] | null;
};

type FeedPostRowWithAuthor = FeedPostRow & { user_id: string };

type BattleJoinRow = {
  id: string;
  status: string;
  attacker: { id: string; name: string; slug: string | null } | { id: string; name: string; slug: string | null }[] | null;
  defender: { id: string; name: string; slug: string | null } | { id: string; name: string; slug: string | null }[] | null;
};

type WorldEventRow = {
  id: string;
  title: string | null;
  type: string;
  created_at: string;
  action_url: string | null;
  metadata?: Record<string, unknown> | null;
};

type CommunityEventJoinRow = {
  id: string;
  title: string | null;
  created_at: string;
  community_id: string | null;
  community: { id: string; name: string; slug: string | null } | { id: string; name: string; slug: string | null }[] | null;
};

const MAX_FEED_LIMIT = 25;

type FeedProfileRow = {
  id: string;
  username: string | null;
  identity_label: string | null;
  avatar_url: string | null;
  user_tier?: string | null;
};

export const metadata: Metadata = {
  title: "Feed",
  description: "Your personalized feed of posts, reactions, missions, and world events.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/feed" },
};

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, identity_label, avatar_url, user_tier")
    .eq("auth_id", user.id)
    .maybeSingle<FeedProfileRow>();

  if (!profile) {
    redirect("/profile");
  }

  await maybeSendFeedSummaryNotification(profile.id);

  // Fetch user's following list, community memberships, battles, and notifications in parallel
  const fetchLimit = Math.min(FEED_PAGE_SIZE, MAX_FEED_LIMIT);

  const [
    { data: followingData },
    { data: communityMembersData },
    { data: userCommunitiesData },
    { data: battlesData },
    { data: worldEventsData },
    { data: communityEventsData },
    { data: rawPosts, error },
  ] = await Promise.all([
    supabase
      .from("user_follows")
      .select("followed_id")
      .eq("follower_id", profile.id),
    supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", profile.id),
    supabase
      .from("community_members")
      .select(`
        community:communities(id, name, slug)
      `)
      .eq("user_id", profile.id)
      .is("left_at", null),
    supabase
      .from("battles")
      .select(`
        id,
        status,
        attacker_community_id,
        defender_community_id,
        attacker:communities!battles_attacker_community_id_fkey(id, name, slug),
        defender:communities!battles_defender_community_id_fkey(id, name, slug)
      `)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("id, title, type, created_at, action_url, metadata")
      .in("type", WORLD_EVENT_NOTIFICATION_TYPES)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select(`
        id,
        title,
        created_at,
        community_id,
        community:communities(id, name, slug)
      `)
      .in("type", COMMUNITY_EVENT_NOTIFICATION_TYPES)
      .order("created_at", { ascending: false })
      .limit(5),
    // Fetch ONLY world feed posts initially (other tabs fetch client-side)
    supabase
      .from("posts")
      .select(
        `
        id,
        content,
        created_at,
        user_id,
        feed_type,
        community_id,
        user:users(id, username, identity_label, is_bot, avatar_url, user_tier),
        post_reactions(
          id,
          user_id,
          type,
          user:users(username)
        )
      `
      )
      .eq("feed_type", "world")
      .order("created_at", { ascending: false })
      .limit(fetchLimit)
      .returns<FeedPostQueryRow[]>(),
  ]);

  if (error) {
    console.error("Feed error:", error);
    return <div>Error loading feed</div>;
  }

  const followingIds = (followingData ?? []).map((f) => f.followed_id);
  const userCommunityIds = (communityMembersData ?? []).map((m) => m.community_id);
  const userCommunities = Array.from(
    new Map(
      ((userCommunitiesData ?? []) as UserCommunityJoinRow[])
        .map((row) => normalizeRelation(row.community))
        .filter((community): community is { id: string; name: string; slug: string | null } => Boolean(community?.id))
        .map((community) => [
          community.id,
          { id: community.id, name: community.name, slug: community.slug ?? null },
        ])
    ).values()
  );


  const normalizedRows = (rawPosts ?? []).map((post) => ({
    ...post,
    user: normalizeRelation(post.user),
    post_reactions: Array.isArray(post.post_reactions)
      ? post.post_reactions.map((reaction) => ({
          ...reaction,
          user: normalizeRelation(reaction.user),
        }))
      : post.post_reactions,
  })) as FeedPostRowWithAuthor[];

  const pageRows = normalizedRows;
  const postIds = pageRows.map((row) => row.id);

  // Fetch community memberships for all post authors
  const authorIds = Array.from(new Set(pageRows.map((row) => row.user_id)));
  const userCommunitiesMap: Record<string, string[]> = {};

  if (authorIds.length > 0) {
    const { data: authorCommunities } = await supabase
      .from("community_members")
      .select("user_id, community_id")
      .in("user_id", authorIds);

    (authorCommunities ?? []).forEach((membership) => {
      if (!userCommunitiesMap[membership.user_id]) {
        userCommunitiesMap[membership.user_id] = [];
      }
      userCommunitiesMap[membership.user_id].push(membership.community_id);
    });
  }
  const commentsMap: Record<string, FeedPostRow["comments"]> = {};

  if (postIds.length) {
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
      .returns<CommentQueryRow[]>();

    const normalizedComments = (commentsData ?? []).map((comment) => ({
      ...comment,
      user: normalizeRelation(comment.user),
    })) as CommentJoinRow[];

    const commentRows = normalizedComments;
    for (const comment of commentRows) {
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
      if (list.length > 3) {
        commentsMap[key] = list.slice(-3);
      }
    }
  }

  const rowsWithComments = pageRows.map((row) => ({
    ...row,
    comments: commentsMap[row.id] ?? [],
  }));

  const posts = transformFeedPosts(rowsWithComments, profile.id, userCommunitiesMap);

  const viewerProfile = {
    id: profile.id,
    username: profile.username,
    identityLabel: profile.identity_label,
    avatarUrl: profile.avatar_url ?? null,
    userTier: (profile.user_tier as "alpha" | "sigma" | "omega" | null) ?? null,
  };

  // Fetch missions
  const missionsData = await getUserMissions(profile.id);

  // Transform to component format with icon names as strings
  const missions = missionsData.map((m) => ({
    id: m.mission_id,
    title: getTitle(m.mission_id),
    description: getDescription(m.mission_id),
    iconName: getIconName(m.mission_id),
    progress: m.progress,
    goal: m.goal,
    xpReward: m.xp_reward,
    status: m.status,
    type: m.mission_type,
  }));

  // Transform battle data
  const battles = ((battlesData ?? []) as BattleJoinRow[]).map((battle) => {
    const attacker = normalizeRelation(battle.attacker);
    const defender = normalizeRelation(battle.defender);
    return {
      id: battle.id,
      status: battle.status,
      attacker: attacker ? { name: attacker.name, slug: attacker.slug ?? undefined } : null,
      defender: defender ? { name: defender.name, slug: defender.slug ?? undefined } : null,
    };
  });

  // Transform world events
  const worldEvents = ((worldEventsData ?? []) as WorldEventRow[]).map((event) => ({
    id: event.id,
    title: event.title,
    type: event.type,
    created_at: event.created_at,
    relative_time_label: getRelativeTime(event.created_at),
    action_url: event.action_url,
  }));

  // Transform community events
  const allowedCommunityIds = new Set(userCommunityIds);
  const communityEvents = ((communityEventsData ?? []) as CommunityEventJoinRow[])
    .filter((event) => !event.community_id || allowedCommunityIds.has(event.community_id))
    .map((event) => ({
      id: event.id,
      title: event.title,
      created_at: event.created_at,
      community_id: event.community_id,
      community: (() => {
        const community = normalizeRelation(event.community);
        return community
          ? {
              id: community.id,
              name: community.name,
              slug: community.slug,
            }
          : null;
      })(),
    }));

  return (
    <>
      {/* Battle Pass Banner - Aligned with page content */}
      <div className="w-full pt-6">
        <div className="mx-auto w-full px-[var(--layout-horizontal-padding)]" style={{ maxWidth: "var(--layout-max-width)" }}>
          <BattlePassWrapper />
        </div>
      </div>

      <PageSection
        sidebarPlacement="left"
        sidebar={
          <div className="space-y-6">
            <MissionSidebarWrapper initialMissions={missions} />
            <BattleListSidebar battles={battles} />
            <WorldEventsSidebar events={worldEvents} />
            <CommunityEventsSidebar events={communityEvents} />
          </div>
        }
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <H1>Social Feed</H1>
            <P className="max-w-2xl text-muted-foreground/80">
              Real-time intelligence and social dynamics.
            </P>
          </div>

          <FeedTabsWrapper
            initialPosts={posts}
            initialHasMore={posts.length >= fetchLimit}
            viewerProfile={viewerProfile}
            userCommunities={userCommunities}
            userCommunityIds={userCommunityIds}
            followingIds={followingIds}
          />
        </div>
      </PageSection>
    </>
  );
}

async function maybeSendFeedSummaryNotification(userId: string) {
  try {
    await supabaseAdmin.rpc("maybe_create_feed_summary_notification", {
      p_user_id: userId,
    });
  } catch (err) {
    console.error("Feed summary notification error:", err);
  }
}

function getTitle(missionId: string): string {
  const titles: Record<string, string> = {
    "daily-train": "Daily Training",
    "daily-battle": "Battle Participant",
    "weekly-post": "Introduce Yourself",
    "join-community": "Join a Community",
    "make-friend": "Make a Friend",
    "weekly-battles": "Warrior's Path",
    "grow-rank": "Climb the Ranks",
    "weekly-engage": "Social Engagement",
  };
  return titles[missionId] || "Unknown Mission";
}

function getDescription(missionId: string): string {
  const descriptions: Record<string, string> = {
    "daily-train": "Complete your training session",
    "daily-battle": "Join 1 battle today",
    "weekly-post": "Share your story with the community",
    "join-community": "Become part of a community",
    "make-friend": "Follow another player",
    "weekly-battles": "Fight in 3 battles this week",
    "grow-rank": "Gain 1 military rank level",
    "weekly-engage": "React or comment 10 times",
  };
  return descriptions[missionId] || "";
}

function getIconName(missionId: string): string {
  const iconNames: Record<string, string> = {
    "daily-train": "Dumbbell",
    "daily-battle": "Swords",
    "weekly-post": "MessageCircle",
    "join-community": "Users",
    "make-friend": "UserPlus",
    "weekly-battles": "Swords",
    "grow-rank": "TrendingUp",
    "weekly-engage": "ThumbsUp",
  };
  return iconNames[missionId] || "Trophy";
}

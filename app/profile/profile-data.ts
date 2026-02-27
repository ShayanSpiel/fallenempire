import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DEFAULT_IDENTITY_VECTOR } from "@/lib/psychology";
import type {
  ActivityLogItem,
  CommunityMember,
  CommunityRow,
  CommentRow,
  PostRow,
  ProfileRecord,
} from "./types";

type GenericSupabaseClient = SupabaseClient<any, "public">;

export type Medal = {
  id: string;
  key: string;
  name: string;
  description?: string;
  earned_at: string;
  metadata?: Record<string, unknown> | null;
};

export type MedalSummary = {
  key: string;
  name: string;
  description?: string;
  count: number;
  firstEarnedAt?: string;
};

export type ProfileViewModel = {
  profile: ProfileRecord;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwnProfile: boolean;
  viewerId: string | null | undefined;
  community: CommunityRow | null;
  communityMembers: CommunityMember[];
  activityLog: ActivityLogItem[];
  medals: Medal[];
  medalSummary: MedalSummary[];
};

async function fetchUserMedals(userId: string) {
  try {
    const readOnlySupabase = await createSupabaseServerClient({ canSetCookies: false });

    // Fetch all available medals and user's earned medals
    const [allMedalsRes, userMedalsRes] = await Promise.all([
      readOnlySupabase.from("medals").select("id, key, name, description"),
      readOnlySupabase
        .from("user_medals")
        .select(
          `
        id,
        earned_at,
        metadata,
        medals:medal_id (
          id,
          key,
          name,
          description
        )
      `,
        )
        .eq("user_id", userId)
        .order("earned_at", { ascending: false }),
    ]);

    return {
      data: userMedalsRes.data || [],
      allMedals: allMedalsRes.data || [],
      error: userMedalsRes.error || allMedalsRes.error,
    };
  } catch (err) {
    console.error("Error fetching medals:", err);
    return { data: [], allMedals: [], error: err };
  }
}

export async function loadProfileViewModel(
  supabase: GenericSupabaseClient,
  profile: ProfileRecord,
  viewerId?: string | null
): Promise<ProfileViewModel> {
  const followerCountPromise = supabase
    .from("user_follows")
    .select("id", { count: "exact", head: true })
    .eq("followed_id", profile.id);

  const followingCountPromise = supabase
    .from("user_follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", profile.id);

  const postsPromise = supabase
    .from("posts")
    .select("id, content, created_at, post_reactions(id)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const commentsPromise = supabase
    .from("comments")
    .select("id, content, created_at, post_id")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const communityPromise = profile.main_community_id
    ? supabase
        .from("communities")
        .select("id, name, slug, color, ideology_label, power_mental, power_physical, members_count")
        .eq("id", profile.main_community_id)
        .maybeSingle()
    : Promise.resolve({ data: null });

  const communityMembersPromise = profile.main_community_id
    ? supabase
        .from("community_members")
        .select("role, user:users(username, identity_label)")
        .eq("community_id", profile.main_community_id)
        .limit(6)
    : Promise.resolve({ data: [] });

  // Fetch medals with read-only client
  const medalsPromise = fetchUserMedals(profile.id);

  // Fetch user location
  const locationPromise = supabase.rpc("get_user_location", {
    p_user_id: profile.id,
  });

  const isFollowingPromise = viewerId
    ? supabase
        .from("user_follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", viewerId)
        .eq("followed_id", profile.id)
    : Promise.resolve({ count: 0, error: null } as any);

  const [
    followerRes,
    followingRes,
    postsRes,
    commentsRes,
    communityRes,
    membersRes,
    medalsRes,
    locationRes,
    isFollowingRes,
  ] = await Promise.all([
    followerCountPromise,
    followingCountPromise,
    postsPromise,
    commentsPromise,
    communityPromise,
    communityMembersPromise,
    medalsPromise,
    locationPromise,
    isFollowingPromise,
  ]);

  const isFollowing = viewerId ? (isFollowingRes.count ?? 0) > 0 : false;

  const posts = (postsRes.data ?? []) as PostRow[];
  const comments = (commentsRes.data ?? []) as CommentRow[];

  const activities: ActivityLogItem[] = [
    ...posts.map((p) => ({
      id: p.id,
      type: "post" as const,
      content: p.content,
      created_at: p.created_at,
      dateLabel: new Date(p.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    })),
    ...comments.map((c) => ({
      id: c.id,
      type: "comment" as const,
      content: c.content,
      created_at: c.created_at,
      dateLabel: new Date(c.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 15);

  const communityMembersData = (membersRes.data ?? []) as any[];
  const communityMembers: CommunityMember[] = communityMembersData.map((member) => ({
    role: member.role ?? "member",
    user: Array.isArray(member.user) ? member.user[0] ?? null : member.user ?? null,
  }));

  const medalsData = (medalsRes.data ?? []) as any[];
  const medals: Medal[] = medalsData.map((item) => ({
    id: item.id,
    key: item.medals?.key || "",
    name: item.medals?.name || "",
    description: item.medals?.description,
    earned_at: item.earned_at,
    metadata: item.metadata ?? null,
  }));

  // Create medal summary with counts
  // Start with all available medal types with 0 count
  const medalMap = new Map<string, { name: string; description?: string; count: number; firstEarnedAt?: string }>();

  // Initialize all available medals with count 0
  const allAvailableMedals = (medalsRes.allMedals ?? []) as any[];
  allAvailableMedals.forEach((medal) => {
    medalMap.set(medal.key, {
      name: medal.name,
      description: medal.description,
      count: 0,
      firstEarnedAt: undefined,
    });
  });

  // Update counts for earned medals
  medals.forEach((medal) => {
    if (medalMap.has(medal.key)) {
      const summary = medalMap.get(medal.key)!;
      if (medal.key === "battle_hero") {
        const metadataCount =
          typeof medal.metadata?.count === "number" ? medal.metadata.count : null;
        if (metadataCount && metadataCount > summary.count) {
          summary.count = metadataCount;
        } else {
          summary.count += 1;
        }
      } else {
        summary.count += 1;
      }
      // Update to earliest earned date
      if (!summary.firstEarnedAt || new Date(medal.earned_at) < new Date(summary.firstEarnedAt)) {
        summary.firstEarnedAt = medal.earned_at;
      }
    }
  });

  const medalSummary: MedalSummary[] = Array.from(medalMap.entries()).map(
    ([key, data]) => ({
      key,
      name: data.name,
      description: data.description,
      count: data.count,
      firstEarnedAt: data.firstEarnedAt,
    })
  );

  if (!profile.identity_json) {
    profile.identity_json = DEFAULT_IDENTITY_VECTOR;
  }

  // Add location name to profile
  const locationData = locationRes.data as any;
  if (locationData?.has_location) {
    // Use display_name as SINGLE SOURCE OF TRUTH
    (profile as any).current_location_name = locationData.display_name || locationData.custom_name || locationData.province_name || locationData.hex_id;
  }

  const isOwnProfile = viewerId ? viewerId === profile.id : false;

  return {
    profile,
    followerCount: followerRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
    isFollowing,
    isOwnProfile,
    viewerId,
    community: (communityRes.data as CommunityRow | null) ?? null,
    communityMembers,
    activityLog: activities,
    medals,
    medalSummary,
  };
}

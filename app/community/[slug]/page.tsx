import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isColumnMissingError, isSupabaseNetworkError } from "@/lib/utils";
import { PageSection } from "@/components/layout/page-section";
import { CommunityDetailsClient } from "@/components/community/community-details-client";
import type { Member } from "@/components/community/community-member-sheet";
// CommunityRegion type for community-details-client (snake_case)
type CommunityRegion = {
  hex_id: string;
  custom_name?: string | null;
  resource_yield: number;
  fortification_level: number;
  last_conquered_at?: string | null;
};
import { getCommunityIdeology } from "@/app/actions/ideology";
import type { IdeologySnapshot } from "@/lib/hooks/useIdeology";

type CommunityRow = {
  id: string;
  name: string | null;
  description: string | null;
  ideology_label: string | null;
  governance_type: string | null;
  members_count: number | null;
  slug?: string | null;
  color?: string | null;
  community_group_id?: string | null;
  work_tax_rate?: number | null;
  import_tariff_rate?: number | null;
  members?: CommunityMemberRow[];
};

type CommunityMemberRow = {
  user_id: string;
  role: Member["role"];
  rank_tier?: number | null;
  user:
    | {
        id: string;
        username: string | null;
        identity_label: string | null;
        avatar_url: string | null;
        military_rank_score?: number | null;
        battles_fought?: number | null;
        battles_won?: number | null;
        total_damage_dealt?: number | null;
        win_streak?: number | null;
        updated_at?: string | null;
        morale?: number | null;
        strength?: number | null;
    }
    | null;
};

type CommunityAnnouncementRow = {
  id: string;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
  announcement_type?: string | null;
  metadata?: {
    title?: string | null;
    content?: string | null;
    message?: string | null;
  } | null;
  proposer_id?: string | null;
};

type CommunityRegionRow = {
  hex_id: string;
  custom_name?: string | null;
  region_name?: string | null;
  province_name?: string | null;
  resource_yield?: number | null;
  fortification_level?: number | null;
  last_conquered_at?: string | null;
};

type AnnouncementPayload = {
  title?: string | null;
  content?: string | null;
  metadata?: {
    title?: string | null;
    content?: string | null;
    message?: string | null;
  } | null;
} | null;

function createAnnouncementPayload(
  row: CommunityAnnouncementRow | null | undefined,
): AnnouncementPayload {
  if (!row) return null;

  return {
    title: row.title ?? null,
    content: row.content ?? row.metadata?.content ?? row.metadata?.message ?? null,
    metadata: row.metadata ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return {
      title: "Community",
      description: "Community details and membership.",
    };
  }

  const decodedSlug = decodeURIComponent(slug);
  const supabase = await createSupabaseServerClient({ canSetCookies: false });
  const { data: community } = await supabase
    .from("communities")
    .select("name, description, slug")
    .eq("slug", decodedSlug)
    .maybeSingle();

  const name = community?.name ?? decodedSlug;
  const description =
    community?.description?.trim() ||
    `Learn about ${name}, its members, and ongoing events.`;

  const canonicalSlug = community?.slug ?? decodedSlug;
  const title = `Community: ${name}`;

  return {
    title,
    description,
    alternates: { canonical: `/community/${encodeURIComponent(canonicalSlug)}` },
    openGraph: {
      title,
      description,
      url: `/community/${encodeURIComponent(canonicalSlug)}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CommunityDetailPage({
  params,
}: {
  params: Promise<{ slug?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await params;

  if (!slug) notFound();

  const term = decodeURIComponent(slug);

  const { data: { user } } = await supabase.auth.getUser();
  const authUserId = user?.id ?? null;
  let viewerProfileId: string | null = null;
  let viewerProfileMainCommunity: string | null = null;
  let viewerProfileUsername: string | null = null;
  let viewerProfileAvatarUrl: string | null = null;

  if (authUserId) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("id, main_community_id, username, avatar_url")
      .eq("auth_id", authUserId)
      .maybeSingle();

    viewerProfileId = userProfile?.id ?? null;
    viewerProfileMainCommunity = userProfile?.main_community_id ?? null;
    viewerProfileUsername = userProfile?.username ?? null;
    viewerProfileAvatarUrl = userProfile?.avatar_url ?? null;
  }

  // Try to fetch with community_group_id and work_tax_rate, fall back if column doesn't exist yet
  let fullSelect = `
    id,
    name,
    description,
    ideology_label,
    governance_type,
    members_count,
    slug,
    color,
    work_tax_rate,
    import_tariff_rate,
    members:community_members(
      user_id,
      role,
      rank_tier,
      user:users(id, username, identity_label, avatar_url, military_rank_score, battles_fought, battles_won, total_damage_dealt, win_streak, updated_at, morale, strength)
    )
  `;

  // Check if community_group_id column exists (after migration)
  const { data: columnCheck } = await supabase
    .from("communities")
    .select("id")
    .limit(0);

  // If no error, try adding community_group_id to select
  if (!columnCheck || Array.isArray(columnCheck)) {
    try {
      // Test if column exists by attempting to select it
      await supabase.from("communities").select("community_group_id").limit(1);
      // If no error, add to select
      fullSelect = `
        id,
        name,
        description,
        ideology_label,
        governance_type,
        members_count,
        slug,
        color,
        community_group_id,
        work_tax_rate,
        import_tariff_rate,
        members:community_members(
          user_id,
          role,
          rank_tier,
          user:users(id, username, identity_label, avatar_url, military_rank_score, battles_fought, battles_won, total_damage_dealt, win_streak, updated_at, morale, strength)
        )
      `;
    } catch {
      // Column doesn't exist yet, use base select
    }
  }

  let community: CommunityRow | null = null;
  let communityError: { message?: string; details?: string; code?: string } | null = null;

  try {
    const { data: communityBySlug, error: slugError } = await supabase
      .from("communities")
      .select(fullSelect)
      .eq("slug", term)
      .maybeSingle<CommunityRow>();

    if (slugError) {
      communityError = slugError;
    }

    community = communityBySlug ?? null;

    if (!community) {
      const { data: communityById, error: idError } = await supabase
        .from("communities")
        .select(fullSelect)
        .eq("id", term)
        .maybeSingle<CommunityRow>();

      if (idError) {
        communityError = idError;
      }

      community = communityById ?? null;
    }
  } catch (error) {
    communityError = error as { message?: string; details?: string; code?: string };
  }

  if (communityError && !community) {
    if (isSupabaseNetworkError(communityError)) {
      console.warn("[CommunityPage] Supabase unavailable:", communityError);
      return (
        <PageSection noGap>
          <div className="mx-auto w-full max-w-4xl px-6 py-12">
            <div className="rounded-2xl border border-border/60 bg-card p-6 text-center shadow-[var(--surface-shadow)]">
              <h1 className="text-lg font-semibold text-foreground">
                Community temporarily unavailable
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We could not reach the community service. Please try again in a moment.
              </p>
            </div>
          </div>
        </PageSection>
      );
    }
    console.error("[CommunityPage] Fetch error:", communityError.message ?? communityError);
  }

  if (!community) {
    notFound();
  }

  const rawMembers = community.members ?? [];

  // Try to fetch with custom_name, fall back to legacy region_name if the column is missing
  let regionData: CommunityRegionRow[] | null = null;
  let regionError: { message?: string } | null = null;

  // First attempt with custom_name (after migration is applied)
  const { data: dataWithName, error: errorWithName } = await supabase
    .from("world_regions")
    .select(
      "hex_id, custom_name, province_name, resource_yield, fortification_level, last_conquered_at"
    )
    .eq("owner_community_id", community.id);

  if (errorWithName && isColumnMissingError(errorWithName, "custom_name")) {
    const { data: dataWithoutName, error: errorWithoutName } = await supabase
      .from("world_regions")
      .select(
        "hex_id, region_name, province_name, resource_yield, fortification_level, last_conquered_at"
      )
      .eq("owner_community_id", community.id);
    regionData = dataWithoutName;
    regionError = errorWithoutName;
  } else {
    regionData = dataWithName;
    regionError = errorWithName;
  }

  if (regionError) {
    console.error("[CommunityPage] Region fetch error:", regionError.message);
  }

  const occupiedRegions: CommunityRegion[] = (regionData ?? []).map((r): CommunityRegion => ({
    hex_id: r.hex_id,
    custom_name: r.custom_name ?? r.region_name ?? null,
    resource_yield: r.resource_yield ?? 0,
    fortification_level: r.fortification_level ?? 0,
    last_conquered_at: r.last_conquered_at ?? null,
  }));

  const isUserFounder = viewerProfileId
    ? rawMembers.some((member) => {
        const userData = Array.isArray(member.user) ? member.user[0] : member.user;
        // Check if user is sovereign (rank_tier === 0) - this covers both founder and claimed throne
        return userData?.id === viewerProfileId && member.rank_tier === 0;
      })
    : false;

  const isUserMember =
    viewerProfileMainCommunity === community.id ||
    (viewerProfileId
      ? rawMembers.some((member) => {
          const userData = Array.isArray(member.user) ? member.user[0] : member.user;
          return userData?.id === viewerProfileId;
        })
      : false);

  const members: Member[] = rawMembers.map((m) => {
    const userData = Array.isArray(m.user) ? m.user[0] : m.user;
    return {
      id: userData?.id ?? "unknown",
      user_id: m.user_id,
      username: userData?.username ?? "Unknown Operative",
      identity_label: userData?.identity_label ?? "Unknown",
      avatar_url: userData?.avatar_url ?? null,
      role: (m.role as Member["role"]) ?? "member",
      rank_tier: m.rank_tier ?? undefined,
      military_rank_score: userData?.military_rank_score ?? 0,
      battles_fought: userData?.battles_fought ?? 0,
      battles_won: userData?.battles_won ?? 0,
      total_damage_dealt: Number(userData?.total_damage_dealt ?? 0),
      strength: Number(userData?.strength ?? 0),
      win_streak: userData?.win_streak ?? 0,
      updated_at: userData?.updated_at ?? undefined,
      morale: userData?.morale ?? undefined,
    };
  });

  const moraleValues = rawMembers
    .map((member) => {
      const userData = Array.isArray(member.user) ? member.user[0] : member.user;
      return userData?.morale;
    })
    .filter((value): value is number => typeof value === "number");

  const averageMorale =
    moraleValues.length > 0
      ? moraleValues.reduce((sum, value) => sum + value, 0) / moraleValues.length
      : null;

  let viewerRankTier = viewerProfileId
    ? members.find((member) => member.id === viewerProfileId)?.rank_tier ?? null
    : null;

  if (viewerProfileId && viewerRankTier == null) {
    const { data: membership } = await supabase
      .from("community_members")
      .select("rank_tier")
      .eq("community_id", community.id)
      .eq("user_id", viewerProfileId)
      .maybeSingle();
    viewerRankTier = membership?.rank_tier ?? null;
  }

  const communityName = community.name ?? "Unknown Community";

  // Fetch ideology data server-side to avoid loading state in client
  let initialIdeology: IdeologySnapshot | null = null;
  let latestAnnouncement: AnnouncementPayload = null;

  try {
    const ideologyData = await getCommunityIdeology(community.id);
    initialIdeology = ideologyData;
  } catch (error) {
    console.error("[CommunityPage] Failed to fetch ideology data:", error);
    // Continue without ideology data - SWR will fetch on client if needed
  }

  // Fetch latest MESSAGE_OF_THE_DAY announcement (within last 24 hours)
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const announcementSelect = `
      id,
      title,
      content,
      created_at,
      announcement_type
    `;
    const announcementQuery = supabase
      .from("community_announcements")
      .select(announcementSelect)
      .eq("community_id", community.id)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    let announcementResult = await announcementQuery
      .eq("announcement_type", "message_of_the_day")
      .maybeSingle<CommunityAnnouncementRow>();

    if (isColumnMissingError(announcementResult.error, "announcement_type")) {
      announcementResult = await supabase
        .from("community_announcements")
        .select("id, title, content, created_at")
        .eq("community_id", community.id)
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<CommunityAnnouncementRow>();
    }

    if (announcementResult.error?.message?.includes("community_announcements")) {
      const { data: proposalAnnouncement } = await supabase
        .from("community_proposals")
        .select("id, metadata, created_at, proposer_id")
        .eq("community_id", community.id)
        .eq("law_type", "MESSAGE_OF_THE_DAY")
        .eq("status", "passed")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (proposalAnnouncement) {
        latestAnnouncement = createAnnouncementPayload(proposalAnnouncement);
      }
    } else if (announcementResult.data) {
      latestAnnouncement = createAnnouncementPayload(announcementResult.data);
    }
  } catch (error) {
    console.error("[CommunityPage] Failed to fetch announcement:", error);
  }

  return (
    <PageSection noGap>
      <CommunityDetailsClient
        communityId={community.id}
        communityName={communityName}
        communitySlug={community.slug ?? term}
        communityDescription={community.description}
        communityColor={community.color}
        communityGroupId={community.community_group_id ?? null}
        initialMembers={members}
        membersCount={members.length}
        averageMorale={averageMorale}
        occupiedRegions={occupiedRegions}
        isUserFounder={isUserFounder}
        isUserMember={isUserMember}
        governanceType={community.governance_type || "monarchy"}
        currentUserId={viewerProfileId ?? null}
        currentUsername={viewerProfileUsername}
        currentAvatarUrl={viewerProfileAvatarUrl}
        currentUserRankTier={viewerRankTier}
        initialIdeology={initialIdeology}
        latestAnnouncement={latestAnnouncement}
        workTaxRate={community.work_tax_rate ?? null}
        importTariffRate={community.import_tariff_rate ?? null}
      />
    </PageSection>
  );
}

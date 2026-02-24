import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { CommunityBrowser, type CommunitySummary } from "@/components/community/community-browser";
import { PageSection } from "@/components/layout/page-section";

export const metadata: Metadata = {
  title: "Communities",
  description: "Browse communities, compare stats, and find where you belong.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/community" },
};

export default async function CommunityPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/?auth=open");

  const { data: profile } = await supabase
    .from("users")
    .select("main_community_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/?auth=open");

  let communities: CommunitySummary[] | null = null;

  const { data: overviewData, error: overviewError } = await supabase.rpc(
    "get_communities_overview",
  );

  if (!overviewError && overviewData) {
    communities = overviewData;
  } else {
    // Fallback path (pre-migration): compute stats with additional queries
    const { data: communitiesData, error } = await supabase
      .from("communities")
      .select(
        "id, name, description, ideology_label, governance_type, color, members_count, slug",
      );

    if (!error && communitiesData) {
      const enrichedCommunities = await Promise.all(
        communitiesData.map(async (community) => {
          const { count: regionsCount } = await supabase
            .from("world_regions")
            .select("*", { count: "exact", head: true })
            .eq("owner_community_id", community.id);

          type MemberRow = { user?: { morale?: number | null } };
          const { data: membersData } = await supabase
            .from("community_members")
            .select("user:users(morale)")
            .eq("community_id", community.id);

          const morales =
            (membersData as MemberRow[] | null)
              ?.map((m) => m.user?.morale)
              .filter((morale): morale is number => typeof morale === "number") ?? [];

          const averageMorale =
            morales.length > 0
              ? morales.reduce((sum: number, m: number) => sum + m, 0) / morales.length
              : 0;

          return {
            ...community,
            regions_count: regionsCount ?? 0,
            average_morale: averageMorale,
          };
        })
      );

      communities = enrichedCommunities.sort(
        (a, b) => (b.members_count ?? 0) - (a.members_count ?? 0)
      );
    }
  }

  return (
    <PageSection>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Communities
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Explore active groups, compare stats, and find where you belong.
          </p>
        </div>

        <CommunityBrowser
          initialCommunities={communities ?? []}
          userCommunityId={profile.main_community_id}
        />
      </div>
    </PageSection>
  );
}

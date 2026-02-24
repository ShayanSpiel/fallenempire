import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "My Community",
  description: "Jump to your current community headquarters.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/community/my" },
};

export default async function MyCommunityPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=open");

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile?.id) redirect("/?auth=open");

  // Get the first community the user is a member of
  const { data: membershipsData } = await supabase
    .from("community_members")
    .select("community_id, communities(slug)")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(1);

  type CommunityRef = { slug: string | null };
  type MembershipRow = { community_id: string; communities: CommunityRef | CommunityRef[] | null };
  const memberships = (membershipsData ?? []) as MembershipRow[];

  if (!memberships || memberships.length === 0) {
    // No community membership, redirect to browse communities
    redirect("/community");
  }

  const membership = memberships[0];
  const communitiesData = membership.communities;
  const communities = Array.isArray(communitiesData)
    ? communitiesData
    : communitiesData ? [communitiesData] : [];

  if (communities.length === 0) {
    notFound();
  }

  const community = communities[0] as { slug?: string } | null;
  if (!community?.slug) {
    notFound();
  }

  // Redirect to the community details page
  redirect(`/community/${community.slug}`);
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ProfileView } from "../profile-view";
import { loadProfileViewModel } from "../profile-data";
import type { ProfileRecord } from "../types";

type ProfilePageProps = {
  params: Promise<{
    username?: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;

  if (!username) {
    return {
      title: "Profile",
      description: "Player profile.",
    };
  }

  const supabase = await createSupabaseServerClient({ canSetCookies: false });
  const { data: profile } = await supabase
    .from("users")
    .select("username, identity_label")
    .eq("username", username)
    .maybeSingle();

  const handle = profile?.username ?? username;
  const identityLabel = profile?.identity_label ?? null;
  const title = identityLabel ? `@${handle} — ${identityLabel}` : `@${handle}`;

  return {
    title,
    description:
      "Player profile with stats, medals, identity alignment, and recent activity.",
    alternates: { canonical: `/profile/${encodeURIComponent(username)}` },
    openGraph: {
      title,
      description:
        "Player profile with stats, medals, identity alignment, and recent activity.",
      url: `/profile/${encodeURIComponent(username)}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description:
        "Player profile with stats, medals, identity alignment, and recent activity.",
    },
  };
}

export default async function UsernameProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  if (!username) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select(
      "id, username, identity_label, identity_json, freewill, coherence, power_mental, power_physical, avatar_url, banner_url, main_community_id, created_at, total_xp, energy, morale, is_bot, current_military_rank, military_rank_score, total_damage_dealt, battles_fought, battles_won, highest_damage_battle, win_streak"
    )
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const viewModel = await loadProfileViewModel(supabase, profile as ProfileRecord, user?.id ?? null);
  return <ProfileView {...viewModel} />;
}

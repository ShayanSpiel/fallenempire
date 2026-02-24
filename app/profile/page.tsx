import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { ProfileView } from "./profile-view";
import { loadProfileViewModel } from "./profile-data";
import type { ProfileRecord } from "./types";

const BASE_PROFILE_SELECTION =
  "id, username, identity_label, identity_json, freewill, coherence, power_mental, power_physical, main_community_id, created_at, total_xp, energy, morale, is_bot, current_military_rank, military_rank_score, total_damage_dealt, battles_fought, battles_won, highest_damage_battle, win_streak";
const EXTENDED_PROFILE_SELECTION = `${BASE_PROFILE_SELECTION}, banner_url, avatar_url`;

type ProfileSelectRow = Omit<ProfileRecord, "banner_url" | "avatar_url"> & {
  banner_url?: string | null;
  avatar_url?: string | null;
};

export const metadata: Metadata = {
  title: "My Profile",
  description: "Your stats, identity alignment, medals, and activity history.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/profile" },
};

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=open");
  }

  let profileResponse: PostgrestSingleResponse<ProfileSelectRow | null> = await supabase
    .from("users")
    .select(EXTENDED_PROFILE_SELECTION)
    .eq("auth_id", user.id)
    .maybeSingle();

  if (profileResponse.error) {
    console.warn("Profile fetch failed, retrying without optional columns", profileResponse.error.message);
    const fallback = await supabase
      .from("users")
      .select(BASE_PROFILE_SELECTION)
      .eq("auth_id", user.id)
      .maybeSingle();
    profileResponse = fallback as PostgrestSingleResponse<ProfileSelectRow | null>;
  }

  const sessionProfile = profileResponse.data;

  if (!sessionProfile) {
    redirect("/?auth=open");
  }

  const normalizedProfile: ProfileRecord = {
    ...sessionProfile,
    banner_url: sessionProfile.banner_url ?? null,
    avatar_url: sessionProfile.avatar_url ?? null,
  };

  const viewModel = await loadProfileViewModel(supabase, normalizedProfile, sessionProfile.id);

  return <ProfileView {...viewModel} />;
}

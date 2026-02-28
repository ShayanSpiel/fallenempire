import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { selectUserProfile, type UserProfileRow } from "@/lib/user-profile";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your profile, avatar, and preferences.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/settings" },
};

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=open");
  }

  const BASIC_PROFILE_SELECT = `
    id,
    username,
    avatar_url,
    identity_label
  `;

  let profile: UserProfileRow | null = null;
  let profileError: PostgrestError | null = null;

  try {
    profile = await selectUserProfile(supabase, user.id);
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      profileError = error as PostgrestError;
    } else if (error instanceof Error) {
      profileError = { message: error.message } as PostgrestError;
    }
  }

  if (!profile && profileError) {
    console.warn("Settings profile query failed, retrying minimal selection", profileError.message);
    const fallback = await supabase
      .from("users")
      .select(BASIC_PROFILE_SELECT)
      .eq("auth_id", user.id)
      .maybeSingle();
    profile = fallback.data;
    profileError = fallback.error ?? profileError;
    if (profileError) {
      console.error("Settings profile fallback error", profileError);
    }
  }

  if (!profile) {
    redirect("/?auth=open");
  }

  const normalizedProfile: Parameters<typeof SettingsView>[0]["profile"] = {
    id: profile.id,
    username: profile.username ?? user.email ?? "Agent",
    avatar_url: profile.avatar_url ?? null,
    identity_label: profile.identity_label ?? null,
    user_tier: (profile.user_tier as 'alpha' | 'sigma' | 'omega') ?? 'alpha',
    avatar_style: profile.avatar_style ?? null,
    avatar_background_color: profile.avatar_background_color ?? null,
    avatar_hair: profile.avatar_hair ?? null,
    avatar_eyes: profile.avatar_eyes ?? null,
    avatar_mouth: profile.avatar_mouth ?? null,
    avatar_nose: profile.avatar_nose ?? null,
    avatar_base_color: profile.avatar_base_color ?? null,
    avatar_hair_color: profile.avatar_hair_color ?? null,
    avatar_eyebrows: profile.avatar_eyebrows ?? null,
    avatar_eye_shadow_color: profile.avatar_eye_shadow_color ?? null,
    avatar_facial_hair: profile.avatar_facial_hair ?? null,
    avatar_ears: profile.avatar_ears ?? null,
    avatar_earrings: profile.avatar_earrings ?? null,
    avatar_earring_color: profile.avatar_earring_color ?? null,
    avatar_glasses: profile.avatar_glasses ?? null,
    avatar_glasses_color: profile.avatar_glasses_color ?? null,
    avatar_shirt: profile.avatar_shirt ?? null,
    avatar_shirt_color: profile.avatar_shirt_color ?? null,
  };

  return <SettingsView profile={normalizedProfile} />;
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SubscribeView } from "./subscribe-view";

export const metadata: Metadata = {
  title: "Support",
  description: "Support the game and gain status as a patron.",
  robots: { index: false, follow: false },
};

export default async function SubscribePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=open");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, user_tier")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  return (
    <SubscribeView
      userTier={(profile.user_tier as "alpha" | "sigma" | "omega") || "alpha"}
    />
  );
}

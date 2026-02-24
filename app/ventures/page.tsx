import { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { VenturesView } from "./ventures-view";

export const metadata: Metadata = {
  title: "Ventures | Eintelligence",
  description: "Manage your companies and work contracts",
};

export default async function VenturesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Get public user ID
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  return <VenturesView userId={profile.id} />;
}

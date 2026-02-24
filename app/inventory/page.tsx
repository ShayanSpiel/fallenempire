import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { InventoryPageClient } from "@/components/economy/inventory-page-client";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Your personal inventory of resources and items",
  robots: { index: false, follow: false },
  alternates: { canonical: "/inventory" },
};

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=open");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/?auth=open");
  }

  return <InventoryPageClient userId={profile.id} />;
}

import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase-server"
import { MedalNotificationProvider } from "@/components/medals/medal-notification-provider"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: battle } = await supabase
    .from("battles")
    .select("target_hex_id")
    .eq("id", id)
    .maybeSingle()

  const targetHexId = battle?.target_hex_id ?? null
  const { data: region } = targetHexId
    ? await supabase
        .from("world_regions")
        .select("custom_name")
        .eq("hex_id", targetHexId)
        .maybeSingle()
    : { data: null }

  const fallbackLabel = targetHexId ? `#${targetHexId}` : "Unknown Location";
  const regionLabel = region?.custom_name || fallbackLabel;

  return {
    title: targetHexId ? `Battle of ${regionLabel}` : "Battle",
    description: "Battle details, live progress, and combat logs.",
    robots: { index: false, follow: false },
    alternates: { canonical: `/battle/${id}` },
  }
}

export default async function BattleLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/?auth=open")
  }

  return <MedalNotificationProvider>{children}</MedalNotificationProvider>
}

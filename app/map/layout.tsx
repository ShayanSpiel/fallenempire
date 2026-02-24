import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase-server"

export const metadata: Metadata = {
  title: "World Map",
  description: "Explore the world map, territory control, and active conflicts.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/map" },
}

export default async function MapLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/?auth=open")
  }

  return children
}


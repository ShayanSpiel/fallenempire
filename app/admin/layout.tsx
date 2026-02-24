import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase-server"

export const metadata: Metadata = {
  title: "Admin",
  description: "Administrative controls and monitoring.",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/?auth=open")
  }

  return children
}


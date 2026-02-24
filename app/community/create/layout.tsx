import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase-server"

export const metadata: Metadata = {
  title: "Create Community",
  description: "Start a new community and define its purpose.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/community/create" },
}

export default async function CreateCommunityLayout({
  children,
}: {
  children: ReactNode
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/?auth=open")
  }

  return children
}


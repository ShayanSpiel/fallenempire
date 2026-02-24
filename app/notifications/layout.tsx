import type { Metadata } from "next"
import type { ReactNode } from "react"
import { redirect } from "next/navigation"

import { createSupabaseServerClient } from "@/lib/supabase-server"

export const metadata: Metadata = {
  title: "Notifications",
  description: "Your alerts for messages, world events, and community updates.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/notifications" },
}

export default async function NotificationsLayout({
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

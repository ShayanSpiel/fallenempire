import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Top players and communities ranked by performance and influence.",
  alternates: { canonical: "/leaderboard" },
}

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return children
}


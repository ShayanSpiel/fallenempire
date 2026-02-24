import type { Metadata } from "next"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Administrative monitoring and system controls.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/admin/dashboard" },
}

export default function AdminDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return children
}


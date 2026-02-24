import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export const metadata: Metadata = {
  title: "Prototype World Map",
  description: "Temporary prototype map route for testing.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/prototype/map" },
};

export default async function PrototypeMapLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?auth=open");
  }

  return children;
}


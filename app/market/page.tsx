import { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { MarketView } from "./market-view";
import { getAllCommunityCurrencies } from "@/lib/currency-system";

export const metadata: Metadata = {
  title: "Market | Eintelligence",
  description: "Trade resources, find jobs, and exchange currencies",
};

export default async function MarketPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const communityCurrencies = await getAllCommunityCurrencies();

  return <MarketView communityCurrencies={communityCurrencies} />;
}

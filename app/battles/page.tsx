import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { BattleBrowser } from "@/components/battles/battle-browser";
import { PageSection } from "@/components/layout/page-section";

// Resolve region name with fallback
function resolveRegionName(customName?: string | null, provinceName?: string | null): string | null {
  const normalizedCustom = customName?.trim();
  if (normalizedCustom) return normalizedCustom;
  const normalizedProvince = provinceName?.trim();
  if (normalizedProvince) return normalizedProvince;
  return null;
}

// Hydrate battles with region names from world_regions
async function hydrateBattlesWithRegionNames<T extends { target_hex_id: string; custom_name: string | null; province_name?: string | null }>(
  supabase: SupabaseClient,
  items: T[]
): Promise<T[]> {
  const allHexIds = items
    .map((item) => item.target_hex_id?.trim())
    .filter((hexId): hexId is string => Boolean(hexId));

  if (allHexIds.length === 0) return items;

  // Use display_name - SINGLE SOURCE OF TRUTH
  const { data: regions, error } = await supabase
    .from("world_regions")
    .select("hex_id, display_name")
    .in("hex_id", allHexIds);

  if (error) {
    console.error("Error fetching region names:", error);
    return items;
  }

  const regionByHexId = new Map(
    (regions || []).map((region) => [
      region.hex_id,
      region.display_name,
    ])
  );

  return items.map((item) => {
    const hexId = item.target_hex_id?.trim();
    if (!hexId) return item;
    const displayName = regionByHexId.get(hexId);
    return {
      ...item,
      custom_name: displayName ?? `#${hexId}`,
      province_name: null,
    };
  });
}

export const metadata: Metadata = {
  title: "Battles",
  description: "Monitor active warzones, historic battles, and ongoing sieges across the map.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/battles" },
};

export default async function BattlesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/?auth=open");

  const { data: battles, error } = await supabase
    .from("battles")
    .select(`
      id,
      target_hex_id,
      status,
      ends_at,
      current_defense,
      initial_defense,
      attacker:communities!attacker_community_id(id, name, slug, color, logo_url),
      defender:communities!defender_community_id(id, name, slug, color, logo_url)
    `)
    .order("created_at", { ascending: false });

  // Add custom_name and province_name fields initialized to null for hydration
  const battlesWithField = (battles || []).map(b => ({ ...b, custom_name: null, province_name: null }));

  const { data: communities } = await supabase
    .from("communities")
    .select("id, name, color")
    .order("name");

  if (error) {
    console.error("Error fetching battles:", error);
  }

  // Hydrate battles with region custom names
  const battlesWithRegionNames = await hydrateBattlesWithRegionNames(supabase, battlesWithField);

  return (
    <PageSection>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Global Conflict
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Monitor active warzones, historic battles, and ongoing sieges across the map.
          </p>
        </div>

        <BattleBrowser
          initialBattles={battlesWithRegionNames}
          communities={communities ?? []}
        />
      </div>
    </PageSection>
  );
}

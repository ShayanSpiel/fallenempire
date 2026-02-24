"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export interface CommunityRegion {
  hex_id: string;
  fortification_level: number;
  resource_yield: number;
  last_conquered_at: string;
  custom_name: string | null;
  province_name?: string | null;
}

/**
 * Get all regions owned by a community
 */
export async function getCommunityRegions(
  communityId: string
): Promise<CommunityRegion[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_community_regions_with_data", {
    p_community_id: communityId,
  });

  if (error) {
    console.error("Error fetching community regions:", error);
    return [];
  }

  return (data || []) as CommunityRegion[];
}

/**
 * Get total region count for a community
 */
export async function getCommunityRegionCount(
  communityId: string
): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("get_community_region_count", {
    p_community_id: communityId,
  });

  if (error) {
    console.error("Error fetching region count:", error);
    return 0;
  }

  return data || 0;
}

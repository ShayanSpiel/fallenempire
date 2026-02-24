/**
 * Custom hooks for game data fetching with caching and error handling
 * Uses SWR for efficient data management
 */

import useSWR from "swr";
import type { RegionOwnersMap, DiplomacyMap, ActiveBattleRow } from "@/components/map/region-types";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const supabase = createSupabaseBrowserClient();

/**
 * Fetch strategy for regions with caching
 */
export const useRegions = (shouldFetch = true) => {
  const { data, error, isLoading, mutate } = useSWR<RegionOwnersMap>(
    shouldFetch ? "regions_all" : null,
    async () => {
      const { data } = await supabase
        .from("world_regions")
        .select("hex_id, owner_community_id, fortification_level, resource_yield, communities ( id, name, color )");

      const map: RegionOwnersMap = {};
      (data ?? []).forEach((row: any) => {
        if (!row?.hex_id) return;
        map[row.hex_id] = {
          hex_id: row.hex_id,
          owner_community_id: row.owner_community_id ?? null,
          fortification_level: row.fortification_level ?? 1000,
          resource_yield: row.resource_yield ?? 10,
          communities: Array.isArray(row.communities) ? row.communities[0] ?? null : row.communities ?? null,
        };
      });
      return map;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000, // 1 minute cache
      focusThrottleInterval: 300000, // 5 minutes between refocus checks
    }
  );

  return { regions: data || {}, isLoading, error, mutate };
};

/**
 * Fetch strategy for diplomacy states with caching
 */
export const useDiplomacyStates = (shouldFetch = true) => {
  const { data, error, isLoading, mutate } = useSWR<DiplomacyMap>(
    shouldFetch ? "diplomacy_states_all" : null,
    async () => {
      const { data } = await supabase
        .from("diplomacy_states")
        .select("initiator_community_id, target_community_id, status");

      const map: DiplomacyMap = {};
      (data ?? []).forEach((row: any) => {
        if (!row?.initiator_community_id || !row?.target_community_id) return;
        const key = `${row.initiator_community_id}_${row.target_community_id}`;
        map[key] = row.status;
      });
      return map;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
      focusThrottleInterval: 300000,
    }
  );

  return { diplomacyStates: data || {}, isLoading, error, mutate };
};

/**
 * Fetch strategy for active battles with caching
 */
export const useActiveBattles = (shouldFetch = true) => {
  const { data, error, isLoading, mutate } = useSWR<ActiveBattleRow[]>(
    shouldFetch ? "battles_active" : null,
    async () => {
      const { data } = await supabase
        .from("battles")
        .select(
          `
            id,
            target_hex_id,
            status,
            ends_at,
            started_at,
            current_defense,
            initial_defense,
            attacker_score,
            defender_score,
            attacker_community_id,
            defender_community_id,
            attacker:communities!attacker_community_id(id, name, slug, color),
            defender:communities!defender_community_id(id, name, slug, color)
          `
        )
        .eq("status", "active");

      return data ?? [];
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds (more frequent for battles)
      focusThrottleInterval: 60000,
    }
  );

  return { battles: data || [], isLoading, error, mutate };
};

/**
 * Fetch single region data with caching
 */
export const useRegion = (hexId: string | null) => {
  const { data, error, isLoading, mutate } = useSWR(
    hexId ? `region_${hexId}` : null,
    async () => {
      if (!hexId) return null;

      const { data } = await supabase
        .from("world_regions")
        .select("*, communities ( id, name, color )")
        .eq("hex_id", hexId)
        .maybeSingle();

      return data ?? null;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
    }
  );

  return { region: data, isLoading, error, mutate };
};

/**
 * Manual cache invalidation
 * Call when you know data has changed
 */
export const invalidateGameCache = async () => {
  // This would be called to refresh all game data
  // In a real app, this would trigger all SWR hooks to revalidate
  return Promise.all([]);
};

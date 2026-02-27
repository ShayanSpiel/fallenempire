"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import ErrorBoundary from "@/components/error-boundary";
import { debug, error as logError } from "@/lib/logger";
import type {
  RegionOwnerRow,
  RegionOwnersMap,
  RawRegionRow,
  DiplomacyMap,
  DiplomacyStatus,
  ActiveBattleRow,
} from "@/components/map/region-types";
import { makeDiplomacyKey } from "@/components/map/region-types";
import { getHexNeighbors } from "@/components/map/hex-utils";
import { ActionMode, type RegionActionResult } from "@/components/map/region-drawer";
import { globalPerformanceMonitor } from "@/lib/performance-monitor";
import { hasFullGovernanceAuthority, hasGovernanceAuthority } from "@/lib/governance";

const HexMap = dynamic(() => import("@/components/map/hex-map"), { ssr: false });
const MAP_LOG_MODULE = "PrototypeMapPage";

const PROTOTYPE_SHADER_DEMOS: undefined = undefined;

const normalizeRegion = (row: RawRegionRow | null, hexId: string): RegionOwnerRow => {
  const communitiesSource = row?.communities;
  const normalizedCommunity = Array.isArray(communitiesSource)
    ? communitiesSource[0] ?? null
    : communitiesSource ?? null;

  return {
    hex_id: hexId,
    custom_name: row?.custom_name ?? null,
    owner_community_id: row?.owner_community_id ?? null,
    fortification_level: row?.fortification_level ?? 1000,
    resource_yield: row?.resource_yield ?? 10,
    communities: normalizedCommunity,
  };
};

export default function PrototypeMapPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [regionMap, setRegionMap] = useState<RegionOwnersMap>({});
  const [regionsLoaded, setRegionsLoaded] = useState(false);
  const [diplomacyMap, setDiplomacyMap] = useState<DiplomacyMap>({});
  const [activeBattles, setActiveBattles] = useState<ActiveBattleRow[]>([]);
  const [userCommunityId, setUserCommunityId] = useState<string | null>(null);
  const [userRankTier, setUserRankTier] = useState<number | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const mountedRef = useRef(true);
  const [actionResult, setActionResult] = useState<RegionActionResult | null>(null);
  const handleSelectionChange = useCallback((hexId: string | null) => {
    setSelectedHex(hexId);
    setActionResult(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchBattles = useCallback(async () => {
    const startTime = performance.now();
    globalPerformanceMonitor.startNetworkRequest();

    const { data, error } = await supabase
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

    globalPerformanceMonitor.endNetworkRequest(performance.now() - startTime);

    if (error) {
      logError("Failed to load active battles", error);
      return;
    }

    if (!mountedRef.current) return;
    setActiveBattles(data ?? []);
  }, [supabase]);

  const fetchRegions = useCallback(async () => {
    const startTime = performance.now();
    globalPerformanceMonitor.startNetworkRequest();

    // Fetch regions without the communities join to avoid RLS bottleneck
    const { data: regions } = await supabase
      .from("world_regions")
      .select("hex_id, custom_name, province_name, owner_community_id, fortification_level, resource_yield");

    const map: RegionOwnersMap = {};

    // Process regions and collect unique community IDs
    const communityIds = new Set<string>();
    (regions ?? []).forEach((row: any) => {
      if (!row?.hex_id) return;
      map[row.hex_id] = normalizeRegion(row, row.hex_id);
      if (row.owner_community_id) {
        communityIds.add(row.owner_community_id);
      }
    });

    // Fetch all communities in one batch query (much more efficient than the join)
    if (communityIds.size > 0) {
      const { data: communities } = await supabase
        .from("communities")
        .select("id, name, color")
        .in("id", Array.from(communityIds));

      // Map communities by ID for quick lookup
      const communityMap: Record<string, any> = {};
      (communities ?? []).forEach((c: any) => {
        communityMap[c.id] = c;
      });

      // Merge community data into regions
      Object.values(map).forEach((region: any) => {
        if (region.owner_community_id && communityMap[region.owner_community_id]) {
          region.communities = communityMap[region.owner_community_id];
        }
      });
    }

    const elapsed = performance.now() - startTime;
    globalPerformanceMonitor.endNetworkRequest(elapsed);

    setRegionMap(map);
    setRegionsLoaded(true);
  }, [supabase]);

  const fetchDiplomacyStates = useCallback(async () => {
    const startTime = performance.now();
    globalPerformanceMonitor.startNetworkRequest();

    const { data, error } = await supabase
      .from("diplomacy_states")
      .select("initiator_community_id, target_community_id, status");

    globalPerformanceMonitor.endNetworkRequest(performance.now() - startTime);

    if (error) {
      logError("Failed to load diplomacy states", error);
      return;
    }

    const map: DiplomacyMap = {};
    (data ?? []).forEach((row: any) => {
      if (!row?.initiator_community_id || !row?.target_community_id || !row.status) return;
      const key = makeDiplomacyKey(row.initiator_community_id, row.target_community_id);
      map[key] = row.status as DiplomacyStatus;
    });
    setDiplomacyMap(map);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function getUserCommunity() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          router.replace("/?auth=open");
        }
        return;
      }

      if (!mounted) return;

      const { data: profile } = await supabase
        .from("users")
        .select("id, main_community_id")
        .eq("auth_id", user.id)
        .maybeSingle();
      if (!profile || !mounted) return;

      if (profile.main_community_id) {
        const { data: member } = await supabase
          .from("community_members")
          .select("community_id, rank_tier")
          .eq("user_id", profile.id)
          .eq("community_id", profile.main_community_id)
          .maybeSingle();
        if (mounted) {
          setUserCommunityId(member?.community_id ?? null);
          setUserRankTier(member?.rank_tier ?? null);
        }
      }
    }

    getUserCommunity();
    return () => {
      mounted = false;
    };
  }, [supabase, router]);

  // Consolidated game state subscriptions for better performance and reduced setup overhead
  useEffect(() => {
    let mounted = true;
    const channels: ReturnType<typeof supabase.channel>[] = [];
    let regionUpdateTimeout: NodeJS.Timeout | null = null;
    let battleUpdateTimeout: NodeJS.Timeout | null = null;
    const pendingRegionUpdates = new Set<string>();

    // Load initial data for all subscriptions
    Promise.all([fetchRegions(), fetchDiplomacyStates()]).catch((err) =>
      logError("Failed to load initial game state", err)
    );

    fetchBattles();

    // Batched region updates to prevent hammering the database on multiple changes
    const processPendingRegionUpdates = async () => {
      if (!mounted || pendingRegionUpdates.size === 0) return;

      const hexIds = Array.from(pendingRegionUpdates);
      pendingRegionUpdates.clear();

      const startTime = performance.now();
      globalPerformanceMonitor.startNetworkRequest();

      // Fetch all updated regions without the communities join to avoid RLS bottleneck
      const { data } = await supabase
        .from("world_regions")
        .select("hex_id, owner_community_id, fortification_level, resource_yield")
        .in("hex_id", hexIds);

      // If there are any regions with owners, fetch community data in batch
      if (data && data.length > 0) {
        const ownerIds = Array.from(
          new Set(data.filter((r: any) => r.owner_community_id).map((r: any) => r.owner_community_id))
        );
        if (ownerIds.length > 0) {
          const { data: communities } = await supabase
            .from("communities")
            .select("id, name, color")
            .in("id", ownerIds);

          const communityMap: Record<string, any> = {};
          (communities ?? []).forEach((c: any) => {
            communityMap[c.id] = c;
          });

          // Merge communities into regions
          data.forEach((region: any) => {
            if (region.owner_community_id && communityMap[region.owner_community_id]) {
              region.communities = [communityMap[region.owner_community_id]];
            }
          });
        }
      }

      globalPerformanceMonitor.endNetworkRequest(performance.now() - startTime);

      if (!mounted || !data) return;

      setRegionMap((prev) => {
        const next = { ...prev };
        for (const row of data) {
          const normalized = normalizeRegion(row, row.hex_id);
          next[row.hex_id] = normalized;

        }
        return next;
      });
    };

    // Consolidated channel setup for world regions - DEBOUNCED
    // TEMP DISABLED: Realtime updates causing constant rebuilds
    // const regionChannel = supabase
    //   .channel("game_state_regions")
    //   .on(
    //     "postgres_changes",
    //     {
    //       event: "*",
    //       schema: "public",
    //       table: "world_regions",
    //     },
    //     (payload: any) => {
    //       if (!mounted) return;
    //       const { new: newRow, old: oldRow } = payload as {
    //         new?: { hex_id?: string };
    //         old?: { hex_id?: string };
    //       };
    //       const hexId = newRow?.hex_id ?? oldRow?.hex_id;
    //       if (!hexId) return;
    //
    //       // Queue the update instead of fetching immediately
    //       pendingRegionUpdates.add(hexId);
    //
    //       // Debounce: batch updates for 250ms to reduce request frequency
    //       if (regionUpdateTimeout) clearTimeout(regionUpdateTimeout);
    //       regionUpdateTimeout = setTimeout(processPendingRegionUpdates, 250);
    //     }
    //   )
    //   .subscribe();
    // channels.push(regionChannel);

    // Consolidated channel setup for diplomacy states
    const diplomacyChannel = supabase
      .channel("game_state_diplomacy_prototype")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "diplomacy_states",
        },
        (payload: any) => {
          if (!mounted) return;
          const record =
            (payload.new as Partial<{
              initiator_community_id: string;
              target_community_id: string;
              status: DiplomacyStatus;
            }>) ?? payload.old;
          if (!record?.initiator_community_id || !record?.target_community_id) return;
          const key = makeDiplomacyKey(record.initiator_community_id, record.target_community_id);

          setDiplomacyMap((prev) => {
            const next = { ...prev };
            if (payload.eventType === "DELETE" || !record?.status) {
              delete next[key];
            } else {
              next[key] = record.status;
            }
            return next;
          });
        }
      )
      .subscribe();
    channels.push(diplomacyChannel);

    // Consolidated channel setup for battles - DEBOUNCED to prevent spamming loadBattles
    const battleChannel = supabase
      .channel("game_state_battles_prototype")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "battles",
        },
        () => {
          if (!mounted) return;
          if (battleUpdateTimeout) clearTimeout(battleUpdateTimeout);
          battleUpdateTimeout = setTimeout(() => {
            void fetchBattles();
          }, 150);
        }
      )
      .subscribe();
    channels.push(battleChannel);

    // Cleanup: remove all channels on unmount
    return () => {
      mounted = false;
      if (regionUpdateTimeout) clearTimeout(regionUpdateTimeout);
      if (battleUpdateTimeout) clearTimeout(battleUpdateTimeout);
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [supabase, fetchRegions, fetchDiplomacyStates, fetchBattles]);

  const userRegionCount = useMemo(() => {
    if (!userCommunityId) return 0;
    return Object.values(regionMap).filter((region) => region.owner_community_id === userCommunityId).length;
  }, [regionMap, userCommunityId]);

  const targetRegion = useMemo(() => {
    if (!selectedHex) return null;
    const existing = regionMap[selectedHex];
    if (existing) return existing;
    if (!regionsLoaded) return null;
    return normalizeRegion(null, selectedHex);
  }, [selectedHex, regionMap, regionsLoaded]);
  const activeBattleForSelectedHex = useMemo(() => {
    if (!selectedHex) return null;
    return (
      activeBattles.find(
        (battle) => battle.status === "active" && battle.target_hex_id === selectedHex
      ) ?? null
    );
  }, [activeBattles, selectedHex]);
  const activeBattleIdForSelectedHex = activeBattleForSelectedHex?.id ?? null;
  const isTargetOwnedByMe = targetRegion?.owner_community_id === userCommunityId;
  const isTargetOwnerNull = !targetRegion?.owner_community_id;
  const hasLeadershipAuthority = hasGovernanceAuthority(userRankTier);

  const isNeighboringMyTerritory = useMemo(() => {
    if (!selectedHex || !userCommunityId) return false;
    const neighbors = getHexNeighbors(selectedHex);
    return neighbors.some((neighborId) => regionMap[neighborId]?.owner_community_id === userCommunityId);
  }, [selectedHex, regionMap, userCommunityId]);

  const canFirstClaim =
    hasFullGovernanceAuthority(userRankTier) && userRegionCount === 0 && isTargetOwnerNull;
  const canExpandOrAttack =
    hasLeadershipAuthority && userRegionCount > 0 && isNeighboringMyTerritory && !isTargetOwnedByMe;
  const isAttackable = canFirstClaim || canExpandOrAttack;

  const actionMode: ActionMode = useMemo(() => {
    if (!selectedHex || !userCommunityId || !targetRegion || !isAttackable) {
      return "HIDDEN";
    }
    if (activeBattleIdForSelectedHex) {
      return "HIDDEN";
    }
    if (targetRegion.owner_community_id === userCommunityId) {
      return "MANAGE";
    }
    if (canFirstClaim) {
      return "CLAIM";
    }
    return "ATTACK";
  }, [
    selectedHex,
    userCommunityId,
    targetRegion,
    isAttackable,
    canFirstClaim,
    activeBattleIdForSelectedHex,
  ]);

  const handleFight = useCallback(async (): Promise<{ battleId?: string }> => {
    if (!selectedHex || actionMode === "HIDDEN" || isActionLoading) return {};

    debug(MAP_LOG_MODULE, "Fight button clicked", {
      selectedHex,
      actionMode,
      targetRegion,
      userCommunityId,
    });

    setIsActionLoading(true);
    setActionResult(null);
    try {
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError || !data?.user) {
        debug(MAP_LOG_MODULE, "Authentication failed before action", { authError });
        throw new Error("Please sign in before issuing commands.");
      }

      if (actionMode === "CLAIM") {
        debug(MAP_LOG_MODULE, "Branch: CLAIM (invoking claim_region_unopposed)", {
          hexId: selectedHex,
          userCommunityId,
        });
        const { data: claimedHex, error: claimError } = await supabase.rpc("claim_region_unopposed", {
          p_community_id: userCommunityId,
          p_target_hex_id: selectedHex,
        });
        debug(MAP_LOG_MODULE, "claim_region_unopposed response", { claimedHex, claimError });
        if (claimError) throw claimError;
        await fetchRegions();
        debug(MAP_LOG_MODULE, "Regions refreshed after claim");
        setActionResult({
          kind: "firstClaim",
          targetLabel: selectedHex,
        });
        alert("Territory claimed!");
        return {};
      } else if (actionMode === "ATTACK") {
        debug(MAP_LOG_MODULE, "Branch: ATTACK (starting battle)", { hexId: selectedHex, userCommunityId });
        const response = await fetch("/api/battle/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attackerCommunityId: userCommunityId,
            targetHexId: selectedHex,
          }),
        });
        const payload = await response.json().catch(() => null);
        debug(MAP_LOG_MODULE, "Battle start API response", { payload });
        if (!response.ok || !payload?.battleId) {
          throw new Error(payload?.error || "Battle failed.");
        }
        const battleId = payload.battleId as string;
        await fetchRegions();
        debug(MAP_LOG_MODULE, "Regions refreshed after battle start");
        const ownerLabel = targetRegion?.communities?.name ?? selectedHex;
        setActionResult({
          kind: targetRegion?.communities?.name ? "attack-enemy" : "attack-unclaimed",
          targetLabel: ownerLabel,
          battleId,
        });
        return { battleId };
      }
      return {};
    } catch (error) {
      logError("Action failed:", error);
      const message = error instanceof Error ? error.message : "Please try again.";
      alert(`Action failed: ${message}`);
      return {};
    } finally {
      setIsActionLoading(false);
    }
  }, [actionMode, selectedHex, userCommunityId, supabase, fetchRegions, router, targetRegion, isActionLoading]);

  const handleReloadData = useCallback(async () => {
    debug(MAP_LOG_MODULE, "Reloading region data");
    setActionResult(null);
    await Promise.all([fetchRegions(), fetchDiplomacyStates(), fetchBattles()]);
  }, [fetchRegions, fetchDiplomacyStates, fetchBattles]);

  const handleUpdateRegionName = useCallback(
    async (hexId: string, newName: string) => {
      debug(MAP_LOG_MODULE, "Updating region name", { hexId, newName });
      try {
      const { error } = await supabase.from("world_regions").update({ custom_name: newName }).eq("hex_id", hexId);

        if (error) {
          throw error;
        }

        await fetchRegions();
        debug(MAP_LOG_MODULE, "Region name updated successfully");
      } catch (error) {
        logError("Failed to update region name:", error);
        throw error;
      }
    },
    [supabase, fetchRegions]
  );

  return (
    <ErrorBoundary section="PrototypeMapPage" onError={(error) => logError("Map component error:", error)}>
      <div className="fixed inset-0 top-16 z-0 w-screen bg-background overflow-hidden">
        <HexMap
          onSelectionChange={handleSelectionChange}
          regionOwners={regionMap}
          diplomacyMap={diplomacyMap}
          currentCommunityId={userCommunityId}
          activeBattles={activeBattles}
          prototypeHexShaderDemos={PROTOTYPE_SHADER_DEMOS}
          showResourceIcons={false}
          drawerActionMode={actionMode}
          drawerOnFight={handleFight}
          drawerActionLoading={isActionLoading}
          drawerActionResult={actionResult}
          drawerOnReloadData={handleReloadData}
          drawerActiveBattleId={activeBattleIdForSelectedHex}
          drawerOnUpdateRegionName={handleUpdateRegionName}
          drawerUserRankTier={userRankTier}
        />
      </div>
    </ErrorBoundary>
  );
}

"use client";

import React, { useState } from "react";
import { getCommunityRegions } from "@/app/actions/regions";
import {
  calculateResourceZoneBonus,
  RESOURCE_DISTRIBUTION_RULES,
  formatBonusPercentage,
  getBiomeFromHexId,
  getHexNeighbors,
  getHexResourceBonus,
  getResourceZoneHexes,
  loadResourceDistribution,
  type HexResourceBonus,
  type ResourceDistribution,
} from "@/lib/economy/hex-resource-distribution";
import {
  Wheat,
  Mountain,
  Droplet,
  MapPin,
  Loader2,
  ArrowRight,
  TrendingUp,
  Landmark,
  Receipt,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { RegionsDrawer, type RegionWithBonus } from "./regions-drawer";
import { GoldCoinIcon, CommunityCoinIcon } from "@/components/ui/coin-icon";

// Hex data for region display
interface HexData {
  id: string;
  center: [number, number];
  biome: string;
}

interface CommunityEconomyTabProps {
  communityId: string;
  communityName: string;
  autoOpenDrawer?: boolean;
  workTaxRate?: number | null;
  importTariffRate?: number | null;
}

type EconomySubTab = "overview" | "treasury";

interface TreasuryData {
  goldAmount: number;
  currencyAmount: number;
  currencySymbol: string;
  currencyName: string;
  communityColor: string | null;
}

export function CommunityEconomyTab({
  communityId,
  communityName,
  autoOpenDrawer = false,
  workTaxRate = 0,
  importTariffRate = 0,
}: CommunityEconomyTabProps) {
  const [regions, setRegions] = React.useState<RegionWithBonus[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [resourceDistribution, setResourceDistribution] =
    React.useState<ResourceDistribution | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<EconomySubTab>("overview");
  const [treasuryData, setTreasuryData] = React.useState<TreasuryData>({
    goldAmount: 0,
    currencyAmount: 0,
    currencySymbol: "CC",
    currencyName: "Community Coins",
    communityColor: null,
  });
  const [isTreasuryLoading, setIsTreasuryLoading] = React.useState(false);
  const isStatsLoading = isLoading || !resourceDistribution;

  // Handle auto-open from header click
  React.useEffect(() => {
    if (autoOpenDrawer && !isLoading && regions.length > 0) {
      setDrawerOpen(true);
    }
  }, [autoOpenDrawer, isLoading, regions.length]);

  React.useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setIsLoading(true);

        // Fetch community regions
        const regionsData = await getCommunityRegions(communityId);

        if (!mounted) return;

        // Fetch hex data from static JSON
        let hexDataMap = new Map<string, HexData>();
        try {
          const hexRes = await fetch("/data/world-hexes.json");
          if (hexRes.ok) {
            const allHexData: Array<{ id: string; center: [number, number] }> =
              await hexRes.json();

            // Create map for quick lookup and add biome
            allHexData.forEach((hex) => {
              hexDataMap.set(hex.id, {
                ...hex,
                biome: getBiomeFromHexId(hex.id),
              });
            });
          }
        } catch (err) {
          console.error("Error loading hex data:", err);
        }

        const ownedHexes = new Set(regionsData.map((region) => region.hex_id));
        const bufferZoneMap = new Map<
          string,
          { resourceKey: string; centerHexId: string }
        >();

        if (resourceDistribution) {
          for (const [centerHexId, baseBonus] of resourceDistribution.byHexId) {
            for (const zoneHexId of getResourceZoneHexes(centerHexId)) {
              if (zoneHexId === centerHexId) continue;
              if (!bufferZoneMap.has(zoneHexId)) {
                bufferZoneMap.set(zoneHexId, {
                  resourceKey: baseBonus.resourceKey,
                  centerHexId,
                });
              }
            }
          }
        }

        // Calculate bonuses for each region (max 1 per region)
        const regionsWithBonuses: RegionWithBonus[] = regionsData.map((region) => {
          const hexData = hexDataMap.get(region.hex_id);
          let bonus: HexResourceBonus | null = null;
          let resourceKey: string | null = null;
          let resourceValueText: string | null = null;
          let resourceValueClassName: string | undefined;
          let resourceBonusValue = 0;

          if (hexData && resourceDistribution) {
            bonus = getHexResourceBonus(hexData.id, resourceDistribution);
            if (bonus) {
              resourceKey = bonus.resourceKey;
              const ownedNeighborCount = getHexNeighbors(hexData.id).filter((hexId) =>
                ownedHexes.has(hexId)
              ).length;

              let bufferedStep:
                | (typeof RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps)[number]
                | null = null;
              for (const step of RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps) {
                if (step.minNeighbors <= 0) continue;
                if (ownedNeighborCount >= step.minNeighbors) {
                  bufferedStep = step;
                }
              }

              if (bufferedStep) {
                const multiplier = Math.min(3, Math.floor(ownedNeighborCount / 2));
                if (multiplier > 0) {
                  resourceValueText = `${formatBonusPercentage(
                    bufferedStep.bonus
                  )} · ${multiplier}x Buffered`;
                  resourceValueClassName = "text-emerald-400";
                  resourceBonusValue = bufferedStep.bonus;
                }
              }

              if (!resourceValueText) {
                resourceValueText = formatBonusPercentage(bonus.bonus);
                resourceBonusValue = bonus.bonus;
              }
            } else {
              const bufferZone = bufferZoneMap.get(region.hex_id);
              if (bufferZone) {
                resourceKey = bufferZone.resourceKey;
                resourceValueText = "Buffer Zone";
              }
            }
          }

          return {
            ...region,
            bonus,
            biome: hexData?.biome || "Plains",
            resourceKey,
            resourceValueText,
            resourceValueClassName,
            resourceBonusValue,
          };
        });

        if (mounted) {
          setRegions(regionsWithBonuses);
        }
      } catch (err) {
        console.error("Error loading economy data:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [communityId, resourceDistribution]);

  React.useEffect(() => {
    let active = true;
    loadResourceDistribution()
      .then((distribution) => {
        if (active) setResourceDistribution(distribution);
      })
      .catch((err) => {
        console.error("Error loading resource distribution:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Fetch treasury data when treasury tab is opened
  React.useEffect(() => {
    if (activeSubTab !== "treasury") return;

    async function fetchTreasuryData() {
      setIsTreasuryLoading(true);
      try {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
        const supabase = createSupabaseBrowserClient();

        // Fetch community wallets (gold and currency)
        const { data: wallets, error: walletsError } = await supabase
          .from("community_wallets")
          .select("currency_type, gold_coins, community_coins, community_currency_id")
          .eq("community_id", communityId);

        if (walletsError) {
          console.error("Error fetching treasury wallets:", walletsError);
          return;
        }

        // Get currency info with community color
        const { data: currency, error: currencyError } = await supabase
          .from("community_currencies")
          .select(`
            currency_symbol,
            currency_name,
            communities:community_id(color)
          `)
          .eq("community_id", communityId)
          .maybeSingle();

        if (currencyError) {
          console.error("Error fetching currency info:", currencyError);
        }

        const goldWallet = wallets?.find((w: any) => w.currency_type === "gold");
        const currencyWallet = wallets?.find((w: any) => w.currency_type === "community");

        const community = Array.isArray(currency?.communities)
          ? currency?.communities[0]
          : currency?.communities;

        setTreasuryData({
          goldAmount: Number(goldWallet?.gold_coins ?? 0),
          currencyAmount: Number(currencyWallet?.community_coins ?? 0),
          currencySymbol: currency?.currency_symbol ?? "CC",
          currencyName: currency?.currency_name ?? "Community Coins",
          communityColor: community?.color ?? null,
        });
      } catch (err) {
        console.error("Error fetching treasury data:", err);
      } finally {
        setIsTreasuryLoading(false);
      }
    }

    fetchTreasuryData();
  }, [activeSubTab, communityId]);

  // Calculate active resource zone bonuses per resource
  const resourceStats = React.useMemo(() => {
    const grainBonuses: number[] = [];
    const ironBonuses: number[] = [];
    const oilBonuses: number[] = [];

    const ownedHexes = new Set(regions.map((region) => region.hex_id));

    if (resourceDistribution) {
      for (const [centerHexId, baseBonus] of resourceDistribution.byHexId) {
        if (!ownedHexes.has(centerHexId)) continue;
        const zoneBonus = calculateResourceZoneBonus(
          centerHexId,
          ownedHexes,
          baseBonus
        );
        if (!zoneBonus) continue;

        if (zoneBonus.resourceKey === "grain") {
          grainBonuses.push(zoneBonus.bonus);
        } else if (zoneBonus.resourceKey === "iron") {
          ironBonuses.push(zoneBonus.bonus);
        } else if (zoneBonus.resourceKey === "oil") {
          oilBonuses.push(zoneBonus.bonus);
        }
      }
    }

    const calcAvg = (bonuses: number[]) => {
      if (bonuses.length === 0) return 0;
      const sum = bonuses.reduce((acc, val) => acc + val, 0);
      return sum / bonuses.length;
    };

    return {
      totalRegions: regions.length,
      grainAvg: calcAvg(grainBonuses),
      ironAvg: calcAvg(ironBonuses),
      oilAvg: calcAvg(oilBonuses),
      grainCount: grainBonuses.length,
      ironCount: ironBonuses.length,
      oilCount: oilBonuses.length,
    };
  }, [regions, resourceDistribution]);

  return (
    <>
      <div className="space-y-6">
        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-3 border-b border-border/60 mb-5">
          <button
            onClick={() => setActiveSubTab("overview")}
            className={`flex items-center gap-2 text-[11px] font-medium uppercase transition-all relative pb-3 font-nav ${
              activeSubTab === "overview"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            <TrendingUp size={14} className="text-muted-foreground" />
            Economy Overview
            {activeSubTab === "overview" && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("treasury")}
            className={`flex items-center gap-2 text-[11px] font-medium uppercase transition-all relative pb-3 font-nav ${
              activeSubTab === "treasury"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/70"
            }`}
          >
            <Landmark size={14} className="text-muted-foreground" />
            Treasury
            {activeSubTab === "treasury" && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />
            )}
          </button>
        </div>

        {/* Economy Overview Tab */}
        {activeSubTab === "overview" && (
          <div className="space-y-6">
          <Card variant="default">
            <CardContent className="space-y-4">
              <SectionHeading title="Economy Overview" icon={TrendingUp} />
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Territories (Clickable) */}
              <button
                onClick={() => setDrawerOpen(true)}
                disabled={isLoading}
                className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/30 hover:border-border/60 transition-all duration-200 text-left cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Regions
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : regions.length === 0 ? (
                    "0"
                  ) : (
                    resourceStats.totalRegions
                  )}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>Preview regions</span>
                </p>
              </button>

              {/* Grain Bonus */}
              <div className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Grain Zone Bonus
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isStatsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : resourceStats.grainAvg > 0 ? (
                    `+${(resourceStats.grainAvg * 100).toFixed(1)}%`
                  ) : (
                    "—"
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isStatsLoading
                    ? "Loading..."
                    : resourceStats.grainCount > 0
                      ? `${resourceStats.grainCount} active zones`
                      : "No active zones"}
                </p>
              </div>

              {/* Iron Bonus */}
              <div className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Iron Zone Bonus
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isStatsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : resourceStats.ironAvg > 0 ? (
                    `+${(resourceStats.ironAvg * 100).toFixed(1)}%`
                  ) : (
                    "—"
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isStatsLoading
                    ? "Loading..."
                    : resourceStats.ironCount > 0
                      ? `${resourceStats.ironCount} active zones`
                      : "No active zones"}
                </p>
              </div>

              {/* Oil Bonus */}
              <div className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Droplet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Oil Zone Bonus
                  </span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {isStatsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : resourceStats.oilAvg > 0 ? (
                    `+${(resourceStats.oilAvg * 100).toFixed(1)}%`
                  ) : (
                    "—"
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isStatsLoading
                    ? "Loading..."
                    : resourceStats.oilCount > 0
                      ? `${resourceStats.oilCount} active zones`
                      : "No active zones"}
                </p>
              </div>
            </div>

            </CardContent>
          </Card>

          {/* Tax List */}
          <Card variant="default">
            <CardContent className="space-y-4">
              <SectionHeading title="Active Taxes" icon={Receipt} />

              <div className="space-y-2">
                {/* Work Tax */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Work Tax</p>
                    <p className="text-xs text-muted-foreground">
                      Deducted from all work wages and manager income
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      {((workTaxRate ?? 0) * 100).toFixed(0)}%
                    </p>
                    {workTaxRate && workTaxRate > 0 ? (
                      <p className="text-xs text-muted-foreground">Active</p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Not set</p>
                    )}
                  </div>
                </div>

                {/* Import Tariff */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/10">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Tariff (Import Tax)</p>
                    <p className="text-xs text-muted-foreground">
                      Applied when merchants from other communities sell here
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      {((importTariffRate ?? 0) * 100).toFixed(0)}%
                    </p>
                    {importTariffRate && importTariffRate > 0 ? (
                      <p className="text-xs text-muted-foreground">Active</p>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-400">Not set</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        )}

        {/* Treasury Tab */}
        {activeSubTab === "treasury" && (
          <div className="space-y-6">
          {/* Community Wallet */}
          <Card variant="default">
            <CardContent className="space-y-4">
              <SectionHeading title="Community Funds" icon={Landmark} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Gold */}
                <div className="flex flex-col space-y-2 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2">
                    <GoldCoinIcon className="h-3.5 w-3.5" />
                    Gold Treasury
                  </span>
                  <div className="text-2xl font-bold text-foreground flex items-center gap-2">
                    {isTreasuryLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <GoldCoinIcon className="h-6 w-6" />
                        {treasuryData.goldAmount.toLocaleString()}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Universal currency</p>
                </div>

                {/* Community Currency */}
                <div className="flex flex-col space-y-2 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-2">
                    <CommunityCoinIcon className="h-3.5 w-3.5" color={treasuryData.communityColor || undefined} />
                    {treasuryData.currencySymbol} Treasury
                  </span>
                  <div className="text-2xl font-bold text-foreground flex items-center gap-2">
                    {isTreasuryLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <CommunityCoinIcon className="h-6 w-6" color={treasuryData.communityColor || undefined} />
                        {treasuryData.currencyAmount.toLocaleString()}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{treasuryData.currencyName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Community Inventory */}
          <Card variant="default">
            <CardContent className="space-y-4">
              <SectionHeading title="Treasury Inventory" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Raw Materials */}
                <div className="space-y-2 p-4 rounded-xl border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Raw Materials
                  </p>
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No items</p>
                  </div>
                </div>

                {/* Products */}
                <div className="space-y-2 p-4 rounded-xl border border-border/40 bg-muted/10">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Products
                  </p>
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No items</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        )}
      </div>

      {/* Regions Drawer */}
      {!isLoading && (
        <RegionsDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          regions={regions}
          communityName={communityName}
        />
      )}
    </>
  );
}

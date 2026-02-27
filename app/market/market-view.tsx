"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Briefcase, ArrowRightLeft, X, Plus, Minus } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PageSection } from "@/components/layout/page-section";
import { H1, P } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { getCommunityAvatarUrl } from "@/lib/community-visuals";
import { getP2PExchangeContext } from "@/app/actions/market";
import { CommunityCoinIcon } from "@/components/ui/coin-icon";

import { MarketTab } from "@/components/market/market-tab";
import { JobsTab } from "@/components/market/jobs-tab";
import { CurrencyExchangeP2P } from "@/components/market/currency-exchange-p2p";
import { ExchangeTabSkeleton } from "@/components/market/market-skeletons";
import { MARKET_TAB_CONFIG, MARKET_DEFAULTS } from "@/components/market/market-config";
import type { Community } from "@/components/market/types";
import type { CommunityCurrency } from "@/lib/currency-system";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildCommunityAvatarUrl(
  community?: { id?: string | null; name?: string | null; color?: string | null },
  fallbackSeed = "community"
) {
  const normalizedFallback = fallbackSeed.trim() || "community";
  const communityId = community?.id?.trim() || normalizedFallback;
  const seedSource = community?.name?.trim() || normalizedFallback;

  return getCommunityAvatarUrl({
    communityId,
    color: community?.color,
    seedSource,
  });
}

// ============================================================================
// MAIN MARKET VIEW COMPONENT
// ============================================================================

interface MarketViewProps {
  communityCurrencies: CommunityCurrency[];
}

export function MarketView({ communityCurrencies }: MarketViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const communitiesParam = searchParams.get("communities");
  const [activeTab, setActiveTab] = useState<"market" | "jobs" | "exchange">("market");
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [communityQuery, setCommunityQuery] = useState("");
  const [isCommunityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const [isCommunityFocused, setCommunityFocused] = useState(false);
  const communityContainerRef = useRef<HTMLDivElement>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [p2pExchangeData, setP2PExchangeData] = useState<any>(null);

  const communityLookup = useMemo(
    () => new Map(communities.map((community) => [community.id, community])),
    [communities]
  );

  const currencyLookup = useMemo(
    () => new Map(communityCurrencies.map((currency) => [currency.community_id, currency])),
    [communityCurrencies]
  );

  const communitySearchResults = useMemo(() => {
    const needle = communityQuery.trim().toLowerCase();
    return [...communities]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((community) => community.name.toLowerCase().includes(needle));
  }, [communities, communityQuery]);

  // Load community context and communities list on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const { getUserCommunityId } = await import("@/app/actions/economy");
        const { getMyCompanyCommunityIds } = await import("@/app/actions/companies");
        const { getAllCommunities } = await import("@/app/actions/community");

        const [communityId, myCompanyCommunityIds, communitiesData, p2pData] = await Promise.all([
          getUserCommunityId(),
          getMyCompanyCommunityIds(),
          getAllCommunities(),
          getP2PExchangeContext(),
        ]);

        // Load communities first
        if (communitiesData) {
          setCommunities(communitiesData);
        }

        if (p2pData) {
          setP2PExchangeData(p2pData);
        }

        // Only initialize selectedCommunities if not set from URL params
        // All tabs (market, jobs, exchange): auto-select user's main community as default
        // Single-select mode for all tabs
        if (!communitiesParam && communityId) {
          setSelectedCommunities([communityId]);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        toast.error("Failed to load market data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Initialize tab from URL params
  useEffect(() => {
    if (tabParam === "market" || tabParam === "jobs" || tabParam === "exchange") {
      setActiveTab(tabParam);
    } else {
      setActiveTab("market");
    }
  }, [tabParam]);

  // Initialize communities from URL params (overrides defaults)
  useEffect(() => {
    if (communitiesParam) {
      const communityIds = communitiesParam.split(",").filter(Boolean);
      if (communityIds.length > 0) {
        setSelectedCommunities(communityIds);
      }
    }
  }, [communitiesParam]);

  // Sync URL when selectedCommunities or activeTab change (only after loading)
  useEffect(() => {
    // Don't update URL while still loading to avoid clearing params during initialization
    if (loading) return;

    const params = new URLSearchParams();
    if (activeTab !== "market") {
      params.set("tab", activeTab);
    }
    if (selectedCommunities.length > 0) {
      params.set("communities", selectedCommunities.join(","));
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : pathname, { scroll: false });
  }, [selectedCommunities, activeTab, router, pathname, loading]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isCommunityDropdownOpen &&
        communityContainerRef.current &&
        !communityContainerRef.current.contains(event.target as Node)
      ) {
        setCommunityDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCommunityDropdownOpen]);


  const handleTabChange = (newTab: "market" | "jobs" | "exchange") => {
    setActiveTab(newTab);
  };

  const toggleCommunitySelection = (communityId: string) => {
    // All tabs use single-select mode (replace community, don't add)
    setSelectedCommunities([communityId]);
    setCommunityQuery("");
    setCommunityDropdownOpen(false);
  };

  const removeCommunity = (communityId: string) => {
    setSelectedCommunities((prev) => prev.filter((id) => id !== communityId));
  };

  return (
    <PageSection>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <H1>Market</H1>
          <P className="mt-1 font-medium">
            Trade resources, find employment, and exchange currencies
          </P>
        </div>

        {/* Tabs + Community Filter */}
        <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as typeof activeTab)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Tabs */}
            <TabsList className={MARKET_TAB_CONFIG.list.className}>
              <TabsTrigger value="market" size={MARKET_TAB_CONFIG.trigger.size} className={MARKET_TAB_CONFIG.trigger.className}>
                <ShoppingCart className="h-4 w-4" />
                <span>Market</span>
              </TabsTrigger>
              <TabsTrigger value="jobs" size={MARKET_TAB_CONFIG.trigger.size} className={MARKET_TAB_CONFIG.trigger.className}>
                <Briefcase className="h-4 w-4" />
                <span>Jobs</span>
              </TabsTrigger>
              <TabsTrigger value="exchange" size={MARKET_TAB_CONFIG.trigger.size} className={MARKET_TAB_CONFIG.trigger.className}>
                <ArrowRightLeft className="h-4 w-4" />
                <span>Exchange</span>
              </TabsTrigger>
            </TabsList>

            {/* Community Filter (Right-aligned) */}
            <div
              className="relative w-full max-w-[360px] lg:ml-auto"
              ref={communityContainerRef}
            >
              <div
                className="relative flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 cursor-pointer"
                onClick={() => setCommunityDropdownOpen(true)}
              >
                <div className="flex flex-1 min-w-0 items-center gap-1 overflow-hidden">
                  <div className="flex max-w-[200px] gap-1 overflow-x-auto">
                    {selectedCommunities.map((communityId) => {
                      const community = communityLookup.get(communityId);
                      // Only render if we have the community data
                      if (!community) return null;
                      const currency = currencyLookup.get(communityId);
                      const initial = community.name?.[0] ?? "C";
                      const avatarUrl = buildCommunityAvatarUrl(community, communityId);
                      return (
                        <span
                          key={communityId}
                          className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/50 px-2 py-1 text-[11px] font-semibold text-foreground"
                        >
                          <Avatar className="h-5 w-5 rounded-lg border border-border bg-card">
                            <AvatarImage
                              src={avatarUrl}
                              alt={`${community.name} avatar`}
                            />
                            <AvatarFallback className="rounded-lg text-[10px]">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex items-center gap-1 text-[11px] font-semibold max-w-[120px]">
                            <span className="truncate">{community.name}</span>
                            {currency && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                                <span>(</span>
                                <CommunityCoinIcon className="h-3 w-3" color={community.color || undefined} />
                                <span>{currency.currency_symbol}</span>
                                <span>)</span>
                              </span>
                            )}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove community filter"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeCommunity(communityId);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={communityQuery}
                    onChange={(event) => setCommunityQuery(event.target.value)}
                    onFocus={() => {
                      setCommunityDropdownOpen(true);
                      setCommunityFocused(true);
                    }}
                    onBlur={() => setCommunityFocused(false)}
                    placeholder={
                      !selectedCommunities.length &&
                      !communityQuery &&
                      !isCommunityDropdownOpen &&
                      !isCommunityFocused
                        ? "Search Communities..."
                        : ""
                    }
                    className="flex-1 min-w-[120px] h-full border-none bg-transparent px-2 pr-7 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                    aria-expanded={isCommunityDropdownOpen}
                    aria-haspopup="listbox"
                  />
                  <Plus className="h-4 w-4 text-muted-foreground/70" />
                </div>
              </div>

              {isCommunityDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-border bg-card shadow-lg">
                  <div className="max-h-56 overflow-y-auto">
                    {communitySearchResults.length > 0 ? (
                      communitySearchResults.map((community) => {
                        const currency = currencyLookup.get(community.id);
                        return (
                          <button
                            key={community.id}
                            type="button"
                            onClick={() => toggleCommunitySelection(community.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70",
                              selectedCommunities.includes(community.id) && "bg-muted/60"
                            )}
                          >
                            <Avatar className="h-7 w-7 rounded-lg border border-border bg-card">
                              <AvatarImage
                                src={buildCommunityAvatarUrl(community, community.id)}
                                alt={`${community.name ?? "Community"} avatar`}
                              />
                              <AvatarFallback className="rounded-lg text-[10px]">
                                {community.name?.[0] ?? "C"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <span className="truncate">{community.name}</span>
                              {currency && (
                                <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                                  <span>(</span>
                                  <CommunityCoinIcon className="h-3.5 w-3.5" color={community.color || undefined} />
                                  <span>{currency.currency_symbol}</span>
                                  <span>)</span>
                                </span>
                              )}
                            </div>
                            <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/60 text-muted-foreground">
                              {selectedCommunities.includes(community.id) ? (
                                <Minus className="h-3.5 w-3.5" />
                              ) : (
                                <Plus className="h-3.5 w-3.5" />
                              )}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        No communities match your search.
                      </p>
                    )}
                  </div>
                  {selectedCommunities.length >= MARKET_DEFAULTS.maxCommunityFilters && (
                    <p className="px-4 py-2 text-xs text-muted-foreground">
                      Remove one community before adding another.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Market Tab */}
          <TabsContent value="market" className="mt-6 space-y-4">
            {!loading && <MarketTab selectedCommunities={selectedCommunities} communityCurrencies={communityCurrencies} />}
          </TabsContent>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="mt-6 space-y-4">
            {!loading && <JobsTab selectedCommunities={selectedCommunities} communityCurrencies={communityCurrencies} />}
          </TabsContent>

          {/* Exchange Tab */}
          <TabsContent value="exchange" className="mt-6 space-y-4">
            {loading || !p2pExchangeData ? (
              <ExchangeTabSkeleton />
            ) : (
              <CurrencyExchangeP2P data={p2pExchangeData} selectedCommunities={selectedCommunities} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageSection>
  );
}

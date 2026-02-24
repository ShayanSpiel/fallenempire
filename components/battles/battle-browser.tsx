"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Minus, Plus, Search, Shield, ShieldAlert, Timer, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCommunityAvatarUrl } from "@/lib/community-visuals";
import { searchInputClasses } from "@/components/ui/search-input";
import { Card } from "@/components/ui/card";
import { WallMeter } from "@/components/ui/wall-meter";

const attackerVictoryStatuses = new Set(["attacker_win", "attacker_won"]);
const defenderVictoryStatuses = new Set(["defender_win", "defender_won"]);

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

export type BattleViewModel = {
  id: string;
  target_hex_id: string;
  status: string;
  ends_at: string;
  current_defense: number;
  initial_defense: number;
  custom_name: string | null;
  attacker?: { id: string; name: string; slug: string; color?: string | null; logo_url?: string | null } | null;
  defender?: { id: string; name: string; slug: string; color?: string | null; logo_url?: string | null } | null;
};

export type CommunityOption = {
  id: string;
  name: string;
  color?: string | null;
};

function BattleStatusBadge({ status, endsAt }: { status: string; endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const isFinished = status !== "active";

  useEffect(() => {
    if (isFinished) return;

    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(endsAt).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endsAt, isFinished]);

  if (attackerVictoryStatuses.has(status)) {
    return (
      <Badge className="bg-destructive/10 text-destructive border border-destructive/40">
        Conquered
      </Badge>
    );
  }

  if (defenderVictoryStatuses.has(status)) {
    return (
      <Badge
        variant="outline"
        className="bg-secondary/10 text-secondary-foreground border border-secondary/30"
      >
        Defended
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5 font-mono">
      <Timer size={10} className="animate-pulse" />
      {timeLeft || "--:--:--"}
    </Badge>
  );
}

function BattleCard({ data }: { data: BattleViewModel }) {
  const wallHealth = Math.max(0, data.current_defense);
  const initialDefense = Math.max(1, data.initial_defense);
  const healthPercent = (wallHealth / initialDefense) * 100;
  const actionText = data.status === "active" ? "Join Conflict" : "View Result";
  const actionTextClass = data.status === "active" ? "text-sm font-semibold" : "text-xs font-semibold";
  const attackerAvatarUrl = data.attacker?.logo_url || (data.attacker ? buildCommunityAvatarUrl(data.attacker, `attacker-${data.id}`) : '');
  const defenderAvatarUrl = data.defender?.logo_url || (data.defender ? buildCommunityAvatarUrl(data.defender, `defender-${data.id}`) : '');
  const attackerDisplayName = data.attacker?.name ?? "Attacker";
  const defenderDisplayName = data.defender?.name ?? "Defender";
  const regionName = data.custom_name || `#${data.target_hex_id}`;

  return (
    <Card variant="default" className="rounded-xl group relative flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
          <MapPin size={12} />
          <span>{regionName}</span>
        </div>
        <BattleStatusBadge status={data.status} endsAt={data.ends_at} />
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-10 w-10 !rounded-lg border border-destructive/40 shadow-sm">
            <AvatarImage
              src={attackerAvatarUrl}
              alt={`${attackerDisplayName} avatar`}
            />
            <AvatarFallback className="!rounded-lg text-destructive bg-destructive/10 font-bold">
              ATK
            </AvatarFallback>
          </Avatar>
          <span
            className="text-xs font-bold text-center truncate w-full px-1"
            title={data.attacker?.name}
          >
            {data.attacker?.name || "Unknown"}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-0 shrink-0 px-2 text-[10px] font-semibold uppercase tracking-[0.45em] text-muted-foreground">
          <span>VS</span>
        </div>

        <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-10 w-10 !rounded-lg border border-secondary/40 shadow-sm">
            <AvatarImage
              src={defenderAvatarUrl}
              alt={`${defenderDisplayName} avatar`}
            />
            <AvatarFallback className="!rounded-lg text-secondary bg-secondary/10 font-bold">
              DEF
            </AvatarFallback>
          </Avatar>
          <span
            className="text-xs font-bold text-center truncate w-full px-1"
            title={data.defender?.name}
          >
            {data.defender?.name || "Neutral"}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <WallMeter
          value={data.initial_defense - data.current_defense}
        />
      </div>

      <Button
        asChild
        variant={data.status === "active" ? "default" : "outline"}
        size="lg"
        className="mt-auto w-full gap-2"
      >
        <Link href={`/battle/${data.id}`} className="flex items-center justify-center gap-2 text-inherit">
          <span className={actionTextClass}>{actionText}</span>
          <ArrowRight size={12} />
        </Link>
      </Button>
    </Card>
  );
}

export function BattleBrowser({
  initialBattles,
  communities,
}: {
  initialBattles: any[];
  communities: CommunityOption[];
}) {
  const [query, setQuery] = useState("");
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [communityQuery, setCommunityQuery] = useState("");
  const [isCommunityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const [isCommunityFocused, setCommunityFocused] = useState(false);
  const communityContainerRef = useRef<HTMLDivElement>(null);

  const battles: BattleViewModel[] = useMemo(() => {
    return initialBattles.map((battle) => ({
      id: battle.id,
      target_hex_id: battle.target_hex_id,
      status: battle.status,
      ends_at: battle.ends_at,
      current_defense: battle.current_defense,
      initial_defense: battle.initial_defense,
      custom_name: battle.custom_name,
      attacker: battle.attacker,
      defender: battle.defender,
    }));
  }, [initialBattles]);

  const communityLookup = useMemo(
    () => new Map(communities.map((community) => [community.id, community])),
    [communities]
  );

  const communitySearchResults = useMemo(() => {
    const needle = communityQuery.trim().toLowerCase();
    return [...communities]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter((community) => community.name.toLowerCase().includes(needle));
  }, [communities, communityQuery]);

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

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return battles.filter((battle) => {
      const matchesSearch = battle.target_hex_id.toLowerCase().includes(normalizedQuery);

      const matchesCommunity =
        selectedCommunities.length === 0 ||
        selectedCommunities.some(
          (communityId) =>
            battle.attacker?.id === communityId || battle.defender?.id === communityId
        );

      return matchesSearch && matchesCommunity;
    });
  }, [battles, query, selectedCommunities]);

  const activeCount = battles.filter((battle) => battle.status === "active").length;
  const finishedCount = battles.length - activeCount;

  const toggleCommunitySelection = (communityId: string) => {
    setSelectedCommunities((prev) => {
      if (prev.includes(communityId)) {
        return prev.filter((id) => id !== communityId);
      }
      if (prev.length >= 2) {
        return prev;
      }
      return [...prev, communityId];
    });
    setCommunityQuery("");
    setCommunityDropdownOpen(true);
  };

  const removeCommunity = (communityId: string) => {
    setSelectedCommunities((prev) => prev.filter((id) => id !== communityId));
  };

  const clearFilters = () => {
    setQuery("");
    setCommunityQuery("");
    setSelectedCommunities([]);
    setCommunityDropdownOpen(false);
  };

  const hasActiveFilters = Boolean(query) || selectedCommunities.length > 0;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
            <div
              className="relative flex-1 min-w-0 max-w-[360px]"
              ref={communityContainerRef}
            >
              <div
                className="relative flex h-10 items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3"
                onClick={() => setCommunityDropdownOpen(true)}
              >
                <div className="flex flex-1 min-w-0 items-center gap-1 overflow-hidden">
                  <div className="flex max-w-[200px] gap-1 overflow-x-auto">
                    {selectedCommunities.map((communityId) => {
                      const community = communityLookup.get(communityId);
                      const initial = community?.name?.[0] ?? communityId[0] ?? "C";
                      const avatarUrl = buildCommunityAvatarUrl(community, communityId);
                      return (
                        <span
                          key={communityId}
                          className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/50 px-2 py-1 text-[11px] font-semibold text-foreground"
                        >
                          <Avatar className="h-5 w-5 !rounded-lg border border-border bg-card">
                            <AvatarImage
                              src={avatarUrl}
                              alt={`${community?.name ?? "Community"} avatar`}
                            />
                            <AvatarFallback className="!rounded-lg text-[10px]">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-[100px] truncate text-[11px] font-semibold">
                            {community?.name ?? "Community"}
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
                    className="flex-1 min-w-[120px] h-full border-none bg-transparent px-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                    aria-expanded={isCommunityDropdownOpen}
                    aria-haspopup="listbox"
                  />
                </div>
              </div>

              {isCommunityDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-border bg-card shadow-lg">
                  <div className="max-h-56 overflow-y-auto">
                    {communitySearchResults.length > 0 ? (
                      communitySearchResults.map((community) => (
                        <button
                          key={community.id}
                          type="button"
                          onClick={() => toggleCommunitySelection(community.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-none px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70",
                            selectedCommunities.includes(community.id) && "bg-muted/60"
                          )}
                        >
                          <Avatar className="h-7 w-7 !rounded-lg border border-border bg-card">
                            <AvatarImage
                              src={buildCommunityAvatarUrl(community, community.id)}
                              alt={`${community.name ?? "Community"} avatar`}
                            />
                            <AvatarFallback className="!rounded-lg text-[10px]">
                              {community.name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{community.name}</span>
                          <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/60 text-muted-foreground">
                            {selectedCommunities.includes(community.id) ? (
                              <Minus className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </span>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        No communities match your search.
                      </p>
                    )}
                  </div>
                  {selectedCommunities.length >= 2 && (
                    <p className="px-4 py-2 text-xs text-muted-foreground">
                      Remove one community before adding another.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="relative flex-1 min-w-0">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
                size={16}
              />
              <input
                className={`${searchInputClasses} pl-10 pr-4`}
                placeholder="Search region ID..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="flex-shrink-0 w-full lg:w-auto">
            <Button
              variant="ghost"
              size="lg"
              onClick={clearFilters}
              className="w-full rounded-lg border border-border/60 text-muted-foreground hover:text-foreground lg:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((battle) => (
                <BattleCard key={battle.id} data={battle} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-24 border border-dashed border-border/60 rounded-xl bg-card/50">
              <ShieldAlert size={48} className="text-muted-foreground/40 mb-2" />
              <p className="text-muted-foreground font-medium">
                No battles found matching your criteria.
              </p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="hidden lg:block space-y-6">
          <div className="sticky top-24 bg-card border border-border/50 rounded-xl p-6 shadow-[var(--surface-shadow)]">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
              <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                <Clock size={14} />
                Status Report
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/10 border border-secondary/30">
                <span className="text-xs font-bold uppercase tracking-wide text-secondary">
                  Active Conflicts
                </span>
                <span className="text-xl font-black text-secondary">{activeCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Historic Battles
                </span>
                <span className="text-xl font-black text-foreground">{finishedCount}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Data updates in real-time. Join an active conflict to influence the outcome and earn glory for your community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

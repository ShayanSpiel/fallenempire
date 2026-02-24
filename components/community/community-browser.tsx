"use client";

export type CommunitySummary = {
  id: string;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  color?: string | null;
  ideology_label?: string | null;
  governance_type?: string | null;
  members_count?: number | null;
  regions_count?: number | null;
  average_morale?: number | null;
};

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Crown,
  Lock,
  Search,
  Shield,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateCommunityForm } from "@/components/community/create-community-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCommunityAvatarUrl } from "@/lib/community-visuals";
import { searchInputClasses } from "@/components/ui/search-input";
import { GOVERNANCE_TYPES } from "@/lib/governance";
import { CommunityStatParts } from "./community-stat";

// --- TYPES ---
export type CommunityViewModel = {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  color?: string | null;
  ideology_label: string | null;
  governance_type: string;
  members_count: number;
  regions_count: number;
  average_morale: number;
  isMember: boolean;
};

const formatGovernanceLabel = (type?: string | null) => {
  if (!type) return "Governance";
  const normalized = type.trim();
  if (!normalized) return "Governance";
  const config = GOVERNANCE_TYPES[normalized.toLowerCase()];
  if (config) return config.label;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

// --- COMPONENTS ---

function CommunityCard({
  data,
}: {
  data: CommunityViewModel;
}) {
  const governanceLabel = formatGovernanceLabel(data.governance_type);
  const avatarUrl = getCommunityAvatarUrl({
    communityId: data.id,
    color: data.color,
    seedSource: data.name,
  });
  const resolvedSlug = data.slug?.trim();
  const communityHref = `/community/${encodeURIComponent(resolvedSlug || data.id)}`;

  return (
    <div
      className={cn(
        "group relative flex flex-col p-5 rounded-xl border bg-card transition-all duration-200 shadow-[var(--surface-shadow)]",
        data.isMember
          ? "border-border"
          : "border-border/60 hover:border-border/80"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 rounded-lg border border-border bg-card">
            <AvatarImage src={avatarUrl} alt={`${data.name} sigil`} />
            <AvatarFallback className="rounded-lg text-xs">
              {data.name.substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-base font-bold text-foreground leading-none">
              {data.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge
                variant="minimal"
                className="flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
              >
                <Crown size={12} />
                {governanceLabel}
              </Badge>
              {data.isMember && (
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wide flex items-center gap-1 bg-accent px-1.5 py-0.5 rounded">
                  <Lock size={10} />
                  Joined
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs font-medium text-muted-foreground line-clamp-2 mb-6 h-8 leading-relaxed">
        {data.description || "No description provided."}
      </p>

      <div className="flex items-center gap-6 mb-5 border-t border-border/60 pt-4">
        <div className="flex flex-col">
          <CommunityStatParts
            label="Members"
            icon={<Users size={12} className="text-muted-foreground" />}
            value={data.members_count.toLocaleString()}
          />
        </div>
        <div className="flex flex-col">
          <CommunityStatParts
            label="Regions"
            icon={<Shield size={12} className="text-muted-foreground" />}
            value={data.regions_count.toLocaleString()}
          />
        </div>
        <div className="flex flex-col">
          <CommunityStatParts
            label="Morale"
            icon={<Activity size={12} className="text-muted-foreground" />}
            value={`${data.average_morale.toFixed(0)}%`}
          />
        </div>
      </div>

      <Button
        asChild
        variant={data.isMember ? "default" : "outline"}
        size="lg"
        className="mt-auto w-full gap-2"
      >
        <Link href={communityHref} className="flex items-center justify-center gap-2 text-inherit">
          {data.isMember ? "Access Community" : "View Details"}
          <ArrowRight size={12} />
        </Link>
      </Button>
    </div>
  );
}

function LeaderboardRow({
  rank,
  data,
  metric,
  value,
}: {
  rank: number;
  data: CommunityViewModel;
  metric: 'regions' | 'members' | 'morale';
  value: number;
}) {
  const badgeClass = cn(
    "w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 transition-colors",
    rank === 1
      ? "bg-primary text-primary-foreground"
      : rank === 2
      ? "bg-muted/60 text-muted-foreground"
      : rank === 3
      ? "bg-muted/50 text-muted-foreground"
      : "bg-muted/30 text-muted-foreground"
  );

  const formattedValue = metric === 'morale' ? `${value.toFixed(0)}%` : value.toLocaleString();

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card transition-colors hover:bg-muted/40 group">
      <div className={badgeClass}>{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-foreground truncate pr-2">{data.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {formattedValue}
          </span>
        </div>
        <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
          <div className="h-full w-[60%] rounded-full bg-primary transition-colors group-hover:bg-primary/80" />
        </div>
      </div>
    </div>
  );
}

// --- MAIN CONTROLLER ---

export function CommunityBrowser({
  initialCommunities,
  userCommunityId,
}: {
  initialCommunities: CommunitySummary[];
  userCommunityId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "joined">("all");
  const [activeTab, setActiveTab] = useState<"regions" | "members" | "morale">("members");

  const communities: CommunityViewModel[] = useMemo(() => {
    return initialCommunities.map((c) => ({
      id: c.id,
      slug: c.slug ?? c.id,
      name: c.name ?? "Unnamed",
      description: c.description ?? null,
      color: c.color ?? null,
      ideology_label: c.ideology_label ?? null,
      governance_type: c.governance_type ?? "monarchy",
      members_count: c.members_count ?? 0,
      regions_count: c.regions_count ?? 0,
      average_morale: c.average_morale ?? 0,
      isMember: c.id === userCommunityId,
    }));
  }, [initialCommunities, userCommunityId]);

  const filtered = useMemo(() => {
    const searchValue = query.toLowerCase().trim();
    return communities.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchValue) ||
        c.governance_type.toLowerCase().includes(searchValue) ||
        (c.ideology_label?.toLowerCase().includes(searchValue) ?? false);
      const matchesFilter = filter === "all" || (filter === "joined" && c.isMember);
      return matchesSearch && matchesFilter;
    });
  }, [communities, filter, query]);

  const leaderboardByRegions = [...communities]
    .sort((a, b) => b.regions_count - a.regions_count)
    .slice(0, 5);

  const leaderboardByMembers = [...communities]
    .sort((a, b) => b.members_count - a.members_count)
    .slice(0, 5);

  const leaderboardByMorale = [...communities]
    .sort((a, b) => b.average_morale - a.average_morale)
    .slice(0, 5);

  const totalRegions = communities.reduce((sum, c) => sum + (c.regions_count ?? 0), 0);
  const totalMembers = communities.reduce((sum, c) => sum + (c.members_count ?? 0), 0);
  const averageMorale = communities.length > 0
    ? communities.reduce((sum, c) => sum + (c.average_morale ?? 0), 0) / communities.length
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            size={16}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or governance type..."
            className={`${searchInputClasses} pl-10 pr-4`}
          />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CreateCommunityForm />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pb-12">
              {filtered.map((community) => (
                <CommunityCard key={community.id} data={community} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-24 border border-dashed border-border/60 rounded-2xl bg-card/80">
              <Shield size={48} className="text-muted-foreground/60 mb-2" />
              <p className="text-muted-foreground font-medium">No communities match your search.</p>
            </div>
          )}
        </div>
        <div className="lg:flex lg:flex-col lg:justify-start">
          <div className="space-y-4">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-[var(--surface-shadow)]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
                <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                  <Trophy size={14} />
                  Overview
                </h3>
              </div>

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab("regions")}
                  className={cn(
                    "flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors",
                    activeTab === "regions"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  Regions
                </button>
                <button
                  onClick={() => setActiveTab("members")}
                  className={cn(
                    "flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors",
                    activeTab === "members"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  Members
                </button>
                <button
                  onClick={() => setActiveTab("morale")}
                  className={cn(
                    "flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors",
                    activeTab === "morale"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  Morale
                </button>
              </div>

              <div className="space-y-1">
                {activeTab === "regions" && leaderboardByRegions.map((community, index) => (
                  <LeaderboardRow
                    key={community.id}
                    rank={index + 1}
                    data={community}
                    metric="regions"
                    value={community.regions_count}
                  />
                ))}
                {activeTab === "members" && leaderboardByMembers.map((community, index) => (
                  <LeaderboardRow
                    key={community.id}
                    rank={index + 1}
                    data={community}
                    metric="members"
                    value={community.members_count}
                  />
                ))}
                {activeTab === "morale" && leaderboardByMorale.map((community, index) => (
                  <LeaderboardRow
                    key={community.id}
                    rank={index + 1}
                    data={community}
                    metric="morale"
                    value={community.average_morale}
                  />
                ))}
              </div>
            </div>

            <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-[var(--surface-shadow)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Shield size={12} />
                    Total Regions
                  </span>
                  <span>{totalRegions.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users size={12} />
                    Total Members
                  </span>
                  <span>{totalMembers.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Activity size={12} />
                    Average Morale
                  </span>
                  <span>{averageMorale.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

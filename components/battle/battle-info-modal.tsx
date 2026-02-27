"use client";

import React, { useState, useEffect } from "react";
import { X, Users, Shield, Swords, TrendingUp, Crown, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { UserNameDisplay } from "@/components/ui/user-name-display";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BATTLE_THEME } from "@/lib/battle-theme";
import { getCommunityAvatarUrl } from "@/lib/community-visuals";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type HeroTotalsEntry = {
  name: string;
  avatar?: string | null;
  side: "attacker" | "defender";
  damage: number;
  actorId?: string | null;
};

type CommunityInfo = {
  id: string;
  name: string;
  logo_url?: string;
  color?: string;
};

type BattleObserver = {
  id: string;
  username: string;
  avatar_url?: string | null;
  user_tier?: "alpha" | "sigma" | "omega" | null;
  community_id?: string | null;
  last_seen: string;
};

type BattleMechanics = {
  disarray: number;
  exhaustion: number;
  momentum: number;
  rage: number;
};

// Theme-derived constants to avoid hardcoding
const FALLBACK_COLORS = {
  attacker: '#ef4444', // red-500
  defender: '#10b981', // emerald-500
} as const;

const READINESS_STATUS = {
  high: {
    text: BATTLE_THEME.sides.attacker.colors.text,
    bg: BATTLE_THEME.sides.attacker.colors.bg,
  },
  medium: {
    text: 'text-yellow-500',
    bg: 'bg-yellow-500',
  },
  low: {
    text: BATTLE_THEME.sides.defender.colors.text,
    bg: BATTLE_THEME.sides.defender.colors.bg,
  },
} as const;

const STATUS_COLORS = {
  crown: 'text-yellow-500',
  crownFill: 'fill-yellow-500',
  activeIndicator: BATTLE_THEME.sides.defender.colors.bg,
} as const;

interface BattleInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  attackerHeroes: HeroTotalsEntry[];
  defenderHeroes: HeroTotalsEntry[];
  attackerCommunity: CommunityInfo | null;
  defenderCommunity: CommunityInfo | null;
  battleId: string;
  getUserAvatar: (name: string, realUrl?: string | null) => string;
}

export function BattleInfoModal({
  isOpen,
  onClose,
  attackerHeroes,
  defenderHeroes,
  attackerCommunity,
  defenderCommunity,
  battleId,
  getUserAvatar,
}: BattleInfoModalProps) {
  const [observers, setObservers] = useState<BattleObserver[]>([]);
  const [attackerMechanics, setAttackerMechanics] = useState<BattleMechanics | null>(null);
  const [defenderMechanics, setDefenderMechanics] = useState<BattleMechanics | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (!isOpen) return;

    const supabase = createSupabaseBrowserClient();

    // Fetch battle mechanics
    const fetchMechanics = async () => {
      const fetchCommunityMechanics = async (communityId: string) => {
        const response = await fetch(
          `/api/battle/mechanics/community?communityId=${communityId}`
        );
        if (!response.ok) return null;
        const data = await response.json();

        const disarrayMultiplier = data?.disarray?.multiplier ?? 1.0;
        const exhaustionMultiplier = data?.exhaustion?.multiplier ?? 1.0;
        const momentumActive = data?.momentum?.active ?? false;
        const rageAverage = data?.rage?.average ?? 0;

        return {
          // Readiness is normalized to 0..1 for progress bars.
          disarray: Math.max(0, Math.min(1, 1 / Math.max(1, disarrayMultiplier))),
          exhaustion: Math.max(0, Math.min(1, exhaustionMultiplier)),
          momentum: momentumActive ? 1 : 0,
          rage: Math.max(0, Math.min(1, rageAverage / 100)), // Normalize 0-100 to 0-1
        } satisfies BattleMechanics;
      };

      if (attackerCommunity) {
        const mechanics = await fetchCommunityMechanics(attackerCommunity.id);
        if (mechanics) setAttackerMechanics(mechanics);
      }

      if (defenderCommunity) {
        const mechanics = await fetchCommunityMechanics(defenderCommunity.id);
        if (mechanics) setDefenderMechanics(mechanics);
      }
    };

    // Fetch recent battle observers (using battle_observers table)
    const fetchObservers = async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('battle_observers')
        .select(`
          user_id,
          last_seen_at,
          users:user_id (
            username,
            avatar_url
          )
        `)
        .eq('battle_id', battleId)
        .gte('last_seen_at', fiveMinutesAgo)
        .order('last_seen_at', { ascending: false })
        .limit(20);

      if (data) {
        const observers = data
          .filter((obs: any) => obs.users) // Only include observers with valid user data
          .map((obs: any) => ({
            id: obs.user_id,
            username: obs.users.username || 'Unknown',
            avatar_url: obs.users.avatar_url,
            last_seen: obs.last_seen_at,
          }));
        setObservers(observers);
      }
    };

    fetchMechanics();
    fetchObservers();

    // Poll for observers/mechanics every 10 seconds
    const interval = setInterval(() => {
      fetchMechanics();
      fetchObservers();
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen, battleId, attackerCommunity, defenderCommunity]);

  if (!isOpen) return null;

  const totalAttackerDamage = attackerHeroes.reduce((sum, hero) => sum + hero.damage, 0);
  const totalDefenderDamage = defenderHeroes.reduce((sum, hero) => sum + hero.damage, 0);
  const totalParticipants = attackerHeroes.length + defenderHeroes.length;

  const getReadinessColor = (value: number) => {
    if (value >= 0.7) return READINESS_STATUS.high.text;
    if (value >= 0.4) return READINESS_STATUS.medium.text;
    return READINESS_STATUS.low.text;
  };

  const getReadinessBg = (value: number) => {
    if (value >= 0.7) return READINESS_STATUS.high.bg;
    if (value >= 0.4) return READINESS_STATUS.medium.bg;
    return READINESS_STATUS.low.bg;
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center p-4 duration-200",
        isClosing ? "animate-out fade-out" : "animate-in fade-in"
      )}
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div
        className={cn(
          "relative w-full max-w-5xl h-[85vh] duration-200",
          isClosing ? "animate-out zoom-out-95" : "animate-in zoom-in-95"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-card backdrop-blur-xl rounded-2xl shadow-2xl border border-border h-full flex flex-col overflow-hidden">
          {/* Header - simplified */}
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Battle Information
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-muted/80 rounded-xl transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="leaderboard" className="flex-1 overflow-hidden flex flex-col">
            <div className="px-6 pb-3 border-b border-border" onClick={(e) => e.stopPropagation()}>
              <TabsList className="flex flex-wrap w-full gap-2 justify-start">
                <TabsTrigger value="leaderboard" size="md" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Leaderboard</span>
                </TabsTrigger>
                <TabsTrigger value="communities" size="md" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>Communities</span>
                </TabsTrigger>
                <TabsTrigger value="observers" size="md" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  <span>Observers</span>
                </TabsTrigger>
                <TabsTrigger value="stats" size="md" className="flex items-center gap-2">
                  <Swords className="h-4 w-4" />
                  <span>Stats</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Leaderboard Tab */}
              <TabsContent value="leaderboard" className="p-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Defenders */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Shield className="h-4 w-4" />
                      <h3 className={cn("text-xs font-bold uppercase tracking-[0.15em]", BATTLE_THEME.sides.defender.colors.text)}>
                        Top Defenders
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {defenderHeroes.map((hero, idx) => (
                        <div
                          key={`def-${idx}`}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors border border-border"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {idx === 0 && (
                              <Crown className={cn("h-4 w-4 flex-shrink-0", STATUS_COLORS.crown, STATUS_COLORS.crownFill)} />
                            )}
                            <span className={cn("text-xs font-bold tabular-nums flex-shrink-0 min-w-[1.75rem]", BATTLE_THEME.sides.defender.colors.text)}>
                              #{idx + 1}
                            </span>
                            <Avatar className="h-7 w-7 shrink-0 border border-border">
                              <AvatarImage src={getUserAvatar(hero.name, hero.avatar)} />
                              <AvatarFallback className="text-xs">{hero.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm flex-1 truncate">
                              {hero.name}
                            </span>
                          </div>
                          <span className={cn("text-sm font-bold tabular-nums", BATTLE_THEME.sides.defender.colors.text)}>
                            {hero.damage.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {defenderHeroes.length === 0 && (
                        <div className="text-sm text-muted-foreground py-8 text-center">
                          No damage dealt yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attackers */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Swords className="h-4 w-4" />
                      <h3 className={cn("text-xs font-bold uppercase tracking-[0.15em]", BATTLE_THEME.sides.attacker.colors.text)}>
                        Top Attackers
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {attackerHeroes.map((hero, idx) => (
                        <div
                          key={`atk-${idx}`}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors border border-border"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {idx === 0 && (
                              <Crown className={cn("h-4 w-4 flex-shrink-0", STATUS_COLORS.crown, STATUS_COLORS.crownFill)} />
                            )}
                            <span className={cn("text-xs font-bold tabular-nums flex-shrink-0 min-w-[1.75rem]", BATTLE_THEME.sides.attacker.colors.text)}>
                              #{idx + 1}
                            </span>
                            <Avatar className="h-7 w-7 shrink-0 border border-border">
                              <AvatarImage src={getUserAvatar(hero.name, hero.avatar)} />
                              <AvatarFallback className="text-xs">{hero.name.slice(0, 2)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm flex-1 truncate">
                              {hero.name}
                            </span>
                          </div>
                          <span className={cn("text-sm font-bold tabular-nums", BATTLE_THEME.sides.attacker.colors.text)}>
                            {hero.damage.toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {attackerHeroes.length === 0 && (
                        <div className="text-sm text-muted-foreground py-8 text-center">
                          No damage dealt yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Communities Tab */}
              <TabsContent value="communities" className="p-6 mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Defender Community */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Shield className="h-4 w-4" />
                      <h3 className={cn("text-xs font-bold uppercase tracking-[0.15em]", BATTLE_THEME.sides.defender.colors.text)}>
                        Defending Force
                      </h3>
                    </div>
                    {defenderCommunity ? (
                      <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 border-2 rounded-xl" style={{ borderColor: defenderCommunity.color || FALLBACK_COLORS.defender }}>
                            <AvatarImage src={getCommunityAvatarUrl({
                              communityId: defenderCommunity.id,
                              color: defenderCommunity.color,
                              seedSource: defenderCommunity.name,
                            })} />
                            <AvatarFallback className="rounded-xl text-xs">{defenderCommunity.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-base truncate">{defenderCommunity.name}</h4>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Defender</p>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Warriors</span>
                            <span className="font-bold">{defenderHeroes.length}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Total Damage</span>
                            <span className={cn("font-bold", BATTLE_THEME.sides.defender.colors.text)}>
                              {totalDefenderDamage.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Battle Readiness */}
                        {defenderMechanics && (
                          <div className="space-y-3 pt-2 border-t border-border">
                            <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                              Battle Readiness
                            </h5>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Disarray</span>
                                <span className={cn("font-bold", getReadinessColor(defenderMechanics.disarray))}>
                                  {Math.round(defenderMechanics.disarray * 100)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all", getReadinessBg(defenderMechanics.disarray))}
                                  style={{ width: `${defenderMechanics.disarray * 100}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Exhaustion</span>
                                <span className={cn("font-bold", getReadinessColor(defenderMechanics.exhaustion))}>
                                  {Math.round(defenderMechanics.exhaustion * 100)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all", getReadinessBg(defenderMechanics.exhaustion))}
                                  style={{ width: `${defenderMechanics.exhaustion * 100}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Rage</span>
                                <span className="font-bold text-amber-500">
                                  {Math.round(defenderMechanics.rage * 100)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full transition-all bg-gradient-to-r from-amber-600 via-orange-500 to-red-500"
                                  style={{ width: `${defenderMechanics.rage * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-8 text-center">
                        No community data
                      </div>
                    )}
                  </div>

                  {/* Attacker Community */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2">
                      <Swords className="h-4 w-4" />
                      <h3 className={cn("text-xs font-bold uppercase tracking-[0.15em]", BATTLE_THEME.sides.attacker.colors.text)}>
                        Attacking Force
                      </h3>
                    </div>
                    {attackerCommunity ? (
                      <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12 border-2 rounded-xl" style={{ borderColor: attackerCommunity.color || FALLBACK_COLORS.attacker }}>
                            <AvatarImage src={getCommunityAvatarUrl({
                              communityId: attackerCommunity.id,
                              color: attackerCommunity.color,
                              seedSource: attackerCommunity.name,
                            })} />
                            <AvatarFallback className="rounded-xl text-xs">{attackerCommunity.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-base truncate">{attackerCommunity.name}</h4>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Attacker</p>
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Warriors</span>
                            <span className="font-bold">{attackerHeroes.length}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Total Damage</span>
                            <span className={cn("font-bold", BATTLE_THEME.sides.attacker.colors.text)}>
                              {totalAttackerDamage.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Battle Readiness */}
                        {attackerMechanics && (
                          <div className="space-y-3 pt-2 border-t border-border">
                            <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                              Battle Readiness
                            </h5>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Disarray</span>
                                <span className={cn("font-bold", getReadinessColor(attackerMechanics.disarray))}>
                                  {Math.round(attackerMechanics.disarray * 100)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all", getReadinessBg(attackerMechanics.disarray))}
                                  style={{ width: `${attackerMechanics.disarray * 100}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Exhaustion</span>
                                <span className={cn("font-bold", getReadinessColor(attackerMechanics.exhaustion))}>
                                  {Math.round(attackerMechanics.exhaustion * 100)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all", getReadinessBg(attackerMechanics.exhaustion))}
                                  style={{ width: `${attackerMechanics.exhaustion * 100}%` }}
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Rage</span>
                                <span className="font-bold text-amber-500">
                                  {Math.round(attackerMechanics.rage * 100)}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full transition-all bg-gradient-to-r from-amber-600 via-orange-500 to-red-500"
                                  style={{ width: `${attackerMechanics.rage * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground py-8 text-center">
                        No community data
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Observers Tab */}
              <TabsContent value="observers" className="p-6 mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        Active Observers
                      </h3>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {observers.length} {observers.length === 1 ? 'person' : 'people'} watching
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {observers.map((observer) => (
                      <div
                        key={observer.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <UserAvatar
                          username={observer.username}
                          avatarUrl={observer.avatar_url}
                          size="sm"
                          className="border border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <UserNameDisplay
                            username={observer.username}
                            userTier={observer.user_tier ?? "alpha"}
                            showLink={false}
                            badgeSize="sm"
                            className="font-medium text-sm truncate"
                          />
                          <p className="text-xs text-muted-foreground">Active now</p>
                        </div>
                        <div className={cn("h-2 w-2 rounded-full animate-pulse flex-shrink-0", STATUS_COLORS.activeIndicator)} />
                      </div>
                    ))}
                    {observers.length === 0 && (
                      <div className="col-span-2 text-sm text-muted-foreground py-8 text-center">
                        No active observers right now
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Stats Tab */}
              <TabsContent value="stats" className="p-6 mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground font-bold">
                        Warriors
                      </span>
                    </div>
                    <p className="text-2xl font-black">{totalParticipants}</p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Swords className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground font-bold">
                        Total Damage
                      </span>
                    </div>
                    <p className="text-2xl font-black">
                      {(totalAttackerDamage + totalDefenderDamage).toLocaleString()}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground font-bold">
                        Avg Damage
                      </span>
                    </div>
                    <p className="text-2xl font-black">
                      {totalParticipants > 0
                        ? Math.round((totalAttackerDamage + totalDefenderDamage) / totalParticipants).toLocaleString()
                        : '0'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <h4 className="text-xs uppercase tracking-[0.1em] text-muted-foreground font-bold">
                    Battle Intensity
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className={cn("font-bold", BATTLE_THEME.sides.attacker.colors.text)}>Attackers</span>
                      <span className="font-bold text-muted-foreground">{attackerHeroes.length} warriors</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-500", BATTLE_THEME.sides.attacker.colors.bg)}
                        style={{
                          width: `${totalParticipants > 0 ? (attackerHeroes.length / totalParticipants) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className={cn("font-bold", BATTLE_THEME.sides.defender.colors.text)}>Defenders</span>
                      <span className="font-bold text-muted-foreground">{defenderHeroes.length} warriors</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full transition-all duration-500", BATTLE_THEME.sides.defender.colors.bg)}
                        style={{
                          width: `${totalParticipants > 0 ? (defenderHeroes.length / totalParticipants) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

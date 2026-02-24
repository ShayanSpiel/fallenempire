"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sword, Target, Users, Calendar } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatar } from "@/lib/avatar";
import { normalizeStrength, STRENGTH_DISPLAY_PRECISION } from "@/lib/gameplay/strength";
import { getRankByScore, getRankDamageMultiplier } from "@/lib/military-ranks";
import { RankBadgeInline } from "@/components/profile/rank-badge";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BattleMechanicsStatus } from "@/components/battle/battle-mechanics-status";

type EnemyCommunity = {
  id: string;
  name: string;
  slug?: string;
  conflicts: number;
};

type AllyCommunity = {
  id: string;
  name: string;
  slug?: string;
  activated_at: string;
};

export type MilitaryMember = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  military_rank_score: number;
  battles_fought: number;
  battles_won: number;
  total_damage_dealt: number;
  strength: number;
  win_streak?: number;
  last_battle_at?: string;
};

interface MilitaryStatsPanelProps {
  communityId: string;
  communityName?: string;
  members: MilitaryMember[];
}

export function MilitaryStatsPanel({
  communityId,
  communityName = "This community",
  members,
}: MilitaryStatsPanelProps) {
  const [sortedMembers, setSortedMembers] = useState<MilitaryMember[]>([]);
  const [enemyData, setEnemyData] = useState<EnemyCommunity[]>([]);
  const [isLoadingEnemies, setIsLoadingEnemies] = useState(true);
  const [allyData, setAllyData] = useState<AllyCommunity[]>([]);
  const [isLoadingAllies, setIsLoadingAllies] = useState(true);
  const [averageRage, setAverageRage] = useState(0);

  // Sort members by military rank score
  useEffect(() => {
    const sorted = [...members].sort(
      (a, b) => (b.military_rank_score || 0) - (a.military_rank_score || 0)
    );
    setSortedMembers(sorted);
  }, [members]);

  // Fetch enemy communities from battles
  useEffect(() => {
    const fetchEnemies = async () => {
      setIsLoadingEnemies(true);
      try {
        const supabase = createSupabaseBrowserClient();

        // Fetch all battles where this community was involved
        const { data: battles, error } = await supabase
          .from("battles")
          .select(`
            id,
            attacker_community_id,
            defender_community_id,
            attacker:communities!battles_attacker_community_id_fkey(id, name, slug),
            defender:communities!battles_defender_community_id_fkey(id, name, slug)
          `)
          .or(`attacker_community_id.eq.${communityId},defender_community_id.eq.${communityId}`);

        if (error) {
          console.error("Error fetching battles:", error);
          return;
        }

        // Count conflicts per enemy community
        const enemyMap = new Map<string, EnemyCommunity>();

        (battles || []).forEach((battle: any) => {
          let enemyCommunityId: string | null = null;
          let enemyCommunityData: any = null;

          // Determine which community is the enemy
          if (battle.attacker_community_id === communityId && battle.defender_community_id) {
            enemyCommunityId = battle.defender_community_id;
            enemyCommunityData = battle.defender;
          } else if (battle.defender_community_id === communityId) {
            enemyCommunityId = battle.attacker_community_id;
            enemyCommunityData = battle.attacker;
          }

          if (enemyCommunityId && enemyCommunityData) {
            const existing = enemyMap.get(enemyCommunityId);
            if (existing) {
              existing.conflicts += 1;
            } else {
              enemyMap.set(enemyCommunityId, {
                id: enemyCommunityId,
                name: enemyCommunityData.name || "Unknown Community",
                slug: enemyCommunityData.slug,
                conflicts: 1,
              });
            }
          }
        });

        // Sort by number of conflicts (descending)
        const enemies = Array.from(enemyMap.values()).sort(
          (a, b) => b.conflicts - a.conflicts
        );

        setEnemyData(enemies);
      } catch (err) {
        console.error("Error fetching enemy data:", err);
      } finally {
        setIsLoadingEnemies(false);
      }
    };

    fetchEnemies();
  }, [communityId]);

  // Fetch ally communities
  useEffect(() => {
    const fetchAllies = async () => {
      setIsLoadingAllies(true);
      try {
        const supabase = createSupabaseBrowserClient();

        // Use the RPC function to get active allies
        const { data: allies, error } = await supabase
          .rpc('get_active_allies', { p_community_id: communityId });

        if (error) {
          console.error("Error fetching allies:", error);
          return;
        }

        // Transform the data
        const allyList: AllyCommunity[] = (allies || []).map((ally: any) => ({
          id: ally.ally_community_id,
          name: ally.ally_community_name,
          slug: ally.ally_community_slug,
          activated_at: ally.alliance_activated_at,
        }));

        setAllyData(allyList);
      } catch (err) {
        console.error("Error fetching ally data:", err);
      } finally {
        setIsLoadingAllies(false);
      }
    };

    fetchAllies();
  }, [communityId]);

  // Calculate community-wide stats
  const stats = useMemo(() => {
    if (members.length === 0) {
      return {
        avgStrength: 0,
        avgHit: 0,
        activeSoldiers: 0,
      };
    }

    const totalStrength = members.reduce(
      (sum, m) => sum + Math.max(0, m.strength ?? 0),
      0
    );
    const avgStrength = normalizeStrength(totalStrength / members.length);

    const totalBaseDamage = members.reduce((sum, member) => {
      const rank = getRankByScore(member.military_rank_score ?? 0);
      const multiplier = getRankDamageMultiplier(rank.rank);
      const baseDamage = Math.max(0, member.strength ?? 0) * 100 * multiplier;
      return sum + baseDamage;
    }, 0);
    const avgHit = Math.round(totalBaseDamage / members.length);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeSoldiers = members.filter((m) => {
      if (!m.last_battle_at) return false;
      return new Date(m.last_battle_at) > sevenDaysAgo;
    }).length;

    return {
      avgStrength,
      avgHit,
      activeSoldiers,
    };
  }, [members]);

  // Fetch average community rage
  useEffect(() => {
    const fetchAverageRage = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: users } = await supabase
          .from("users")
          .select("rage")
          .in("id", members.map(m => m.user_id));

        if (users && users.length > 0) {
          const totalRage = users.reduce((sum: number, u: { rage: number | null }) => sum + (u.rage || 0), 0);
          setAverageRage(totalRage / users.length);
        }
      } catch (err) {
        console.error("Error fetching average rage:", err);
      }
    };

    if (members.length > 0) {
      fetchAverageRage();
    }
  }, [members]);

  return (
    <div className="space-y-6">
      {/* Community Military Summary */}
      <Card variant="default">
        <CardContent className="space-y-4">
          <SectionHeading title="Military Overview" icon={Sword} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Average Strength */}
            <div className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Avg Strength
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.avgStrength.toFixed(STRENGTH_DISPLAY_PRECISION)}
              </div>
              <p className="text-xs text-muted-foreground">
                Training strength
              </p>
            </div>

            {/* Average Hit */}
            <div className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Avg Hit
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.avgHit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Base damage per fight
              </p>
            </div>

            {/* Active Soldiers */}
            <div className="flex flex-col space-y-2 p-4 rounded-xl border border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Active (7d)
                </span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.activeSoldiers}
              </div>
              <p className="text-xs text-muted-foreground">
                Active soldiers
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Military Rankings */}
      <Card variant="default">
        <CardContent className="space-y-4">
          <SectionHeading title="Military Rankings" icon={Sword} />

          {sortedMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Sword className="h-8 w-8 mb-2 opacity-30" />
              <span className="text-sm">No soldiers enlisted</span>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedMembers.map((member, index) => {
                const rank = getRankByScore(member.military_rank_score || 0);
                const username = member.username ?? "Unknown Entity";
                const winRate =
                  member.battles_fought > 0
                    ? Math.round((member.battles_won / member.battles_fought) * 100)
                    : 0;
                const damageTotal = Number(member.total_damage_dealt || 0);

                return (
                  <Link
                    key={member.user_id}
                    href={`/profile/${member.username}`}
                    className="group grid w-full grid-cols-[auto_auto_1fr_auto_auto] grid-rows-2 items-center gap-x-3 gap-y-1 p-3 rounded-lg border border-transparent hover:border-border/50 hover:bg-accent/40 transition-all duration-200"
                  >
                    <div className="col-start-1 row-span-2 flex h-8 w-8 items-center justify-center self-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
                      #{index + 1}
                    </div>

                    <Avatar className="col-start-2 row-span-2 h-10 w-10 self-center rounded-lg border border-border/60 bg-background flex-shrink-0 group-hover:scale-105 transition-transform">
                      <AvatarImage
                        src={resolveAvatar({
                          avatarUrl: member.avatar_url ?? null,
                          seed: username,
                        })}
                      />
                      <AvatarFallback className="rounded-lg text-xs font-bold text-muted-foreground">
                        {username[0]}
                      </AvatarFallback>
                    </Avatar>

                    <p className="col-start-3 row-start-1 min-w-0 text-sm font-semibold text-foreground truncate">
                      {username}
                    </p>
                    <p className="col-start-3 row-start-2 min-w-0 text-xs text-muted-foreground">
                      {damageTotal.toLocaleString()} total damage
                    </p>

                    <p className="col-start-4 row-start-1 text-xs font-semibold text-amber-400 text-right">
                      {rank.rank}
                    </p>
                    <p className="col-start-4 row-start-2 text-xs text-muted-foreground text-right">
                      {member.battles_fought} battles • {winRate}% win
                    </p>

                    <div className="col-start-5 row-span-2 flex items-center justify-center self-center">
                      <RankBadgeInline
                        rank={rank.rank}
                        rankNumber={rank.rankNumber}
                        fallbackIcon={rank.icon}
                        showLabel={false}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Battle Readiness */}
      <BattleMechanicsStatus
        communityId={communityId}
        communityName={communityName}
        averageRage={averageRage}
        showHeading={true}
      />

      {/* Enemies & Allies */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card variant="default">
          <CardContent className="space-y-4">
            <SectionHeading
              title="Rival Communities"
              icon={Target}
              tooltip="Communities that have been in conflict with yours through battles"
            />

            {isLoadingEnemies ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted-foreground mb-2" />
                <span className="text-sm">Loading rivals...</span>
              </div>
            ) : enemyData && enemyData.length > 0 ? (
              <div className="space-y-2">
                {enemyData.map((enemy) => (
                  <Link
                    key={enemy.id}
                    href={`/community/${enemy.slug || enemy.id}`}
                    className="group flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/10 hover:border-border hover:bg-muted/30 transition-all duration-200"
                  >
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 rounded-lg border border-border/60 bg-background flex-shrink-0 group-hover:scale-105 transition-transform">
                      <AvatarImage
                        src={resolveAvatar({ seed: enemy.name })}
                      />
                      <AvatarFallback className="rounded-lg text-xs font-bold text-muted-foreground">
                        {enemy.name[0]}
                      </AvatarFallback>
                    </Avatar>

                    {/* Enemy Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {enemy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {enemy.conflicts} {enemy.conflicts === 1 ? "conflict" : "conflicts"}
                      </p>
                    </div>

                    {/* Badge */}
                    <Badge variant="destructive" className="flex-shrink-0">
                      Enemy
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Target className="h-8 w-8 mb-2 opacity-30" />
                <span className="text-sm">No active rivals</span>
                <p className="text-xs text-muted-foreground/70 mt-1">Start battles to establish rivalries</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="default">
          <CardContent className="space-y-4">
            <SectionHeading
              title="Allies"
              icon={Users}
              tooltip="Communities with active alliances. Allies can fight in each other's battles from home."
            />

            {isLoadingAllies ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-muted-foreground mb-2" />
                <span className="text-sm">Loading allies...</span>
              </div>
            ) : allyData && allyData.length > 0 ? (
              <div className="space-y-2">
                {allyData.map((ally) => (
                  <Link
                    key={ally.id}
                    href={`/community/${ally.slug || ally.id}`}
                    className="group flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/10 hover:border-border hover:bg-muted/30 transition-all duration-200"
                  >
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 rounded-lg border border-border/60 bg-background flex-shrink-0 group-hover:scale-105 transition-transform">
                      <AvatarImage
                        src={resolveAvatar({ seed: ally.name })}
                      />
                      <AvatarFallback className="rounded-lg text-xs font-bold text-muted-foreground">
                        {ally.name[0]}
                      </AvatarFallback>
                    </Avatar>

                    {/* Ally Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {ally.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Allied since {new Date(ally.activated_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Badge */}
                    <Badge variant="default" className="flex-shrink-0 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30">
                      Ally
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-30" />
                <span className="text-sm">No active alliances</span>
                <p className="text-xs text-muted-foreground/70 mt-1">Propose a CFC Alliance law to form alliances</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

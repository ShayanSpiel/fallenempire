"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { resolveAvatar } from "@/lib/avatar";
import { Loader2, Crown, ChevronDown, Flame, Eye, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { awardXp } from "@/app/actions/xp";
import { awardBattleHeroMedal } from "@/app/actions/medals";
import { showLevelUpToast } from "@/components/progression/level-up-toast";
import { useMedalNotification } from "@/components/medals/medal-notification-provider";
import { recordBattleParticipation } from "@/app/actions/military-ranks";
import { getProgressToNextRank } from "@/lib/military-ranks";
import { BATTLE_ATTACK_ENERGY_COST, ENERGY_CAP } from "@/lib/gameplay/constants";
import { useUserVitals } from "@/components/layout/user-vitals";
import { useUserStats } from "@/lib/hooks/useUserStats";
import { toast } from "sonner";
import { BATTLE_THEME } from "@/lib/battle-theme";

// Battle system imports
import type {
  BattleState,
  BattleSide,
  BattleLog,
  UserStats,
  CommunityInfo,
  BattleStatus,
  UserRole,
  RawBattleLogEntry,
  FloatingTaunt as FloatingTauntType,
} from "@/lib/battle/types";
import {
  normalizeBattleLog,
  calculateBattleStats,
  getUserAvatar,
  isAttackerVictory,
  isDefenderVictory,
} from "@/lib/battle/utils";
import {
  FIGHT_BUTTON_COOLDOWN_MS,
  HERO_BUMP_DURATION,
  SCORE_BUMP_DURATION,
  WALL_IMG_URL,
  WALL_CONTAINER_STYLE,
  TIMER_UPDATE_INTERVAL,
} from "@/lib/battle/constants";
import { useBattleHeroes, useBattleAnimations, useBattleTimer } from "@/lib/battle/hooks";

// Battle UI components
import { BattleHeader } from "@/components/battle/battle-header";
import { BattleHeroes } from "@/components/battle/battle-heroes";
import { BattleWall } from "@/components/battle/battle-wall";
import { BattleControls } from "@/components/battle/battle-controls";
import { BattleInfoModal } from "@/components/battle/battle-info-modal";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BattleToast } from "@/components/battle/battle-toast";
import { FloatingDamage } from "@/components/battle/floating-damage";
import { FloatingTaunt } from "@/components/battle/floating-taunt";
import { FloatingRage } from "@/components/battle/floating-rage";
import { FloatingAdrenalineRage } from "@/components/battle/floating-adrenaline-rage";
import { StatBar } from "@/components/battle/stat-bar";
import { AdrenalineBar } from "@/components/battle/adrenaline-bar";

// Adrenaline system
import type { AdrenalineConfig, AdrenalineState } from "@/lib/battle-mechanics/types";
import { DEFAULT_BATTLE_MECHANICS_CONFIG } from "@/lib/battle-mechanics/types";
import {
  calculateAdrenalineState,
  extractAdrenalineConfig,
} from "@/lib/battle-mechanics/adrenaline";

export default function BattlePage() {
  const { id } = useParams();
  const supabase = createSupabaseBrowserClient();

  // --- Core State ---
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [regionLabel, setRegionLabel] = useState<string | null>(null);
  const [attackerComm, setAttackerComm] = useState<CommunityInfo | null>(null);
  const [defenderComm, setDefenderComm] = useState<CommunityInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<UserStats | null>(null);
  const [userSide, setUserSide] = useState<BattleSide>(null);
  const [userRole, setUserRole] = useState<UserRole>("standard"); // TODO: Determine from community alliances
  const [loading, setLoading] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [finalStatusText, setFinalStatusText] = useState<string | null>(null);

  // Toast logs
  const [defenderLogs, setDefenderLogs] = useState<BattleLog[]>([]);
  const [attackerLogs, setAttackerLogs] = useState<BattleLog[]>([]);

  // UI State
  const [showBattleInfo, setShowBattleInfo] = useState(false);
  const [fightButtonLoading, setFightButtonLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastCombatResult, setLastCombatResult] = useState<{ result: string; damage: number } | null>(null);
  const [isBombing, setIsBombing] = useState(false);
  const [userRage, setUserRage] = useState(0);
  const [userFocus, setUserFocus] = useState(50);

  // Refs
  const resolvingRef = useRef(false);
  const pendingAttacksRef = useRef(0);
  const lastAttackTimestampRef = useRef<number | null>(null);
  const fightButtonLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousRageRef = useRef<number>(0);
  const previousAdrenalineRageRef = useRef<number>(0);
  const tauntCountRef = useRef<{ count: number; resetTime: number }>({ count: 0, resetTime: 0 });

  // Adrenaline State
  const [adrenalineConfig, setAdrenalineConfig] = useState<AdrenalineConfig | null>(null);
  const [adrenalineState, setAdrenalineState] = useState<AdrenalineState>({
    isInWindow: false,
    conditionMet: false,
    cumulativeTimeMs: 0,
    bonusRage: 0,
    percentElapsed: 0,
    damageRatio: 0,
  });
  const lastAdrenalineCheckRef = useRef<number>(Date.now());
  const cumulativeAdrenalineTimeRef = useRef<number>(0);

  // --- Custom Hooks ---
  const { showMedal } = useMedalNotification();
  const { setEnergy } = useUserVitals();
  const { stats: realtimeUserStats } = useUserStats(currentUser?.id);

  // Battle timer hook
  const { timeLeft, isTimerCritical } = useBattleTimer(battle);

  // Battle heroes hook
  const { ingestHeroLog, getHeroLeaders, resetHeroTracking, getTop10BySide, heroTotalsRef } =
    useBattleHeroes();

  // Battle animations hook
  const {
    floatingHits,
    floatingTaunts,
    floatingRageAnims,
    floatingAdrenalineRageAnims,
    heroAtkBump,
    heroDefBump,
    scoreBump,
    spawnFloatingHit,
    spawnFloatingTaunt,
    removeFloatingTaunt,
    spawnFloatingRage,
    spawnFloatingAdrenalineRage,
    triggerHeroBump,
    triggerScoreBump,
    scheduleLogRemoval,
    cleanupTimers,
  } = useBattleAnimations();

  // Get hero leaders for display (reactively)
  const [attackerHero, setAttackerHero] = useState<{ name: string; avatar?: string | null; damage: number } | null>(null);
  const [defenderHero, setDefenderHero] = useState<{ name: string; avatar?: string | null; damage: number } | null>(null);

  // Function to update hero leaders from current totals
  const updateHeroLeaders = useCallback(() => {
    const leaders = getHeroLeaders();
    if (leaders.attacker) {
      setAttackerHero({ name: leaders.attacker.name, avatar: leaders.attacker.avatar, damage: leaders.attacker.damage });
    } else {
      setAttackerHero(null);
    }
    if (leaders.defender) {
      setDefenderHero({ name: leaders.defender.name, avatar: leaders.defender.avatar, damage: leaders.defender.damage });
    } else {
      setDefenderHero(null);
    }
  }, [getHeroLeaders]);

  const updateBattleParticipantStats = async () => {
    if (!battle) return;

    try {
      // Fetch already-recorded participation so we only add missing damage
      const { data: existingParticipants } = await supabase
        .from("battle_participants")
        .select("user_id, damage_dealt")
        .eq("battle_id", battle.id);

      const participantDamage = new Map<string, number>();
      (existingParticipants || []).forEach((p: { user_id: string; damage_dealt: number }) => {
        participantDamage.set(p.user_id, Number(p.damage_dealt ?? 0));
      });

      const participants = Object.values(heroTotalsRef.current);

      for (const participant of participants) {
        if (!participant || !participant.actorId) continue;

        const alreadyRecorded = participantDamage.get(participant.actorId) ?? 0;
        const missingDamage = participant.damage - alreadyRecorded;

        if (missingDamage > 0) {
          await recordBattleParticipation(
            participant.actorId,
            battle.id,
            participant.side,
            missingDamage
          );
        }
      }

      console.log("Battle participation synced for resolved battle");
    } catch (err) {
      console.error("Error recording battle participation:", err);
    }
  };

  const awardBattleHeroMedals = async () => {
    if (!battle || !currentUser) {
      console.log("Cannot award medals: battle or currentUser missing", { battle: !!battle, currentUser: !!currentUser });
      return;
    }

    try {
      // Get heroes from each side
      const attackerHeroes = getTop10BySide("attacker");
      const defenderHeroes = getTop10BySide("defender");

      console.log("Battle ended, awarding medals...", {
        attackerHeroCount: attackerHeroes.length,
        defenderHeroCount: defenderHeroes.length,
        currentUserId: currentUser.id,
      });

      // Award to attacker hero if exists
      if (attackerHeroes.length > 0) {
        const hero = attackerHeroes[0];
        let heroUserId = hero.actorId;

        // If we don't have actorId, try to find user by username
        if (!heroUserId && hero.name) {
          console.log("Looking up user ID by username:", hero.name);
          const { data: userByName } = await supabase
            .from("users")
            .select("id")
            .eq("username", hero.name)
            .single();
          heroUserId = userByName?.id || null;
        }

        if (heroUserId) {
          console.log("Awarding attacker hero medal:", { heroId: heroUserId, damage: hero.damage });
          const result = await awardBattleHeroMedal(heroUserId, battle!.id, hero.damage);

          // Show modal if medal was awarded successfully
          console.log("Attacker hero medal result:", result);
          if (result.success && heroUserId === currentUser.id) {
            console.log("Showing medal modal for attacker hero");
            showMedal({
              medalName: result.medalName || "Battle Hero",
              medalKey: result.medalKey || "battle_hero",
              description: result.isNewAward ? "Dealt the highest damage in a battle" : "You were the top attacker!",
            });
          }
        }
      }

      // Award to defender hero if exists
      if (defenderHeroes.length > 0) {
        const hero = defenderHeroes[0];
        let heroUserId = hero.actorId;

        // If we don't have actorId, try to find user by username
        if (!heroUserId && hero.name) {
          console.log("Looking up user ID by username:", hero.name);
          const { data: userByName } = await supabase
            .from("users")
            .select("id")
            .eq("username", hero.name)
            .single();
          heroUserId = userByName?.id || null;
        }

        if (heroUserId) {
          console.log("Awarding defender hero medal:", { heroId: heroUserId, damage: hero.damage });
          const result = await awardBattleHeroMedal(heroUserId, battle!.id, Math.abs(hero.damage));

          // Show modal if medal was awarded successfully
          console.log("Defender hero medal result:", result);
          if (result.success && heroUserId === currentUser.id) {
            console.log("Showing medal modal for defender hero");
            showMedal({
              medalName: result.medalName || "Battle Hero",
              medalKey: result.medalKey || "battle_hero",
              description: result.isNewAward ? "Dealt the highest damage in a battle" : "You were the top defender!",
            });
          }
        }
      }
    } catch (err) {
      console.error("Error awarding battle hero medals:", err);
    }
  };

  // --- Initialization ---

  useEffect(() => {
    if (!realtimeUserStats) return;

    if (typeof realtimeUserStats.morale === "number") {
      setUserFocus(realtimeUserStats.morale);
    }

    if (typeof realtimeUserStats.rage === "number") {
      setUserRage(realtimeUserStats.rage);
      previousRageRef.current = realtimeUserStats.rage;
    }
  }, [realtimeUserStats?.morale, realtimeUserStats?.rage]);

  useEffect(() => {
    if (!id) return;
    resetHeroTracking();
    let mounted = true;
    const ingestLog = (log: BattleLog) => {
      ingestHeroLog(log);
      updateHeroLeaders();
    };

    const initData = async () => {
      try {
        setLoading(true);
        
        // Parallelize independent fetches
        const [battleRes, logsRes, userRes] = await Promise.all([
            supabase.from("battles").select("*").eq("id", id).single(),
            supabase.from("battle_logs").select("*").eq("battle_id", id).order("created_at", { ascending: true }).limit(1000),
            supabase.auth.getUser()
        ]);

        if (battleRes.error) throw battleRes.error;
        const b = battleRes.data as BattleState;
        
        // Fetch Communities
        const commFetches = [];
        if (b.attacker_community_id) commFetches.push(supabase.from("communities").select("id, name, color, logo_url").eq("id", b.attacker_community_id).single());
        if (b.defender_community_id) commFetches.push(supabase.from("communities").select("id, name, color, logo_url").eq("id", b.defender_community_id).single());
        
        const commResults = await Promise.all(commFetches);
        
        if (!mounted) return;

        setBattle(b);

        // Fetch adrenaline configuration
        try {
          const { data: configData, error } = await supabase
            .from("battle_mechanics_config")
            .select("*")
            .is("community_id", null)
            .maybeSingle();

          if (error) {
            console.warn("Failed to load adrenaline config, using defaults:", error);
          }

          const config = extractAdrenalineConfig(
            configData ?? DEFAULT_BATTLE_MECHANICS_CONFIG
          );
          if (mounted) {
            setAdrenalineConfig(config);
          }
        } catch (err) {
          console.error("Error fetching adrenaline config:", err);
          if (mounted) {
            const fallback = extractAdrenalineConfig(DEFAULT_BATTLE_MECHANICS_CONFIG);
            setAdrenalineConfig(fallback);
          }
        }

        setRegionLabel(null);
        if (b.target_hex_id) {
          const { data: region } = await supabase
            .from("world_regions")
            .select("custom_name, province_name")
            .eq("hex_id", b.target_hex_id)
            .maybeSingle();
          if (mounted) {
            const displayName = region?.custom_name || region?.province_name || `#${b.target_hex_id}`;
            setRegionLabel(displayName);
          }
        }
        
        // Logs & Heroes
        const rawLogs = Array.isArray(logsRes.data) ? logsRes.data : [];
        const normalized = rawLogs.map((entry: RawBattleLogEntry) => normalizeBattleLog(entry));
        normalized.forEach((log: BattleLog) => ingestLog(log));

        // Don't show historical toasts on page load - skip displaying them

        // Communities
        const ac = b.attacker_community_id ? commResults.find(r => r.data?.id === b.attacker_community_id)?.data : null;
        const dc = b.defender_community_id ? commResults.find(r => r.data?.id === b.defender_community_id)?.data : null;

        if (ac) setAttackerComm(ac);
        if (dc) setDefenderComm(dc);
        else setDefenderComm({ id: "neutral", name: "Neutral Defenders", color: "#10b981" });

        // User
        if (userRes.data.user) {
            let { data: profile } = await supabase
                .from("users")
                .select("id, username, avatar_url, main_community_id, strength, energy, morale, rage, current_military_rank, military_rank_score, total_damage_dealt, battles_fought, battles_won, auth_id")
                .eq("auth_id", userRes.data.user.id)
                .single();
            
            // Create user profile on-the-fly if missing so battle logging succeeds
            if (!profile) {
                const fallbackUsername =
                    userRes.data.user.user_metadata?.username ||
                    userRes.data.user.user_metadata?.name ||
                    userRes.data.user.email?.split("@")[0] ||
                    `player-${userRes.data.user.id.slice(0, 6)}`;
                const nowIso = new Date().toISOString();
                const { data: inserted } = await supabase
                    .from("users")
                    .insert({
                        auth_id: userRes.data.user.id,
                        username: fallbackUsername,
                        is_bot: false,
                        energy: ENERGY_CAP,
                        energy_updated_at: nowIso,
                    })
                    .select("*")
                    .single();
                profile = inserted ?? null;
            }

            if (mounted && profile) {
                const profileEnergy = typeof profile.energy === "number" ? profile.energy : ENERGY_CAP;
                const profileMorale = typeof profile.morale === "number" ? profile.morale : 50;
                const profileRage = typeof profile.rage === "number" ? profile.rage : 0;

                setCurrentUser({
                    id: profile.id,
                    username: profile.username || "Unknown",
                    avatar_url: profile.avatar_url,
                    community_id: profile.main_community_id,
                    strength: profile.strength || 1,
                    energy: profileEnergy,
                    current_military_rank: profile.current_military_rank || "Recruit",
                    military_rank_score: profile.military_rank_score,
                    total_damage_dealt: profile.total_damage_dealt,
                    battles_fought: profile.battles_fought,
                    battles_won: profile.battles_won,
                    authId: profile.auth_id ?? userRes.data.user.id,
                });
                setEnergy(profileEnergy);
                setUserRage(profileRage);
                previousRageRef.current = profileRage; // Initialize previous rage
                setUserFocus(profileMorale); // Focus = Morale (1:1 ratio)

                // Determine user side and role
                let determinedSide: BattleSide = null;
                let determinedRole: UserRole = "standard";

                // Check if user is a direct member of attacker/defender community
                if (profile.main_community_id === b.attacker_community_id) {
                  determinedSide = "attacker";
                  determinedRole = "standard";
                } else if (profile.main_community_id === b.defender_community_id) {
                  determinedSide = "defender";
                  determinedRole = "standard";
                } else if (profile.main_community_id) {
                  // User is not a direct member - check alliances
                  // Check if allied with attacker
                  if (b.attacker_community_id) {
                    const { data: isAlliedWithAttacker } = await supabase.rpc('are_communities_allied', {
                      p_community_id_1: profile.main_community_id,
                      p_community_id_2: b.attacker_community_id
                    });
                    if (isAlliedWithAttacker === true) {
                      determinedSide = "attacker";
                      determinedRole = "ally";
                    }
                  }

                  // Check if allied with defender (only if not already allied with attacker)
                  if (!determinedSide && b.defender_community_id) {
                    const { data: isAlliedWithDefender } = await supabase.rpc('are_communities_allied', {
                      p_community_id_1: profile.main_community_id,
                      p_community_id_2: b.defender_community_id
                    });
                    if (isAlliedWithDefender === true) {
                      determinedSide = "defender";
                      determinedRole = "ally";
                    }
                  }
                }

                // Set the state with determined values
                if (mounted) {
                  setUserSide(determinedSide);
                  setUserRole(determinedRole);
                }
            }
        }
      } catch (err) {
        console.error("Error loading battle:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initData();

    // --- Realtime Subscriptions ---
    const channel = supabase
      .channel(`battle-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "battles", filter: `id=eq.${id}` }, (payload: any) => {
        if (!mounted) return;

        const incomingBattle = payload.new as BattleState;

        // Smart reconciliation: merge with current state intelligently
        setBattle((currentBattle) => {
          if (!currentBattle) return incomingBattle;

          // If we have pending attacks, be conservative about overwriting optimistic updates
          // Only update if the incoming data is significantly different (status change, major defense change)
          if (pendingAttacksRef.current > 0) {
            // Status changed (battle ended) - always accept
            if (currentBattle.status !== incomingBattle.status) {
              return incomingBattle;
            }

            // Defense changed by more than our typical damage range - accept update
            const defenseDiff = Math.abs(currentBattle.current_defense - incomingBattle.current_defense);
            if (defenseDiff > 100000) {
              // Large change, likely from other players
              return incomingBattle;
            }

            // Otherwise, keep our optimistic state for now
            // (API response will sync it properly)
            return currentBattle;
          }

          // No pending updates - safely merge
          return incomingBattle;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_logs", filter: `battle_id=eq.${id}` }, (payload: any) => {
          if (!mounted) return;
          const normalizedLog = normalizeBattleLog(payload.new as RawBattleLogEntry);

          // Filter out own attacks to prevent duplicate animations
          // (we already show optimistic animations on attack)
          const isOwnAction = normalizedLog.actor_id === currentUser?.id;

          if (!isOwnAction) {
            // Only show visual effects for other players' actions
            triggerHeroBump(normalizedLog.side, HERO_BUMP_DURATION);
            triggerScoreBump(SCORE_BUMP_DURATION);

            // Pass result to floating damage animation
            const result = normalizedLog.result || "HIT";
            spawnFloatingHit(normalizedLog.side, normalizedLog.damage, result);

            if (normalizedLog.side === "defender") {
                setDefenderLogs((prev) => [...prev, normalizedLog].slice(-6));
                scheduleLogRemoval(setDefenderLogs, normalizedLog.id);
            } else {
                setAttackerLogs((prev) => [normalizedLog, ...prev].slice(0, 6));
                scheduleLogRemoval(setAttackerLogs, normalizedLog.id);
            }
          }

          // Always ingest for hero tracking (even own actions)
          ingestLog(normalizedLog);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "battle_taunts", filter: `battle_id=eq.${id}` }, (payload: any) => {
          if (!mounted) return;
          const tauntData = payload.new as { id: string; username: string; avatar_url?: string | null };

          // Generate random position on screen
          const x = Math.random() * 80 + 10; // 10% to 90% of width
          const y = Math.random() * 60 + 20; // 20% to 80% of height

          const taunt: FloatingTauntType = {
            id: tauntData.id,
            username: tauntData.username,
            avatar_url: tauntData.avatar_url,
            position: { x, y },
          };

          spawnFloatingTaunt(taunt);
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      // Cancel any pending attack requests on unmount/battle change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, supabase]);

  // Track battle observers (using separate battle_observers table)
  useEffect(() => {
    if (!id || !currentUser) return;

    const trackView = async () => {
      try {
        // Use RPC to upsert into battle_observers table (not battle_logs)
        await supabase.rpc('update_battle_observer', {
          p_battle_id: id as string,
          p_user_id: currentUser.id,
        });
      } catch (error) {
        // Silently fail - observer tracking is non-critical
        console.debug('Observer tracking failed:', error);
      }
    };

    // Track initial view
    trackView();

    // Update view every 2 minutes to show active presence
    const interval = setInterval(trackView, 120000);

    return () => clearInterval(interval);
  }, [id, currentUser, supabase]); // Removed userSide dependency

  // Timer & Finish Check
  useEffect(() => {
    if (!battle) return;

    if (battle.status === "active") {
      if (battle.current_defense <= 0) {
        setIsFinished(false);
        setFinalStatusText("Wall breached — waiting for resolution...");
      } else {
        setIsFinished(false);
        setFinalStatusText(null);
      }
    } else if (isAttackerVictory(battle.status)) {
      setIsFinished(true);
      setFinalStatusText(`${attackerComm?.name || "Attackers"} Conquered #${battle.target_hex_id}!`);
      // Update battle participant stats and awards
      updateBattleParticipantStats();
      awardBattleHeroMedals();
      return;
    } else if (isDefenderVictory(battle.status)) {
      setIsFinished(true);
      setFinalStatusText(`${defenderComm?.name || "Defenders"} Successfully Defended!`);
      // Update battle participant stats and awards
      updateBattleParticipantStats();
      awardBattleHeroMedals();
      return;
    }

    const interval = setInterval(async () => {
      const now = Date.now();
      const end = new Date(battle.ends_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        if (battle.status === "active" && !resolvingRef.current) {
          resolvingRef.current = true;
          try {
            const { data } = await supabase.rpc("resolve_battle_outcome", { p_battle_id: battle.id });
            if (data && data.status && data.status !== "active") {
              setBattle((prev) =>
                prev
                  ? { ...prev, status: data.status, current_defense: data.current_defense ?? prev.current_defense }
                  : null
              );
            }
          } catch (err) {
            console.error("Battle resolution failed:", err);
          } finally {
            resolvingRef.current = false;
          }
        }
        return;
      }
    }, TIMER_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [battle, supabase, attackerComm, defenderComm]);

  // Adrenaline Rule Tracking (only for defenders)
  useEffect(() => {
    if (!battle) return;
    if (!adrenalineConfig) return;
    if (!adrenalineConfig.enabled) return;
    if (userSide !== "defender") return;

    const intervalMs = (adrenalineConfig.check_interval_seconds ?? 1) * 1000;

    const interval = setInterval(() => {
      const now = Date.now();
      const deltaMs = now - lastAdrenalineCheckRef.current;
      lastAdrenalineCheckRef.current = now;

      // Calculate started_at if missing (for old battles without this field)
      // Assume 6 hour battle duration as default
      let calculatedStartedAt = battle.started_at;
      if (!calculatedStartedAt) {
        const endsAtMs = new Date(battle.ends_at).getTime();
        const battleDurationMs = 6 * 60 * 60 * 1000; // 6 hours default
        calculatedStartedAt = new Date(endsAtMs - battleDurationMs).toISOString();
      }

      const battleData = {
        started_at: calculatedStartedAt,
        ends_at: battle.ends_at,
        attacker_score: battle.attacker_score ?? 0,
        defender_score: battle.defender_score ?? 0,
        status: battle.status,
      };

      // Calculate new adrenaline state
      const newState = calculateAdrenalineState({
        battle: battleData,
        config: adrenalineConfig,
        currentTimeMs: now,
        previousState: { cumulativeTimeMs: cumulativeAdrenalineTimeRef.current },
      });

      // Update cumulative time if condition is met (using ref instead of state)
      if (newState.isInWindow && newState.conditionMet) {
        cumulativeAdrenalineTimeRef.current += deltaMs;
      }

      // Recalculate bonus rage with updated cumulative time
      const totalDurationMs = new Date(battleData.ends_at).getTime() - new Date(battleData.started_at).getTime();
      const bonusRage = Math.min(
        adrenalineConfig.max_rage,
        Math.floor(
          (cumulativeAdrenalineTimeRef.current / totalDurationMs) *
          100 *
          adrenalineConfig.rage_per_percent_time
        )
      );

      // Detect adrenaline rage increase and spawn floating animations
      const rageIncrease = bonusRage - previousAdrenalineRageRef.current;

      if (rageIncrease > 0) {
        // Spawn floating animation for rage increase
        spawnFloatingAdrenalineRage();
      }
      previousAdrenalineRageRef.current = bonusRage;

      setAdrenalineState({
        ...newState,
        cumulativeTimeMs: cumulativeAdrenalineTimeRef.current,
        bonusRage,
      });
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [battle, adrenalineConfig, userSide, spawnFloatingAdrenalineRage]);

  const handleFight = useCallback(async () => {
    if (!battle || isFinished || !currentUser || !userSide) return;

    // Rate limit check
    const now = Date.now();
    const last = lastAttackTimestampRef.current;
    if (last && now - last < FIGHT_BUTTON_COOLDOWN_MS) {
      return;
    }

    // Energy check
    if ((currentUser.energy ?? 0) < BATTLE_ATTACK_ENERGY_COST) {
      return;
    }

    // Ref-based guard to prevent double execution (state updates are async)
    if (pendingAttacksRef.current > 0) {
      return;
    }

    // Set loading state
    lastAttackTimestampRef.current = now;
    pendingAttacksRef.current = 1;
    setFightButtonLoading(true);
    setActionLoading(true);

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // ========================================
      // FETCH FROM BACKEND - Single source of truth
      // ========================================
      const adrenalineBonus = userSide === "defender" ? adrenalineState.bonusRage : 0;

      const res = await fetch("/api/battle/attack", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          battleId: battle.id,
          adrenalineBonus,
        }),
        signal: abortController.signal,
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(payload.error || "Attack failed", { duration: 2000 });
        return;
      }

      // ========================================
      // SUCCESS: Apply backend response (single update)
      // ========================================
      const result = payload.result;
      const actualDamage = payload.damage ?? 0;

      // Update battle state from backend
      if (
        typeof payload.current_defense === "number" &&
        typeof payload.attacker_score === "number" &&
        typeof payload.defender_score === "number"
      ) {
        setBattle((prev) =>
          prev
            ? {
                ...prev,
                current_defense: payload.current_defense,
                attacker_score: payload.attacker_score,
                defender_score: payload.defender_score,
              }
            : prev
        );
      }

      // Update energy from backend
      if (typeof payload.energy === "number") {
        setCurrentUser((prev) => (prev ? { ...prev, energy: payload.energy } : null));
        setEnergy(payload.energy);
      }

      // Update rage and focus from backend
      if (typeof payload.rage === "number") {
        const rageIncrease = payload.rage - previousRageRef.current;
        if (rageIncrease > 0) {
          spawnFloatingRage(rageIncrease);
        }
        previousRageRef.current = payload.rage;
        setUserRage(payload.rage);
      }
      if (typeof payload.focus === "number") setUserFocus(payload.focus);

      // Show visual feedback based on actual result
      triggerHeroBump(userSide, HERO_BUMP_DURATION);
      triggerScoreBump(SCORE_BUMP_DURATION);
      spawnFloatingHit(userSide, actualDamage, result);

      // Track hero damage with actual result
      if (result === "HIT" || result === "CRITICAL") {
        const battleLog: BattleLog = {
          id: `${Date.now()}`,
          user: currentUser.username || "You",
          user_avatar: currentUser.avatar_url,
          damage: actualDamage,
          side: userSide,
          actor_id: currentUser.id,
          result,
        };
        ingestHeroLog(battleLog);
        updateHeroLeaders();
      }

      // Show combat result
      if (result) {
        setLastCombatResult({
          result: result,
          damage: actualDamage,
        });
        setTimeout(() => setLastCombatResult(null), 2000);
      }

      // Warn about disarray
      if (payload.disarrayMultiplier > 1.5) {
        toast.warning(`⚠️ Disarray: ${payload.disarrayMultiplier.toFixed(1)}x energy cost`, {
          duration: 2000,
        });
      }

      // ========================================
      // ASYNC TASKS - Non-blocking (only if hit)
      // ========================================
      if (result === "HIT" || result === "CRITICAL") {
        Promise.all([
          recordBattleParticipation(currentUser.id, battle.id, userSide, actualDamage)
            .then((result) => {
              if (result.success && result.stats) {
                setCurrentUser((prev) =>
                  prev
                    ? {
                        ...prev,
                        total_damage_dealt: result.stats!.total_damage_dealt,
                        highest_damage_battle: result.stats!.highest_damage_battle,
                        battles_fought: result.stats!.battles_fought,
                        current_military_rank: result.stats!.current_military_rank,
                        military_rank_score: result.stats!.military_rank_score,
                      }
                    : prev
                );
              }
            })
            .catch((err) => console.error("Battle participation error:", err)),

          awardXp(currentUser.id, "battle", { battle_id: battle.id, damage: actualDamage })
            .then((xpResult) => {
              if (xpResult.success && xpResult.levelUps > 0) {
                showLevelUpToast({
                  level: xpResult.newLevel,
                  levelUps: xpResult.levelUps,
                  totalXp: xpResult.newTotalXp,
                });
              }
            })
            .catch((err) => console.error("XP award error:", err)),
        ]);
      }
    } catch (err) {
      // If request was aborted (superseded by newer request), silently ignore
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // Network error
      toast.error("Network error - please try again", { duration: 2000 });
    } finally {
      // Clear abort controller
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      // Reset loading states
      pendingAttacksRef.current = 0;
      setActionLoading(false);
      setFightButtonLoading(false);
    }
  }, [battle, isFinished, currentUser, userSide, setEnergy, adrenalineState.bonusRage]);

  // Wrapper to prevent double-clicks at the UI level by checking ref synchronously
  const handleFightClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent double execution at the click level by checking ref immediately
    if (pendingAttacksRef.current > 0) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    await handleFight();
  }, [handleFight]);

  // Note: spawnFloatingHit and scheduleLogRemoval are now provided by useBattleAnimations hook

  useEffect(() => {
    return () => {
      cleanupTimers(); // Cleanup toast timers from useBattleAnimations hook
      if (fightButtonLoadingTimerRef.current) clearTimeout(fightButtonLoadingTimerRef.current);
    };
  }, [cleanupTimers]);

  useEffect(() => {
    lastAttackTimestampRef.current = null;
  }, [battle?.id]);

  // normalizeBattleLog is imported from @/lib/battle/utils


  const handleZapBomb = () => {
    if (actionLoading) return;
    setIsBombing(true);
    setTimeout(() => setIsBombing(false), 600);
  };

  const handleTaunt = useCallback(async () => {
    if (!battle || !currentUser) return;

    // Check rate limit (3 per minute)
    const now = Date.now();
    if (now > tauntCountRef.current.resetTime) {
      // Reset counter
      tauntCountRef.current = { count: 0, resetTime: now + 60000 };
    }

    if (tauntCountRef.current.count >= 3) {
      toast.error("Too many taunts! Wait a moment...", { duration: 2000 });
      return;
    }

    tauntCountRef.current.count += 1;

    try {
      const res = await fetch("/api/battle/taunt", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ battleId: battle.id }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to send taunt" }));
        toast.error(error.error || "Failed to send taunt", { duration: 2000 });
      }
    } catch (err) {
      console.error("Taunt error:", err);
      toast.error("Failed to send taunt", { duration: 2000 });
    }
  }, [battle, currentUser]);

  // ========================================
  // HOOKS - Must be called before any early returns
  // ========================================

  // Memoize expensive battle calculations to prevent re-computation on every render
  const battleStats = useMemo(() => {
    if (!battle) return null;
    return calculateBattleStats(battle);
  }, [battle]);

  // Memoize user-specific UI calculations
  const userUI = useMemo(() => {
    const damageBarGradient = userSide
      ? userSide === "attacker"
        ? "from-red-700 via-red-500 to-red-400"
        : "from-emerald-700 via-emerald-500 to-emerald-300"
      : "from-slate-700 via-slate-500 to-slate-300";

    return { damageBarGradient };
  }, [userSide]);

  // Memoize rank progress calculations
  const rankUI = useMemo(() => {
    const rankProgress = getProgressToNextRank(currentUser?.military_rank_score ?? 0);
    const rankRange = rankProgress.nextRank ? rankProgress.nextRank.minScore - rankProgress.currentRank.minScore : 0;
    const rankProgressLabel = rankProgress.nextRank
      ? `${rankProgress.currentProgress.toLocaleString()} / ${rankRange.toLocaleString()}`
      : "MAX";
    const nextRankLabel = rankProgress.nextRank ? rankProgress.nextRank.rank : "Max";

    return { rankProgress, rankProgressLabel, nextRankLabel };
  }, [currentUser?.military_rank_score]);

  // ========================================
  // EARLY RETURNS - After all hooks
  // ========================================

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!battle || !battleStats) {
    return <div className="flex h-screen items-center justify-center">Battle not found</div>;
  }

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex flex-col items-center p-4 md:p-8 font-sans">
      <div className="w-full max-w-6xl flex flex-col gap-4">
        {/* Top Header - Communities and Timer Row */}
        <div className="relative flex items-center justify-center w-full">
          {/* Defender Side - Desktop */}
          <div className="hidden md:flex absolute left-0 items-center gap-3 z-10">
            <Avatar className="h-10 w-10 !rounded-lg border border-border/40 shadow-sm">
              <AvatarImage src={defenderComm?.logo_url} alt={defenderComm?.name} />
              <AvatarFallback>DEF</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className={cn("text-[10px] uppercase font-bold", BATTLE_THEME.sides.defender.colors.text)}>Defender</span>
              <span className="font-bold whitespace-nowrap">{defenderComm?.name || "Defenders"}</span>
            </div>
          </div>

          {/* Defender Side - Mobile (avatar only) */}
          <div className="md:hidden absolute left-0 flex items-center gap-2 z-10">
            <Avatar className="h-8 w-8 !rounded-lg border border-border/40 shadow-sm">
              <AvatarImage src={defenderComm?.logo_url} alt={defenderComm?.name} />
              <AvatarFallback>D</AvatarFallback>
            </Avatar>
          </div>

          {/* Center: Region and Timer - Perfectly centered */}
          <div className="flex flex-col items-center justify-center gap-0.5">
            {isFinished ? (
              <div className="px-4 py-1 bg-muted/50 rounded-lg text-xs font-bold uppercase whitespace-nowrap">
                {finalStatusText || "Battle Ended"}
              </div>
            ) : (
              <>
                <div className="text-xs font-bold uppercase tracking-wider text-foreground/70 hidden md:block">
                  {regionLabel || `#${battle?.target_hex_id}` || "Battle"}
                </div>
                <div className={cn("text-3xl font-bold tabular-nums font-pixelated tracking-tight md:text-3xl text-2xl", isTimerCritical ? "text-red-500" : "text-foreground")}>
                  {timeLeft}
                </div>
              </>
            )}
          </div>

          {/* Attacker Side - Desktop */}
          <div className="hidden md:flex absolute right-0 items-center gap-3 justify-end z-10">
            <div className="flex flex-col text-right">
              <span className={cn("text-[10px] uppercase font-bold", BATTLE_THEME.sides.attacker.colors.text)}>Attacker</span>
              <span className="font-bold whitespace-nowrap">{attackerComm?.name || "Attackers"}</span>
            </div>
            <Avatar className="h-10 w-10 !rounded-lg border border-border/40 shadow-sm">
              <AvatarImage src={attackerComm?.logo_url} alt={attackerComm?.name} />
              <AvatarFallback>ATK</AvatarFallback>
            </Avatar>
          </div>

          {/* Attacker Side - Mobile (avatar only) */}
          <div className="md:hidden absolute right-0 flex items-center gap-2 justify-end z-10">
            <Avatar className="h-8 w-8 !rounded-lg border border-border/40 shadow-sm">
              <AvatarImage src={attackerComm?.logo_url} alt={attackerComm?.name} />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="w-full h-px bg-border mt-2 mb-1" />

        {/* Heroes */}
        <BattleHeroes
          attackerHero={attackerHero}
          defenderHero={defenderHero}
          attackerBump={heroAtkBump}
          defenderBump={heroDefBump}
          onInfoClick={() => setShowBattleInfo(true)}
        />

        {/* Wall */}
        <div className="flex-1 min-h-[400px] relative flex items-center justify-center" style={WALL_CONTAINER_STYLE}>
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WALL_IMG_URL} alt="Wall" className="block relative z-10" />
            
            <div className="absolute inset-0 z-20 pointer-events-none" style={{ maskImage: `url(${WALL_IMG_URL})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskImage: `url(${WALL_IMG_URL})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }}>
                <div className={cn("absolute bottom-0 left-0 right-0 transition-all duration-300", BATTLE_THEME.ui.wall.defenseBar.emerald)} style={{ height: `${battleStats.greenHeightPct}%`, bottom: "50%" }} />
                <div className={cn("absolute top-0 left-0 right-0 transition-all duration-300", BATTLE_THEME.ui.wall.defenseBar.red)} style={{ height: `${battleStats.redHeightPct}%`, top: "50%" }} />
            </div>

            <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-30"><span className={cn("px-3 py-0.5 rounded-full text-white text-[10px] uppercase font-bold", BATTLE_THEME.ui.wall.securedLabel)}>Secured</span></div>
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-30"><span className={cn("px-3 py-0.5 rounded-full text-white text-[10px] uppercase font-bold", BATTLE_THEME.ui.wall.conqueredLabel)}>Conquered</span></div>

            <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-0.5 bg-white/10 z-30 flex items-center justify-center">
              <div className={cn("px-6 py-2 rounded-2xl border border-white/10 bg-black/10 backdrop-blur-md transition-all", scoreBump ? "scale-110" : "scale-100")}>
                <span className={cn("text-4xl md:text-5xl font-black tabular-nums tracking-tighter", battleStats.scoreColorClass)}>{battleStats.scoreText}</span>
              </div>
            </div>

            {floatingHits.map((hit) => (
              <FloatingDamage
                key={hit.id}
                id={hit.id}
                side={hit.side}
                damage={hit.damage}
                result={hit.result}
                theme={{
                  attackerText: BATTLE_THEME.ui.floatingHit.attackerText,
                  defenderText: BATTLE_THEME.ui.floatingHit.defenderText,
                  shadow: BATTLE_THEME.ui.floatingHit.shadow,
                }}
              />
            ))}

            {floatingTaunts.map((taunt) => (
              <FloatingTaunt
                key={taunt.id}
                id={taunt.id}
                username={taunt.username}
                avatarUrl={taunt.avatar_url}
                position={taunt.position}
                onComplete={() => {
                  removeFloatingTaunt(taunt.id);
                }}
              />
            ))}

            {floatingRageAnims.map((rage) => (
              <FloatingRage
                key={rage.id}
                id={rage.id}
                rageGain={rage.rageGain}
              />
            ))}

            {/* Toasts - Desktop only - Using old BattleToast temporarily */}
            <div className="hidden md:flex pointer-events-none absolute inset-y-0 right-full mr-4 flex-col justify-end items-end gap-2 w-60 pt-12">
                {defenderLogs.map((log) => {
                  const BattleToast = require("@/components/battle/battle-toast").BattleToast;
                  return (
                    <BattleToast
                      key={log.id}
                      type="defender"
                      username={log.user}
                      avatarUrl={log.user_avatar}
                      damage={log.damage}
                      result={log.result || "HIT"}
                      theme={{
                        bg: BATTLE_THEME.ui.logs.defenderBg,
                        shadow: BATTLE_THEME.ui.logs.shadow,
                        textColor: "text-white",
                        textLighter: BATTLE_THEME.sides.defender.colors.textLighter,
                      }}
                    />
                  );
                })}
            </div>
            <div className="hidden md:flex pointer-events-none absolute inset-y-0 left-full ml-4 flex-col justify-start items-start gap-2 w-60 pt-12">
                {attackerLogs.map((log) => {
                  const BattleToast = require("@/components/battle/battle-toast").BattleToast;
                  return (
                    <BattleToast
                      key={log.id}
                      type="attacker"
                      username={log.user}
                      avatarUrl={log.user_avatar}
                      damage={log.damage}
                      result={log.result || "HIT"}
                      theme={{
                        bg: BATTLE_THEME.ui.logs.attackerBg,
                        shadow: BATTLE_THEME.ui.logs.shadow,
                        textColor: "text-white",
                        textLighter: BATTLE_THEME.sides.attacker.colors.textLighter,
                      }}
                    />
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {isBombing && (
        <div className={cn("fixed inset-0 z-[60] flex items-center justify-center", BATTLE_THEME.ui.bomb.bg)}>
          <div className={cn("h-64 w-64 rounded-full blur-3xl animate-ping", BATTLE_THEME.ui.bomb.effectBg)} />
        </div>
      )}

      <div className="fixed bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-full px-1">
        <div className="relative flex flex-col items-center gap-0.5 w-full">
          {userSide && currentUser && (
            <div className="pointer-events-auto absolute left-1/2 bottom-[calc(100%+5px)] -translate-x-1/2 z-40 w-full max-w-[min(400px,calc(100vw-16px))] md:max-w-[min(600px,calc(100vw-32px))]">
              {/* Adrenaline Bar (only for defenders when active) */}
              {userSide === "defender" && adrenalineConfig && (
                <div className="mb-2 relative">
                  <AdrenalineBar
                    bonusRage={adrenalineState.bonusRage}
                    percentElapsed={adrenalineState.percentElapsed}
                    isActive={adrenalineState.isInWindow && adrenalineState.conditionMet}
                    maxRage={adrenalineConfig.max_rage}
                  />

                  {/* Floating Adrenaline Rage Animations */}
                  {floatingAdrenalineRageAnims.map((anim) => (
                    <FloatingAdrenalineRage key={anim.id} id={anim.id} />
                  ))}
                </div>
              )}

              {/* Desktop: Horizontal layout [Rage] [Rank] [Focus] */}
              <div className="hidden md:flex items-center gap-2 w-full">
                {/* Rage Bar */}
                <StatBar
                  label="Rage"
                  value={userRage}
                  icon={Flame}
                  barColor="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500"
                  iconColor="text-amber-300"
                  className="flex-[0.7]"
                />

                {/* Rank Progress (Center) */}
                <StatBar
                  value={rankUI.rankProgress.progressPercent}
                  barColor={cn("bg-gradient-to-r", userUI.damageBarGradient)}
                  className="flex-[1.2]"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-[12px] font-black tracking-tight tabular-nums text-white">{rankUI.rankProgressLabel}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-white/70 min-w-0">
                      {rankUI.rankProgress.nextRank && rankUI.rankProgress.nextRank.imagePath && (
                        <img
                          src={rankUI.rankProgress.nextRank.imagePath}
                          alt={rankUI.nextRankLabel}
                          className="h-5 w-5 flex-shrink-0"
                          style={{
                            filter: "brightness(0) saturate(100%) invert(64%) sepia(89%) saturate(1395%) hue-rotate(1deg) brightness(101%) contrast(101%)",
                          }}
                        />
                      )}
                      <span className="truncate">{rankUI.nextRankLabel}</span>
                    </span>
                  </div>
                </StatBar>

                {/* Focus Bar */}
                <StatBar
                  label="Focus"
                  value={userFocus}
                  icon={Target}
                  barColor="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"
                  iconColor="text-blue-300"
                  className="flex-[0.7]"
                />
              </div>

              {/* Mobile: Stacked layout */}
              <div className="flex md:hidden flex-col gap-2 w-full">
                {/* Rage and Focus on same row */}
                <div className="flex items-center gap-2 w-full">
                  <StatBar
                    label="Rage"
                    value={userRage}
                    icon={Flame}
                    barColor="bg-gradient-to-r from-amber-600 via-orange-500 to-red-500"
                    iconColor="text-amber-300"
                    className="flex-1"
                  />
                  <StatBar
                    label="Focus"
                    value={userFocus}
                    icon={Target}
                    barColor="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400"
                    iconColor="text-blue-300"
                    className="flex-1"
                  />
                </div>

                {/* Rank Progress below */}
                <StatBar
                  value={rankUI.rankProgress.progressPercent}
                  barColor={cn("bg-gradient-to-r", userUI.damageBarGradient)}
                  className="w-full"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-[12px] font-black tracking-tight tabular-nums text-white">{rankUI.rankProgressLabel}</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-white/70 min-w-0">
                      {rankUI.rankProgress.nextRank && rankUI.rankProgress.nextRank.imagePath && (
                        <img
                          src={rankUI.rankProgress.nextRank.imagePath}
                          alt={rankUI.nextRankLabel}
                          className="h-5 w-5 flex-shrink-0"
                          style={{
                            filter: "brightness(0) saturate(100%) invert(64%) sepia(89%) saturate(1395%) hue-rotate(1deg) brightness(101%) contrast(101%)",
                          }}
                        />
                      )}
                      <span className="truncate">{rankUI.nextRankLabel}</span>
                    </span>
                  </div>
                </StatBar>
              </div>
            </div>
          )}

          {!userSide && !isFinished ? (
            <div className={cn("flex flex-col md:flex-row items-center gap-2 md:gap-4 px-2 py-2 rounded-xl backdrop-blur-xl w-full md:w-auto border border-white/20", BATTLE_THEME.ui.buttons.main.bg, BATTLE_THEME.ui.buttons.main.shadow)}>
              <Button onClick={() => setUserSide("defender")} className={cn("text-white text-sm md:text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-4 md:px-8 shadow-lg active:border-b-0 active:translate-y-1 transition-all flex-1 md:flex-none", BATTLE_THEME.ui.buttons.helpDefenders.bg, BATTLE_THEME.ui.buttons.helpDefenders.hover, BATTLE_THEME.ui.buttons.helpDefenders.border)}>
                Help Defenders
              </Button>
              <Button onClick={() => setUserSide("attacker")} className={cn("text-white text-sm md:text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-4 md:px-8 shadow-lg active:border-b-0 active:translate-y-1 transition-all flex-1 md:flex-none", BATTLE_THEME.ui.buttons.joinAttackers.bg, BATTLE_THEME.ui.buttons.joinAttackers.hover, BATTLE_THEME.ui.buttons.joinAttackers.border)}>
                Join Attackers
              </Button>
            </div>
          ) : (
            <div className={cn("flex flex-wrap items-center justify-center gap-2 px-2 py-2 rounded-xl backdrop-blur-xl w-full max-w-[min(400px,calc(100vw-16px))] md:max-w-[min(600px,calc(100vw-32px))] border border-white/20", BATTLE_THEME.ui.buttons.main.bg, BATTLE_THEME.ui.buttons.main.shadow)}>
              {/* Left side buttons */}
              <Button size="icon" disabled className={cn("rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl", BATTLE_THEME.ui.buttons.bomb.bg, BATTLE_THEME.ui.buttons.bomb.border, BATTLE_THEME.ui.buttons.bomb.disabled)}>
                💣
                <span className={cn("absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none", BATTLE_THEME.ui.buttons.comingSoonTooltip.bg, BATTLE_THEME.ui.buttons.comingSoonTooltip.text, BATTLE_THEME.ui.buttons.comingSoonTooltip.size, BATTLE_THEME.ui.buttons.comingSoonTooltip.padding, BATTLE_THEME.ui.buttons.comingSoonTooltip.rounded)}>Coming Soon</span>
              </Button>
              <Button size="icon" disabled className={cn("rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl", BATTLE_THEME.ui.buttons.food.bg, BATTLE_THEME.ui.buttons.food.border, BATTLE_THEME.ui.buttons.food.disabled)}>
                🍖
                <span className={cn("absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none", BATTLE_THEME.ui.buttons.comingSoonTooltip.bg, BATTLE_THEME.ui.buttons.comingSoonTooltip.text, BATTLE_THEME.ui.buttons.comingSoonTooltip.size, BATTLE_THEME.ui.buttons.comingSoonTooltip.padding, BATTLE_THEME.ui.buttons.comingSoonTooltip.rounded)}>Coming Soon</span>
              </Button>

	              {/* Center FIGHT button - wider with more spacing */}
	              <div className="mx-2 md:mx-4">
	                <Button
	                  onClick={handleFightClick}
	                  disabled={fightButtonLoading || isFinished || (currentUser?.energy ?? 0) < BATTLE_ATTACK_ENERGY_COST}
	                  className={cn("relative overflow-visible text-lg font-black uppercase tracking-widest h-12 md:h-16 rounded-2xl px-8 md:px-12 md:min-w-[180px] active:border-b-0 active:translate-y-1 transition-all min-w-fit border border-b-4 border-amber-900/60 shadow-lg shadow-amber-900/30", BATTLE_THEME.ui.buttons.fight.bg, BATTLE_THEME.ui.buttons.fight.text, BATTLE_THEME.ui.buttons.fight.hover)}
	                >
	                  {fightButtonLoading ? <Loader2 className="animate-spin h-5 md:h-8 w-5 md:w-8" /> : "FIGHT"}
	                </Button>
	              </div>

              {/* Right side buttons - potion and taunt */}
              <Button size="icon" disabled className={cn("rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl", BATTLE_THEME.ui.buttons.potion1.bg, BATTLE_THEME.ui.buttons.potion1.border, BATTLE_THEME.ui.buttons.potion1.disabled)}>
                💧
                <span className={cn("absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none", BATTLE_THEME.ui.buttons.comingSoonTooltip.bg, BATTLE_THEME.ui.buttons.comingSoonTooltip.text, BATTLE_THEME.ui.buttons.comingSoonTooltip.size, BATTLE_THEME.ui.buttons.comingSoonTooltip.padding, BATTLE_THEME.ui.buttons.comingSoonTooltip.rounded)}>Coming Soon</span>
              </Button>
              <Button size="icon" onClick={handleTaunt} className={cn("rounded-2xl h-12 w-12 md:h-16 md:w-16 flex-shrink-0 relative group text-2xl md:text-3xl active:border-b-0 active:translate-y-1 transition-all", BATTLE_THEME.ui.buttons.potion2.bg, BATTLE_THEME.ui.buttons.potion2.border)}>
                🖕
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Battle Info Modal */}
      <BattleInfoModal
        isOpen={showBattleInfo}
        onClose={() => setShowBattleInfo(false)}
        attackerHeroes={getTop10BySide("attacker")}
        defenderHeroes={getTop10BySide("defender")}
        attackerCommunity={attackerComm}
        defenderCommunity={defenderComm}
        battleId={battle.id}
        getUserAvatar={getUserAvatar}
      />

      {/* Medal Achievement Modal */}
    </div>
  );
}

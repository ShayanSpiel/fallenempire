/**
 * useBattleHeroes Hook
 * Manages hero tracking and leaderboards for battles
 */

import { useRef, useCallback } from "react";
import type { BattleLog, HeroState, HeroTotalsRecord, HeroTotalsEntry } from "../types";

export function useBattleHeroes() {
  const heroTotalsRef = useRef<HeroTotalsRecord>({});
  const processedLogIdsRef = useRef<Set<string>>(new Set());

  const shouldProcessLog = useCallback((log: BattleLog) => {
    const logId = log.id?.toString();
    if (!logId) return true;

    if (processedLogIdsRef.current.has(logId)) return false;
    processedLogIdsRef.current.add(logId);

    return true;
  }, []);

  const accumulateHeroDamage = useCallback((log: BattleLog) => {
    const actorKey = log.actor_id ?? log.user;
    const key = `${log.side}:${actorKey}`;
    const existing = heroTotalsRef.current[key] as HeroTotalsEntry | undefined;

    heroTotalsRef.current[key] = {
      name: log.user,
      avatar: log.user_avatar ?? existing?.avatar,
      side: log.side,
      actorId: log.actor_id ?? existing?.actorId ?? null,
      damage: (existing?.damage ?? 0) + Math.abs(log.damage),
    };
  }, []);

  const getHeroLeaders = useCallback(() => {
    let attacker: HeroTotalsEntry | null = null;
    let defender: HeroTotalsEntry | null = null;

    Object.values(heroTotalsRef.current).forEach((hero) => {
      if (!hero) return;
      const heroEntry = hero as HeroTotalsEntry;
      if (heroEntry.side === "attacker") {
        if (!attacker || heroEntry.damage > attacker.damage) attacker = heroEntry;
      } else {
        if (!defender || heroEntry.damage > defender.damage) defender = heroEntry;
      }
    });

    const attackerData = attacker as HeroTotalsEntry | null;
    const defenderData = defender as HeroTotalsEntry | null;

    return {
      attacker: attackerData ? {
        name: attackerData.name,
        avatar: attackerData.avatar,
        damage: attackerData.damage,
      } : null,
      defender: defenderData ? {
        name: defenderData.name,
        avatar: defenderData.avatar,
        damage: defenderData.damage,
      } : null,
    };
  }, []);

  const ingestHeroLog = useCallback((log: BattleLog) => {
    if (!shouldProcessLog(log)) return;
    accumulateHeroDamage(log);
  }, [shouldProcessLog, accumulateHeroDamage]);

  const resetHeroTracking = useCallback(() => {
    heroTotalsRef.current = {};
    processedLogIdsRef.current.clear();
  }, []);

  const getTop10BySide = useCallback((side: "attacker" | "defender") => {
    const heroValues = Object.values(heroTotalsRef.current).filter(
      (hero): hero is HeroTotalsEntry => hero !== undefined && hero.side === side
    );
    return heroValues.sort((a, b) => b.damage - a.damage).slice(0, 10);
  }, []);

  return {
    ingestHeroLog,
    getHeroLeaders,
    resetHeroTracking,
    getTop10BySide,
    heroTotalsRef,
  };
}

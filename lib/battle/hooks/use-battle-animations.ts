/**
 * useBattleAnimations Hook
 * Manages all battle animations (floating hits, taunts, rage, etc.)
 */

import { useState, useCallback, useRef } from "react";
import type {
  FloatingHit,
  FloatingTaunt,
  FloatingRageAnim,
  FloatingAdrenalineRageAnim,
  BattleLog,
} from "../types";
import { FLOATING_HIT_DURATION, LOG_TOAST_DURATION } from "../constants";

export function useBattleAnimations() {
  const [floatingHits, setFloatingHits] = useState<FloatingHit[]>([]);
  const [floatingTaunts, setFloatingTaunts] = useState<FloatingTaunt[]>([]);
  const [floatingRageAnims, setFloatingRageAnims] = useState<FloatingRageAnim[]>([]);
  const [floatingAdrenalineRageAnims, setFloatingAdrenalineRageAnims] = useState<FloatingAdrenalineRageAnim[]>([]);

  const [heroAtkBump, setHeroAtkBump] = useState(false);
  const [heroDefBump, setHeroDefBump] = useState(false);
  const [scoreBump, setScoreBump] = useState(false);

  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const spawnFloatingHit = useCallback((
    side: "attacker" | "defender",
    damage: number,
    result: "HIT" | "MISS" | "CRITICAL" = "HIT"
  ) => {
    const hit: FloatingHit = {
      id: Date.now() + Math.random(),
      side,
      damage,
      result,
    };
    setFloatingHits((prev) => [...prev, hit]);
    setTimeout(() => {
      setFloatingHits((prev) => prev.filter((h) => h.id !== hit.id));
    }, FLOATING_HIT_DURATION);
  }, []);

  const spawnFloatingTaunt = useCallback((taunt: FloatingTaunt) => {
    setFloatingTaunts((prev) => [...prev, taunt]);
  }, []);

  const removeFloatingTaunt = useCallback((id: string) => {
    setFloatingTaunts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const spawnFloatingRage = useCallback((rageGain: number) => {
    const rageId = Date.now();
    setFloatingRageAnims((prev) => [...prev, { id: rageId, rageGain }]);
    setTimeout(() => {
      setFloatingRageAnims((prev) => prev.filter((r) => r.id !== rageId));
    }, 600);
  }, []);

  const spawnFloatingAdrenalineRage = useCallback(() => {
    const animId = Date.now();
    setFloatingAdrenalineRageAnims((prev) => [...prev, { id: animId }]);
    setTimeout(() => {
      setFloatingAdrenalineRageAnims((prev) => prev.filter((a) => a.id !== animId));
    }, 1000);
  }, []);

  const triggerHeroBump = useCallback((side: "attacker" | "defender", duration: number = 220) => {
    if (side === "attacker") {
      setHeroAtkBump(true);
      setTimeout(() => setHeroAtkBump(false), duration);
    } else {
      setHeroDefBump(true);
      setTimeout(() => setHeroDefBump(false), duration);
    }
  }, []);

  const triggerScoreBump = useCallback((duration: number = 150) => {
    setScoreBump(true);
    setTimeout(() => setScoreBump(false), duration);
  }, []);

  const scheduleLogRemoval = useCallback(
    (setter: React.Dispatch<React.SetStateAction<BattleLog[]>>, logId: string) => {
      if (toastTimersRef.current[logId]) {
        clearTimeout(toastTimersRef.current[logId]);
      }
      const timer = setTimeout(() => {
        setter((prev) => prev.filter((log) => log.id !== logId));
        delete toastTimersRef.current[logId];
      }, LOG_TOAST_DURATION);
      toastTimersRef.current[logId] = timer;
    },
    []
  );

  const cleanupTimers = useCallback(() => {
    Object.values(toastTimersRef.current).forEach((timer) => clearTimeout(timer));
    toastTimersRef.current = {};
  }, []);

  return {
    // Floating animations
    floatingHits,
    floatingTaunts,
    floatingRageAnims,
    floatingAdrenalineRageAnims,

    // Bump animations
    heroAtkBump,
    heroDefBump,
    scoreBump,

    // Spawn functions
    spawnFloatingHit,
    spawnFloatingTaunt,
    removeFloatingTaunt,
    spawnFloatingRage,
    spawnFloatingAdrenalineRage,
    triggerHeroBump,
    triggerScoreBump,

    // Utilities
    scheduleLogRemoval,
    cleanupTimers,
  };
}

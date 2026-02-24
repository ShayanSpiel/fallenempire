/**
 * useBattleTimer Hook
 * Manages battle countdown timer and critical state
 */

import { useState, useEffect } from "react";
import type { BattleState } from "../types";
import { TIMER_UPDATE_INTERVAL, CRITICAL_THRESHOLD_MS } from "../constants";

export function useBattleTimer(battle: BattleState | null) {
  const [timeLeft, setTimeLeft] = useState("00:00:00");
  const [isTimerCritical, setIsTimerCritical] = useState(false);

  useEffect(() => {
    if (!battle || battle.status !== "active") {
      setTimeLeft("00:00:00");
      setIsTimerCritical(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const end = new Date(battle.ends_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setIsTimerCritical(false);
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
      setIsTimerCritical(diff <= CRITICAL_THRESHOLD_MS);
    }, TIMER_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [battle]);

  return { timeLeft, isTimerCritical };
}

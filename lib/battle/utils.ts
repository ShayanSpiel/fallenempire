/**
 * Battle System Utilities
 * Helper functions for battle logic
 */

import { resolveAvatar } from "@/lib/avatar";
import { getScoreTextColor } from "@/lib/battle-theme";
import type {
  BattleStatus,
  RawBattleLogEntry,
  BattleLog,
  BattleState,
  BattleStats,
  BattleResultType,
} from "./types";
import {
  ATTACKER_VICTORY_STATUSES,
  DEFENDER_VICTORY_STATUSES,
} from "./constants";

const DEFAULT_AVATAR_URL = resolveAvatar({ seed: "avatar" })!;

/**
 * Get user avatar URL with fallback
 */
export function getUserAvatar(name: string, realUrl?: string | null): string {
  return resolveAvatar({ avatarUrl: realUrl, seed: name }) ?? DEFAULT_AVATAR_URL;
}

/**
 * Check if battle status is attacker victory
 */
export function isAttackerVictory(status: BattleStatus): boolean {
  return (ATTACKER_VICTORY_STATUSES as readonly BattleStatus[]).includes(status);
}

/**
 * Check if battle status is defender victory
 */
export function isDefenderVictory(status: BattleStatus): boolean {
  return (DEFENDER_VICTORY_STATUSES as readonly BattleStatus[]).includes(status);
}

/**
 * Normalize battle log entry from various database formats
 */
export function normalizeBattleLog(entry: RawBattleLogEntry): BattleLog {
  const username = entry.actor_username ?? entry.username ?? entry.user ?? "Unknown";
  const avatar = entry.actor_avatar_url ?? entry.avatar_url ?? entry.user_avatar ?? null;
  const rawDamage = entry.damage_amount ?? entry.damage ?? 0;
  const damage = Math.abs(Number(rawDamage) || 0);
  const side = entry.side === "defender" ? "defender" : "attacker";
  const actorId = entry.actor_id ?? entry.user_id ?? entry.actorId ?? entry.userId ?? null;
  const result = (entry as any).result as BattleResultType | undefined;

  const fallbackKey =
    entry.user ??
    entry.username ??
    entry.actor_username ??
    entry.actorId ??
    entry.userId ??
    "battle-log";
  const fallbackId = `${fallbackKey}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const logId = entry.id ?? fallbackId;

  return {
    id: logId,
    user: username,
    user_avatar: avatar,
    damage,
    side,
    actor_id: actorId,
    result: result || "HIT",
  };
}

/**
 * Calculate battle statistics for UI display
 */
export function calculateBattleStats(battle: BattleState): BattleStats {
  const hasScoreTotals =
    typeof battle.attacker_score === "number" &&
    typeof battle.defender_score === "number";

  const netDamageRaw = hasScoreTotals
    ? (battle.attacker_score ?? 0) - (battle.defender_score ?? 0)
    : battle.initial_defense - battle.current_defense;

  const wallScore = Math.max(0, Math.round(netDamageRaw));
  const wallRemainingSigned = Math.round(battle.initial_defense - netDamageRaw);
  const scoreText = wallRemainingSigned.toLocaleString();
  const isNegative = wallRemainingSigned <= 0;
  const scoreColorClass = getScoreTextColor(isNegative);

  const WALL_SCALE = 100000;
  const visualPct = Math.min(50, (Math.abs(wallScore) / WALL_SCALE) * 50);
  const greenHeightPct = !isNegative ? visualPct : 0;
  const redHeightPct = isNegative ? visualPct : 0;

  return {
    hasScoreTotals,
    netDamageRaw,
    wallScore,
    wallRemainingSigned,
    scoreText,
    isNegative,
    scoreColorClass,
    greenHeightPct,
    redHeightPct,
  };
}

/**
 * Battle System Types
 * Centralized type definitions for the battle system
 */

export type BattleStatus =
  | "active"
  | "attacker_win"
  | "defender_win"
  | "attacker_won"
  | "defender_won";

export type BattleSide = "attacker" | "defender" | null;

export type BattleResultType = "HIT" | "MISS" | "CRITICAL";

export type UserRole = "standard" | "ally" | "observer";

export interface BattleState {
  id: string;
  target_hex_id: string;
  attacker_community_id: string;
  defender_community_id: string | null;
  current_defense: number;
  initial_defense: number;
  started_at?: string;
  ends_at: string;
  status: BattleStatus;
  attacker_score?: number;
  defender_score?: number;
}

export interface CommunityInfo {
  id: string;
  name: string;
  logo_url?: string;
  color?: string;
}

export interface UserStats {
  id: string;
  username: string;
  avatar_url?: string | null;
  community_id: string | null;
  strength: number;
  energy: number;
  current_military_rank?: string;
  military_rank_score?: bigint | number;
  total_damage_dealt?: bigint | number;
  battles_fought?: number;
  battles_won?: number;
  highest_damage_battle?: number;
  authId?: string | null;
}

export interface BattleLog {
  id: string;
  user: string;
  user_avatar?: string | null;
  damage: number;
  side: "attacker" | "defender";
  actor_id?: string | null;
  result?: BattleResultType;
}

export interface RawBattleLogEntry {
  id?: string;
  actor_username?: string;
  username?: string;
  user?: string;
  actor_avatar_url?: string;
  avatar_url?: string;
  user_avatar?: string | null;
  damage_amount?: number;
  damage?: number;
  side?: string;
  actor_id?: string | null;
  user_id?: string | null;
  actorId?: string | null;
  userId?: string | null;
  result?: BattleResultType;
}

export interface FloatingHit {
  id: number;
  side: "attacker" | "defender";
  damage: number;
  result: BattleResultType;
}

export interface FloatingTaunt {
  id: string;
  username: string;
  avatar_url?: string | null;
  position: { x: number; y: number };
}

export interface FloatingRageAnim {
  id: number;
  rageGain: number;
}

export interface FloatingAdrenalineRageAnim {
  id: number;
}

export interface HeroState {
  name: string;
  avatar?: string | null;
}

export interface HeroTotalsEntry {
  name: string;
  avatar?: string | null;
  side: "attacker" | "defender";
  damage: number;
  actorId?: string | null;
}

export type HeroTotalsRecord = Record<string, HeroTotalsEntry | undefined>;

export interface BattleStats {
  hasScoreTotals: boolean;
  netDamageRaw: number;
  wallScore: number;
  wallRemainingSigned: number;
  scoreText: string;
  isNegative: boolean;
  scoreColorClass: string;
  greenHeightPct: number;
  redHeightPct: number;
}

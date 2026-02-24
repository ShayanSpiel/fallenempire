// Battle Mechanics System: TypeScript Types
// Version: 1.0
// Date: December 29, 2025

/**
 * Battle mechanics configuration interface
 * Maps to battle_mechanics_config table
 */
export interface BattleMechanicsConfig {
  id: string;
  community_id: string | null;

  // Focus System
  focus_enabled: boolean;
  focus_morale_ratio: number;

  // Rage System
  rage_enabled: boolean;
  rage_crit_multiplier: number;
  rage_max: number;
  rage_decay_per_hour: number;
  rage_morale_scaling_enabled: boolean;

  // Rage Event Triggers
  rage_trigger_hex_captured: number;
  rage_trigger_capital_captured: number;
  rage_trigger_ally_defeated: number;
  rage_trigger_battle_loss: number;
  rage_trigger_enemy_attacks: number;
  rage_trigger_dislike: number;

  // Momentum System
  momentum_enabled: boolean;
  momentum_morale_bonus: number;
  momentum_duration_hours: number;

  // Disarray System
  disarray_enabled: boolean;
  disarray_max_multiplier: number;
  disarray_duration_hours: number;

  // Exhaustion System
  exhaustion_enabled: boolean;
  exhaustion_conquest_threshold: number;
  exhaustion_energy_regen_multiplier: number;
  exhaustion_reset_hours: number;

  // Battle Timing
  battle_duration_hours: number;
  base_energy_cost: number;

  // Adrenaline System
  adrenaline_enabled: boolean;
  adrenaline_final_stand_window_percent: number;
  adrenaline_damage_threshold_ratio: number;
  adrenaline_rage_per_percent_time: number;
  adrenaline_max_rage: number;
  adrenaline_check_interval_seconds: number;

  created_at: string;
  updated_at: string;
}

/**
 * Community battle state interface
 * Maps to community_battle_state table
 */
export interface CommunityBattleState {
  id: string;
  community_id: string;

  // Disarray
  disarray_active: boolean;
  disarray_started_at: string | null;

  // Momentum
  momentum_active: boolean;
  momentum_expires_at: string | null;

  // Exhaustion
  exhaustion_active: boolean;
  exhaustion_started_at: string | null;
  last_conquest_at: string | null;
  conquest_timestamps: string[];

  // Statistics
  total_conquests: number;
  current_win_streak: number;

  updated_at: string;
}

/**
 * Rage event interface
 * Maps to rage_events table
 */
export interface RageEvent {
  id: string;
  user_id: string;
  rage_change: number;
  trigger_type: RageTriggerType;
  current_rage: number;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Rage trigger types
 */
export type RageTriggerType =
  | "hex_captured"
  | "capital_captured"
  | "ally_defeated"
  | "battle_loss"
  | "enemy_attacks"
  | "dislike";

/**
 * Battle action log interface
 * Maps to battle_action_log table
 */
export interface BattleActionLog {
  id: string;
  battle_id: string;
  user_id: string;
  action_type: string;

  // Combat resolution
  hit: boolean;
  critical: boolean;
  damage_dealt: number;

  // State at time of action
  user_morale: number;
  user_rage: number;
  user_energy: number;
  energy_cost: number;
  disarray_multiplier: number;

  created_at: string;
}

/**
 * Combat result types
 */
export type CombatResult = "HIT" | "CRITICAL" | "MISS";

/**
 * Combat action result interface
 */
export interface CombatActionResult {
  result: CombatResult;
  damage: number;
  energyCost: number;
  hit: boolean;
  critical: boolean;
  morale: number;
  rage: number;
  disarrayMultiplier: number;
}

/**
 * Battle mechanics state (complete view)
 */
export interface BattleMechanicsState {
  config: BattleMechanicsConfig;
  state: CommunityBattleState;
  disarray_multiplier: number;
  momentum_active: boolean;
  exhaustion_active: boolean;
}

/**
 * User battle stats
 */
export interface UserBattleStats {
  user_id: string;
  morale: number;
  rage: number;
  energy: number;
  focus: number; // Same as morale (1:1 ratio)
  disarray_multiplier: number;
  energy_cost_per_fight: number;
  energy_regen_rate: number;
  combat_stats: {
    total_actions: number;
    total_hits: number;
    total_misses: number;
    total_crits: number;
    hit_rate_pct: number;
    crit_rate_pct: number;
    total_damage: number;
  };
}

/**
 * Battle resolution result
 */
export interface BattleResolutionResult {
  outcome: "attacker_win" | "defender_win" | "ongoing";
  winner?: string;
  loser?: string;
  battle_id: string;
}

/**
 * Decay result (from cron)
 */
export interface RageDecayResult {
  users_updated: number;
  total_decay: number;
}

/**
 * State cleanup result (from cron)
 */
export interface StateCleanupResult {
  disarray_cleared: number;
  momentum_cleared: number;
  exhaustion_checked: number;
}

/**
 * Focus calculation input
 */
export interface FocusInput {
  morale: number;
  ratio?: number; // From config, defaults to 1.0
}

/**
 * Rage calculation input
 */
export interface RageInput {
  currentRage: number;
  triggerType: RageTriggerType;
  morale: number;
  config: BattleMechanicsConfig;
}

/**
 * Disarray calculation input
 */
export interface DisarrayInput {
  disarrayActive: boolean;
  disarrayStartedAt: string | null;
  maxMultiplier: number;
  durationHours: number;
}

/**
 * Exhaustion check input
 */
export interface ExhaustionInput {
  conquestTimestamps: string[];
  threshold: number;
  resetHours: number;
}

/**
 * Adrenaline configuration
 * Extracted from BattleMechanicsConfig for convenience
 */
export interface AdrenalineConfig {
  enabled: boolean;
  final_stand_window_percent: number;
  damage_threshold_ratio: number;
  rage_per_percent_time: number;
  max_rage: number;
  check_interval_seconds: number;
}

/**
 * Adrenaline state
 * Tracks real-time adrenaline bonus calculation
 */
export interface AdrenalineState {
  // Whether we're in the final stand window (last X% of battle)
  isInWindow: boolean;
  // Whether the damage difference condition is currently met
  conditionMet: boolean;
  // Cumulative milliseconds the condition has been met
  cumulativeTimeMs: number;
  // Current bonus rage (0 to max_rage)
  bonusRage: number;
  // Percent of final stand window elapsed (0-100)
  percentElapsed: number;
  // Current damage ratio (attacker/defender)
  damageRatio: number;
}

/**
 * Adrenaline calculation input
 */
export interface AdrenalineInput {
  battle: {
    started_at: string;
    ends_at: string;
    attacker_score: number;
    defender_score: number;
    status: string;
  };
  config: AdrenalineConfig;
  currentTimeMs?: number; // Optional, defaults to Date.now()
  previousState?: Pick<AdrenalineState, 'cumulativeTimeMs'>; // For incremental updates
}

/**
 * Default configuration
 */
export const DEFAULT_BATTLE_MECHANICS_CONFIG: Partial<BattleMechanicsConfig> = {
  // Focus
  focus_enabled: true,
  focus_morale_ratio: 1.0,

  // Rage
  rage_enabled: true,
  rage_crit_multiplier: 3.0,
  rage_max: 100,
  rage_decay_per_hour: 5,
  rage_morale_scaling_enabled: true,

  // Rage Triggers
  rage_trigger_hex_captured: 10,
  rage_trigger_capital_captured: 20,
  rage_trigger_ally_defeated: 15,
  rage_trigger_battle_loss: 10,
  rage_trigger_enemy_attacks: 5,
  rage_trigger_dislike: 0.5,

  // Momentum
  momentum_enabled: true,
  momentum_morale_bonus: 15,
  momentum_duration_hours: 12,

  // Disarray
  disarray_enabled: true,
  disarray_max_multiplier: 3.0,
  disarray_duration_hours: 12,

  // Exhaustion
  exhaustion_enabled: true,
  exhaustion_conquest_threshold: 2,
  exhaustion_energy_regen_multiplier: 0.5,
  exhaustion_reset_hours: 12,

  // Battle
  battle_duration_hours: 6,
  base_energy_cost: 10,

  // Adrenaline
  adrenaline_enabled: true,
  adrenaline_final_stand_window_percent: 33,
  adrenaline_damage_threshold_ratio: 2.0,
  adrenaline_rage_per_percent_time: 1,
  adrenaline_max_rage: 33,
  adrenaline_check_interval_seconds: 10,
};

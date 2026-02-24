/**
 * Battle Mechanics System
 * Implements Focus & Rage probability-based combat
 * Based on BATTLE_STRATEGY.md v1.0
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface BattleMechanicsConfig {
  // Focus System
  focus_enabled: boolean;
  focus_morale_ratio: number;

  // Rage System
  rage_enabled: boolean;
  rage_crit_multiplier: number;
  rage_max: number;
  rage_decay_per_hour: number;

  // Disarray System
  disarray_enabled: boolean;
  disarray_max_multiplier: number;
  disarray_duration_hours: number;

  // Momentum System
  momentum_enabled: boolean;
  momentum_morale_bonus: number;
  momentum_duration_hours: number;

  // Exhaustion System
  exhaustion_enabled: boolean;
  exhaustion_conquest_threshold: number;
  exhaustion_energy_regen_multiplier: number;

  // Battle Timing
  base_energy_cost: number;
}

const DEFAULT_CONFIG: BattleMechanicsConfig = {
  focus_enabled: true,
  focus_morale_ratio: 1.0,
  rage_enabled: true,
  rage_crit_multiplier: 3.0,
  rage_max: 100,
  rage_decay_per_hour: 5,
  disarray_enabled: true,
  disarray_max_multiplier: 3.0,
  disarray_duration_hours: 12,
  momentum_enabled: true,
  momentum_morale_bonus: 15,
  momentum_duration_hours: 12,
  exhaustion_enabled: true,
  exhaustion_conquest_threshold: 2,
  exhaustion_energy_regen_multiplier: 0.5,
  base_energy_cost: 10,
};

// In-memory cache for battle configs (5-minute TTL)
const configCache = new Map<string, { config: BattleMechanicsConfig; expiresAt: number }>();
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get battle mechanics configuration with caching
 * Falls back to global defaults if community-specific config doesn't exist
 */
export async function getBattleConfig(
  communityId?: string | null
): Promise<BattleMechanicsConfig> {
  const cacheKey = communityId || 'global';

  // Check cache first
  const cached = configCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.config;
  }
  try {
    const query = supabaseAdmin
      .from("battle_mechanics_config")
      .select("*")
      .limit(1);

    if (communityId) {
      query.or(`community_id.eq.${communityId},community_id.is.null`);
      query.order("community_id", { nullsFirst: false });
    } else {
      query.is("community_id", null);
    }

    const { data, error } = await query.single();

    let config: BattleMechanicsConfig;
    if (error || !data) {
      config = DEFAULT_CONFIG;
    } else {
      config = data as BattleMechanicsConfig;
    }

    // Cache the result
    configCache.set(cacheKey, {
      config,
      expiresAt: Date.now() + CONFIG_CACHE_TTL,
    });

    return config;
  } catch (err) {
    console.error("Error loading battle config:", err);
    return DEFAULT_CONFIG;
  }
}

/**
 * Clear config cache (useful for testing or when config changes)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Calculate Focus (accuracy) from morale
 * Focus = Morale (1:1 mapping)
 */
export function calculateFocus(morale: number, config: BattleMechanicsConfig): number {
  if (!config.focus_enabled) return 100; // Always hit if disabled
  return Math.max(0, Math.min(100, morale * config.focus_morale_ratio));
}

/**
 * Check if attack hits based on focus (accuracy)
 * Gate 1: Focus check
 */
export function checkFocusHit(focus: number): boolean {
  const roll = Math.random() * 100;
  return roll < focus;
}

/**
 * Check if hit is critical based on rage
 * Gate 2: Rage check (only called if hit landed)
 */
export function checkRageCritical(rage: number): boolean {
  const rawRage = Number(rage);
  if (!Number.isFinite(rawRage) || rawRage <= 0) return false;

  const normalizedRage = rawRage <= 1 ? rawRage * 100 : rawRage;
  const roll = Math.random() * 100;
  return roll < Math.min(100, normalizedRage);
}

/**
 * Calculate critical damage multiplier
 */
export function calculateCriticalDamage(
  baseDamage: number,
  config: BattleMechanicsConfig
): number {
  const rawMultiplier = Number(config.rage_crit_multiplier);
  const multiplier = rawMultiplier === 2 || rawMultiplier === 3 ? rawMultiplier : 3;
  return Math.floor(baseDamage * multiplier);
}

/**
 * Get disarray multiplier for energy cost
 * Returns 1.0 if no disarray, up to 3.0x if just lost
 * Decays linearly over 12 hours
 */
export async function getDisarrayMultiplier(communityId: string): Promise<number> {
  try {
    const config = await getBattleConfig(communityId);

    if (!config.disarray_enabled) return 1.0;

    const { data: state } = await supabaseAdmin
      .from("community_battle_state")
      .select("disarray_active, disarray_started_at")
      .eq("community_id", communityId)
      .maybeSingle();

    if (!state || !state.disarray_active || !state.disarray_started_at) {
      return 1.0;
    }

    const startTime = new Date(state.disarray_started_at).getTime();
    const now = Date.now();
    const hoursSince = (now - startTime) / (1000 * 60 * 60);

    // If past duration, clear disarray and return 1.0
    if (hoursSince >= config.disarray_duration_hours) {
      await supabaseAdmin
        .from("community_battle_state")
        .update({
          disarray_active: false,
          disarray_started_at: null,
        })
        .eq("community_id", communityId);
      return 1.0;
    }

    // Linear decay: 3.0 → 1.0 over 12 hours
    const multiplier =
      config.disarray_max_multiplier -
      (hoursSince / config.disarray_duration_hours) *
        (config.disarray_max_multiplier - 1.0);

    return Math.max(1.0, multiplier);
  } catch (err) {
    console.error("Error getting disarray multiplier:", err);
    return 1.0; // Safe default
  }
}

/**
 * Calculate energy cost with disarray multiplier
 */
export function calculateEnergyCost(
  baseCost: number,
  disarrayMultiplier: number
): number {
  return Math.ceil(baseCost * disarrayMultiplier);
}

/**
 * Apply disarray state to a community (after battle loss)
 */
export async function applyDisarray(communityId: string): Promise<void> {
  try {
    // Ensure community_battle_state exists
    const { data: existing } = await supabaseAdmin
      .from("community_battle_state")
      .select("id")
      .eq("community_id", communityId)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("community_battle_state").insert({
        community_id: communityId,
        disarray_active: true,
        disarray_started_at: new Date().toISOString(),
      });
    } else {
      await supabaseAdmin
        .from("community_battle_state")
        .update({
          disarray_active: true,
          disarray_started_at: new Date().toISOString(),
        })
        .eq("community_id", communityId);
    }
  } catch (err) {
    console.error("Error applying disarray:", err);
  }
}

/**
 * Apply momentum state to a community (after battle victory)
 */
export async function applyMomentum(communityId: string): Promise<void> {
  try {
    const config = await getBattleConfig(communityId);

    // Ensure community_battle_state exists
    const { data: existing } = await supabaseAdmin
      .from("community_battle_state")
      .select("id")
      .eq("community_id", communityId)
      .maybeSingle();

    const expiresAt = new Date(
      Date.now() + config.momentum_duration_hours * 60 * 60 * 1000
    ).toISOString();

    if (!existing) {
      await supabaseAdmin.from("community_battle_state").insert({
        community_id: communityId,
        momentum_active: true,
        momentum_expires_at: expiresAt,
      });
    } else {
      await supabaseAdmin
        .from("community_battle_state")
        .update({
          momentum_active: true,
          momentum_expires_at: expiresAt,
        })
        .eq("community_id", communityId);
    }

    // Apply +15 morale to all community members
    // This should be done via morale events system
    // For now, just set the state - morale will be updated separately
  } catch (err) {
    console.error("Error applying momentum:", err);
  }
}

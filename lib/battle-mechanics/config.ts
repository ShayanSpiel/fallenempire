// Battle Mechanics System: Configuration Loader
// Version: 1.0
// Date: December 29, 2025

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  BattleMechanicsConfig,
  DEFAULT_BATTLE_MECHANICS_CONFIG,
} from "./types";

/**
 * Get battle mechanics configuration for a community
 * Falls back to global defaults if no community-specific config exists
 *
 * @param communityId - Community ID (optional)
 * @returns Battle mechanics configuration
 */
export async function getBattleConfig(
  communityId?: string | null
): Promise<BattleMechanicsConfig> {
  const supabase = await createSupabaseServerClient();

  try {
    if (communityId) {
      const { data, error } = await supabase
        .from("battle_mechanics_config")
        .select("*")
        .or(`community_id.eq.${communityId},community_id.is.null`)
        .limit(2);

      if (error || !data || data.length === 0) {
        console.warn(
          `Failed to load battle config for community ${communityId}:`,
          error
        );
        return {
          id: "default",
          community_id: null,
          ...DEFAULT_BATTLE_MECHANICS_CONFIG,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as BattleMechanicsConfig;
      }

      const communityConfig = data.find((row) => row.community_id === communityId);
      const globalConfig = data.find((row) => row.community_id == null);
      return (communityConfig ?? globalConfig ?? data[0]) as BattleMechanicsConfig;
    } else {
      // Get global config
      const { data, error } = await supabase
        .from("battle_mechanics_config")
        .select("*")
        .is("community_id", null)
        .maybeSingle();

      if (error || !data) {
        console.warn(
          `Failed to load battle config for community ${communityId}:`,
          error
        );
        return {
          id: "default",
          community_id: null,
          ...DEFAULT_BATTLE_MECHANICS_CONFIG,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as BattleMechanicsConfig;
      }

      return data as BattleMechanicsConfig;
    }
  } catch (err) {
    console.error("Error loading battle config:", err);
    // Return defaults as fallback
    return {
      id: "default",
      community_id: null,
      ...DEFAULT_BATTLE_MECHANICS_CONFIG,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as BattleMechanicsConfig;
  }
}

/**
 * Update battle mechanics configuration for a community
 *
 * @param communityId - Community ID (null for global)
 * @param updates - Partial configuration updates
 * @returns Updated configuration
 */
export async function updateBattleConfig(
  communityId: string | null,
  updates: Partial<BattleMechanicsConfig>
): Promise<BattleMechanicsConfig | null> {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("battle_mechanics_config")
      .upsert(
        {
          community_id: communityId,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "community_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to update battle config:", error);
      return null;
    }

    return data as BattleMechanicsConfig;
  } catch (err) {
    console.error("Error updating battle config:", err);
    return null;
  }
}

/**
 * Get battle configuration value for a specific parameter
 * Useful for quick lookups without loading entire config
 *
 * @param communityId - Community ID (optional)
 * @param parameter - Configuration parameter name
 * @returns Parameter value
 */
export async function getBattleConfigParam<K extends keyof BattleMechanicsConfig>(
  communityId: string | null | undefined,
  parameter: K
): Promise<BattleMechanicsConfig[K]> {
  const config = await getBattleConfig(communityId);
  return config[parameter];
}

/**
 * Check if a battle mechanic is enabled for a community
 *
 * @param communityId - Community ID (optional)
 * @param mechanic - Mechanic name
 * @returns Whether mechanic is enabled
 */
export async function isMechanicEnabled(
  communityId: string | null | undefined,
  mechanic: "focus" | "rage" | "momentum" | "disarray" | "exhaustion"
): Promise<boolean> {
  const config = await getBattleConfig(communityId);

  switch (mechanic) {
    case "focus":
      return config.focus_enabled;
    case "rage":
      return config.rage_enabled;
    case "momentum":
      return config.momentum_enabled;
    case "disarray":
      return config.disarray_enabled;
    case "exhaustion":
      return config.exhaustion_enabled;
    default:
      return false;
  }
}

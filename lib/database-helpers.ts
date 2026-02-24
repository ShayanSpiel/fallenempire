/**
 * Database Helper Functions
 * Consolidates repeated query patterns and reduces N+1 queries
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Common select fields used across multiple queries
 */
export const PROFILE_SELECT_FIELDS = 'id, auth_id, username, email, energy, energy_updated_at, morale, rage, strength, main_community_id, current_military_rank, military_rank_score, avatar_url, identity_json, level, total_xp, battles_fought, total_damage_dealt, highest_damage_battle';

export const MINIMAL_PROFILE_SELECT_FIELDS = 'id, username, avatar_url, energy, strength, morale, rage, current_military_rank';

export const COMMUNITY_SELECT_FIELDS = 'id, name, slug, logo_url, member_count, ideology_score, primary_ideology, treasury_gold, treasury_food';

export const BATTLE_SELECT_FIELDS = 'id, attacker_id, defender_id, target_hex_id, attacker_community_id, defender_community_id, current_defense, attacker_score, defender_score, started_at, ended_at, winner';

/**
 * Get user profile by auth_id with selected fields
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  authId: string,
  selectFields: string = PROFILE_SELECT_FIELDS
) {
  return supabase
    .from('users')
    .select(selectFields)
    .eq('auth_id', authId)
    .maybeSingle();
}

/**
 * Get multiple user profiles efficiently (batch query)
 */
export async function getUserProfiles(
  supabase: SupabaseClient,
  authIds: string[],
  selectFields: string = PROFILE_SELECT_FIELDS
) {
  if (authIds.length === 0) return { data: [], error: null };

  return supabase
    .from('users')
    .select(selectFields)
    .in('auth_id', authIds);
}

/**
 * Get community with member count and stats
 */
export async function getCommunityWithStats(
  supabase: SupabaseClient,
  communityId: string,
  selectFields: string = COMMUNITY_SELECT_FIELDS
) {
  return supabase
    .from('communities')
    .select(selectFields)
    .eq('id', communityId)
    .maybeSingle();
}

/**
 * Get battle with all related data (prevents N+1)
 */
export async function getBattleWithCommunities(
  supabase: SupabaseClient,
  battleId: string
) {
  const { data: battle, error } = await supabase
    .from('battles')
    .select(BATTLE_SELECT_FIELDS)
    .eq('id', battleId)
    .maybeSingle();

  if (!battle) return { data: null, error };

  // Batch fetch communities instead of sequential queries
  const { data: communities } = await supabase
    .from('communities')
    .select(COMMUNITY_SELECT_FIELDS)
    .in('id', [battle.attacker_community_id, battle.defender_community_id]);

  const communitiesMap = new Map(communities?.map(c => [c.id, c]) ?? []);

  return {
    data: {
      ...battle,
      attackerCommunity: communitiesMap.get(battle.attacker_community_id),
      defenderCommunity: communitiesMap.get(battle.defender_community_id),
    },
    error,
  };
}

/**
 * Batch get user's community membership (prevents N+1)
 */
export async function getUserCommunityMemberships(
  supabase: SupabaseClient,
  userId: string
) {
  return supabase
    .from('community_members')
    .select('community_id, role, joined_at')
    .eq('user_id', userId);
}

/**
 * Check if user is member of community (single query, no sequential checks)
 */
export async function checkCommunityMembership(
  supabase: SupabaseClient,
  userId: string,
  communityId: string
) {
  return supabase
    .from('community_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .maybeSingle();
}

/**
 * Get multiple items with their associations in single batch
 */
export async function getItemsWithUsers(
  supabase: SupabaseClient,
  itemIds: string[],
  selectFields: string = '*'
) {
  if (itemIds.length === 0) return { data: [], error: null };

  return supabase
    .from('market_items')
    .select(selectFields)
    .in('id', itemIds);
}

/**
 * Cache result with TTL (in-memory, for short-lived data)
 */
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export function cacheQuery<T>(
  key: string,
  data: T
): T {
  queryCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export function getCachedQuery<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }

  return cached.data as T;
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    queryCache.clear();
    return;
  }

  for (const key of queryCache.keys()) {
    if (key.startsWith(pattern)) {
      queryCache.delete(key);
    }
  }
}

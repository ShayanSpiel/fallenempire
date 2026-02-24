/**
 * Database Helpers
 * Consolidated query patterns to prevent N+1 queries and reduce duplication
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Standard profile select fields used across queries
 */
export const PROFILE_SELECT_FIELDS = `
  id,
  auth_id,
  username,
  avatar_url,
  main_community,
  level,
  energy,
  morale,
  rage,
  adrenaline,
  gold,
  silver,
  updated_at,
  coherence
`;

export const MINIMAL_PROFILE_SELECT_FIELDS = `
  id,
  username,
  avatar_url,
  level
`;

export const COMMUNITY_SELECT_FIELDS = `
  id,
  name,
  slug,
  description,
  avatar_url,
  member_count,
  founded_at,
  ideology_values,
  color,
  leader_id
`;

export const BATTLE_SELECT_FIELDS = `
  id,
  community_id,
  region_id,
  status,
  started_at,
  ended_at,
  winner_id,
  attacking_leader_id,
  defending_leader_id
`;

/**
 * Get full user profile by auth_id
 */
export async function getUserProfile(
  supabase: SupabaseClient,
  authId: string
) {
  return await supabase
    .from("users")
    .select(PROFILE_SELECT_FIELDS)
    .eq("auth_id", authId)
    .maybeSingle();
}

/**
 * Get multiple user profiles efficiently
 */
export async function getUserProfiles(
  supabase: SupabaseClient,
  authIds: string[]
) {
  if (authIds.length === 0) return { data: [] };

  return await supabase
    .from("users")
    .select(PROFILE_SELECT_FIELDS)
    .in("auth_id", authIds);
}

/**
 * Get community with stats
 */
export async function getCommunityWithStats(
  supabase: SupabaseClient,
  communityId: string
) {
  return await supabase
    .from("communities")
    .select(COMMUNITY_SELECT_FIELDS)
    .eq("id", communityId)
    .maybeSingle();
}

/**
 * Get battle with all community info (avoids N+1)
 */
export async function getBattleWithCommunities(
  supabase: SupabaseClient,
  battleId: string
) {
  const { data: battle, error } = await supabase
    .from("battles")
    .select(BATTLE_SELECT_FIELDS)
    .eq("id", battleId)
    .maybeSingle();

  if (error || !battle) return { data: null, error };

  // Batch load communities instead of individual queries
  const { data: communities } = await supabase
    .from("communities")
    .select(COMMUNITY_SELECT_FIELDS)
    .in("id", [battle.community_id]);

  return {
    data: {
      ...battle,
      community: communities?.[0],
    },
    error: null,
  };
}

/**
 * Check community membership
 */
export async function checkCommunityMembership(
  supabase: SupabaseClient,
  userId: string,
  communityId: string
) {
  return await supabase
    .from("community_members")
    .select("id")
    .eq("user_id", userId)
    .eq("community_id", communityId)
    .maybeSingle();
}

/**
 * Query result cache with TTL
 */
const queryCache = new Map<
  string,
  { data: any; timestamp: number }
>();
const CACHE_TTL = 30000; // 30 seconds

export function getCachedQueryResult<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }

  return cached.data as T;
}

export function setCachedQueryResult<T>(key: string, data: T): T {
  queryCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export function invalidateQueryCache(pattern?: string): void {
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

/**
 * Action Helpers
 * Common patterns extracted from server actions to prevent duplication
 */

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserProfile, PROFILE_SELECT_FIELDS } from "./database-helpers";

/**
 * Get authenticated user's profile efficiently
 * Replaces repeated pattern: const { data: { user } } = await supabase.auth.getUser()
 */
export async function getAuthenticatedUserProfile() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error } = await getUserProfile(supabaseAdmin, user.id);

  if (error || !profile) {
    throw new Error("Profile not found");
  }

  return { supabase, user, profile };
}

/**
 * Get profile ID and supabase instance
 * Lightweight version when only ID is needed
 */
export async function getProfileId() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile) throw new Error("Profile not found");
  return { supabase, profileId: profile.id };
}

/**
 * Reusable error handler for action errors
 */
export function handleActionError(error: any, context: string): never {
  console.error(`[${context}] Error:`, error);
  throw new Error(error?.message || `${context} failed`);
}

/**
 * Batch get multiple users efficiently
 */
export async function fetchUsersForIds(userIds: string[]) {
  if (userIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, username, avatar_url")
    .in("id", userIds);

  if (error) {
    console.warn("Failed to fetch users:", error);
    return [];
  }

  return data || [];
}

/**
 * Generic cache for frequently accessed data
 */
const actionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // 10 seconds for action cache

export function getCachedActionData<T>(key: string): T | null {
  const cached = actionCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    actionCache.delete(key);
    return null;
  }

  return cached.data as T;
}

export function setCachedActionData<T>(key: string, data: T): T {
  actionCache.set(key, { data, timestamp: Date.now() });
  return data;
}

export function invalidateActionCache(pattern?: string): void {
  if (!pattern) {
    actionCache.clear();
    return;
  }

  for (const key of actionCache.keys()) {
    if (key.startsWith(pattern)) {
      actionCache.delete(key);
    }
  }
}

"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateMissionProgress } from "./missions";

async function getUserProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  authId: string
): Promise<{ id: string } | null> {
  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", authId)
    .maybeSingle();

  if (profile) {
    return profile;
  }

  // Create profile if it doesn't exist
  const { data: newProfile, error: insertError } = await supabase
    .from("users")
    .insert({
      username: `player-${authId.slice(0, 5)}`,
      auth_id: authId,
      is_bot: false,
    })
    .select("id")
    .single();

  if (insertError || !newProfile) {
    return null;
  }

  return newProfile;
}

export async function followUser(followedId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get current user's profile ID
  const followerProfile = await getUserProfile(supabase, user.id);
  if (!followerProfile) {
    return { success: false, error: "Failed to load user profile" };
  }

  if (followerProfile.id === followedId) {
    return { success: false, error: "Cannot follow yourself" };
  }

  const { error } = await supabase
    .from("user_follows")
    .insert({
      follower_id: followerProfile.id,
      followed_id: followedId,
    });

  if (error) {
    // Check if it's a unique constraint violation (already following)
    if (error.code === "23505") {
      return { success: false, error: "Already following this user" };
    }
    return { success: false, error: error.message };
  }

  // Update make-friend mission
  await updateMissionProgress("make-friend", 1, followerProfile.id);

  return { success: true };
}

export async function unfollowUser(followedId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get current user's profile ID
  const followerProfile = await getUserProfile(supabase, user.id);
  if (!followerProfile) {
    return { success: false, error: "Failed to load user profile" };
  }

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", followerProfile.id)
    .eq("followed_id", followedId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function toggleFollowUser(
  followedId: string,
  isCurrentlyFollowing: boolean
): Promise<{ success: boolean; error?: string }> {
  if (isCurrentlyFollowing) {
    return unfollowUser(followedId);
  } else {
    return followUser(followedId);
  }
}
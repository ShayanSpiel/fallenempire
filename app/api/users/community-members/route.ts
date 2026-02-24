import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CommunityMemberRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

type CommunityMemberJoinRow = {
  user_id: string;
  users:
    | { id: string; username: string | null; avatar_url: string | null }
    | { id: string; username: string | null; avatar_url: string | null }[]
    | null;
};

function normalizeRelation<T extends Record<string, unknown>>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return (value ?? null) as T | null;
}

/**
 * GET /api/users/community-members
 * Fetches users who share at least one community with the current user
 * Query params:
 *   - q: optional search query to filter by username
 *   - communityId: optional community scope to limit members to a single community
 */
export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("q") ?? "").trim();
    const communityId = String(searchParams.get("communityId") ?? "").trim() || null;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const limit = 30;

    if (communityId) {
      const { data: membership } = await supabase
        .from("community_members")
        .select("id")
        .eq("user_id", profile.id)
        .eq("community_id", communityId)
        .is("left_at", null)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json([]);
      }

      const { data: communityMembers, error } = await supabase
        .from("community_members")
        .select(
          `
          user_id,
          users:user_id (
            id,
            username,
            avatar_url
          )
        `
        )
        .eq("community_id", communityId)
        .is("left_at", null)
        .neq("user_id", profile.id);

      if (error) {
        console.error("[Community Members Search] Failed to query users", error);
        return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
      }

      const userMap = new Map<string, CommunityMemberRow>();
      for (const member of (communityMembers ?? []) as CommunityMemberJoinRow[]) {
        const userData = normalizeRelation(member.users);
        if (userData?.id && userData?.username) {
          if (!query || userData.username.toLowerCase().includes(query.toLowerCase())) {
            userMap.set(userData.id, {
              id: userData.id,
              username: userData.username,
              avatar_url: userData.avatar_url ?? null,
            });
          }
        }
      }

      const rows = Array.from(userMap.values())
        .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
        .slice(0, limit);

      return NextResponse.json(rows);
    }

    // Get communities the user is a member of
    const { data: userCommunities } = await supabase
      .from("community_members")
      .select("community_id")
      .eq("user_id", profile.id)
      .is("left_at", null);

    const communityIds = (userCommunities ?? []).map((m) => m.community_id);

    if (communityIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get all users who are members of these communities (excluding self)
    const { data: communityMembers, error } = await supabase
      .from("community_members")
      .select(`
        user_id,
        users:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .in("community_id", communityIds)
      .is("left_at", null)
      .neq("user_id", profile.id);

    if (error) {
      console.error("[Community Members Search] Failed to query users", error);
      return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
    }

    // Extract unique users and filter by query if provided
    const userMap = new Map<string, CommunityMemberRow>();

    for (const member of (communityMembers ?? []) as CommunityMemberJoinRow[]) {
      const userData = normalizeRelation(member.users);
      if (userData?.id && userData?.username) {
        if (!query || userData.username.toLowerCase().includes(query.toLowerCase())) {
          userMap.set(userData.id, {
            id: userData.id,
            username: userData.username,
            avatar_url: userData.avatar_url ?? null,
          });
        }
      }
    }

    const rows = Array.from(userMap.values())
      .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
      .slice(0, limit);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[Community Members Search] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

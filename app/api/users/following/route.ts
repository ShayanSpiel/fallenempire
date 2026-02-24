import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type FollowingUserRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

/**
 * GET /api/users/following
 * Fetches users that the current user is following
 * Query params:
 *   - q: optional search query to filter by username
 */
export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("q") ?? "").trim();

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

    // Get users that the current user is following
    const { data: followingData, error } = await supabase
      .from("user_follows")
      .select(`
        followed_id,
        followed:users!user_follows_followed_id_fkey (
          id,
          username,
          avatar_url
        )
      `)
      .eq("follower_id", profile.id);

    if (error) {
      console.error("[Following Search] Failed to query users", error);
      return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
    }

    // Filter by query if provided
    const rows: FollowingUserRow[] = (followingData ?? [])
      .map((follow) => {
        const userData = follow.followed as any;
        return {
          id: userData?.id ?? "",
          username: userData?.username ?? null,
          avatar_url: userData?.avatar_url ?? null,
        };
      })
      .filter((user) => user.id && user.username)
      .filter((user) => !query || user.username!.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""))
      .slice(0, 30);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[Following Search] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

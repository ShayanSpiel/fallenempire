import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

type UserSearchRow = {
  id: string;
  username: string | null;
  avatar_url: string | null;
};

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get("q") ?? "").trim();
    const limitParam = Number(searchParams.get("limit") ?? 30);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 30) : 30;

    // Build query - if no search query, get recent users
    let dbQuery = supabase
      .from("users")
      .select("id, username, avatar_url")
      .not("username", "is", null)
      .limit(limit);

    if (query) {
      dbQuery = dbQuery.ilike("username", `%${query}%`);
    }

    const { data, error } = await dbQuery.order("username", { ascending: true });

    if (error) {
      console.error("[User Search] Failed to query users", error);
      return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
    }

    const rows: UserSearchRow[] = data ?? [];
    return NextResponse.json(rows);
  } catch (error) {
    console.error("[User Search] Unexpected error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

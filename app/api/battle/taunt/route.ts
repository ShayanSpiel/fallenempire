import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient({ canSetCookies: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const battleId = typeof body?.battleId === "string" ? body.battleId : null;

    if (!battleId) {
      return NextResponse.json(
        { error: "battleId (string) is required" },
        { status: 400 }
      );
    }

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("id, username, avatar_url")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Insert taunt into battle_taunts table
    const { error: tauntError } = await supabaseAdmin
      .from("battle_taunts")
      .insert({
        battle_id: battleId,
        user_id: profile.id,
        username: profile.username,
        avatar_url: profile.avatar_url,
      });

    if (tauntError) {
      console.error("Failed to insert taunt:", tauntError);
      return NextResponse.json({ error: tauntError.message }, { status: 400 });
    }

    return NextResponse.json(
      { success: true },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err: any) {
    console.error("Battle taunt error:", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

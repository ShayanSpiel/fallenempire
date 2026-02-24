import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calculateFocus, getBattleConfig } from "@/lib/battle-mechanics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Fetch user stats
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("morale, rage, energy, main_community_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch user stats:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const morale = user.morale ?? 50;
    const rage = user.rage ?? 0;
    const energy = user.energy ?? 100;

    // Calculate focus
    const config = await getBattleConfig(user.main_community_id);
    const focus = calculateFocus(morale, config);

    return NextResponse.json({
      morale,
      rage,
      energy,
      focus,
    });
  } catch (err: any) {
    console.error("Battle mechanics user stats error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

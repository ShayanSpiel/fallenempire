import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserMentalPower, getInfluenceSummary } from "@/lib/ai-system/services/influence";
import { getHeatStatus } from "@/lib/heat-middleware";
import { calculatePhysicalPower } from "@/lib/psychology";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/psychology/stats?userId={userId}
 * Returns comprehensive psychology stats for a user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const { data: requester, error: requesterError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (requesterError || !requester?.id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (requester.id !== userId && requester.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch user data
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select(
        "id, power_mental, morale, freewill, physical_power, action_heat, last_action_timestamp"
      )
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [
      mentalPower,
      heatStatus,
      influenceSummary,
      { data: activityScore, error: activityError },
      { data: coherenceRecord },
    ] = await Promise.all([
      getUserMentalPower(userId),
      getHeatStatus(userId),
      getInfluenceSummary(userId),
      supabaseAdmin.rpc("get_activity_score", { p_user_id: userId }),
      supabaseAdmin
        .from("coherence_history")
        .select("coherence")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const coherence = coherenceRecord?.coherence || 0;
    const activityScoreValue = activityError ? 0 : ((activityScore as number) || 0);

    // Calculate physical power
    const physicalPower = calculatePhysicalPower(
      user.morale || 50,
      coherence,
      user.physical_power
    );

    return NextResponse.json({
      userId,
      mentalPower: Math.round(mentalPower),
      physicalPower: Math.round(physicalPower),
      morale: Math.round(user.morale || 50),
      coherence: Number(coherence.toFixed(2)),
      actionHeat: Number(heatStatus.currentHeat.toFixed(1)),
      activityScore: Math.round(activityScoreValue),
      heatLevel: heatStatus.heatLevel,
      persuasionEffect: influenceSummary.persuasionPotential, // FIXED: renamed from persuasionEffect
      canInfluenceAI: influenceSummary.canInfluenceAI,
      recoveryTime: heatStatus.recoveryTime,
    });
  } catch (error) {
    console.error("Psychology stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch psychology stats" },
      { status: 500 }
    );
  }
}

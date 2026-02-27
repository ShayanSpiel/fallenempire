import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("users")
      .select("id, username")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { tier_number, tier_type } = body;

    // Validate inputs
    if (
      typeof tier_number !== "number" ||
      tier_number < 1 ||
      tier_number > 100
    ) {
      return NextResponse.json(
        { error: "Invalid tier number" },
        { status: 400 }
      );
    }

    if (tier_type !== "free" && tier_type !== "keeper") {
      return NextResponse.json({ error: "Invalid tier type" }, { status: 400 });
    }

    // Call database function to claim reward
    const { data, error } = await supabase.rpc("claim_battle_pass_reward", {
      p_user_id: profile.id,
      p_tier_number: tier_number,
      p_tier_type: tier_type,
    });

    if (error) {
      console.error("Error claiming reward:", error);
      return NextResponse.json(
        { error: error.message || "Failed to claim reward" },
        { status: 400 }
      );
    }

    if (!data.success) {
      return NextResponse.json(
        { error: data.error || "Failed to claim reward" },
        { status: 400 }
      );
    }

    // Create notification for the reward
    try {
      await supabase.from("notifications").insert({
        user_id: profile.id,
        type: "reward",
        title: "Battle Pass Reward Claimed!",
        body: `You earned ${data.reward_amount} ${data.reward_type}${
          data.reward_type === "gold" ? " coins" : ""
        }`,
        action_url: "/battlepass",
        metadata: {
          source: "battle_pass",
          tier_number: tier_number,
          tier_type: tier_type,
          reward_type: data.reward_type,
          reward_amount: data.reward_amount,
        },
      });
    } catch (notifError) {
      console.error("Error creating notification:", notifError);
      // Don't fail the whole request if notification fails
    }

    return NextResponse.json({
      success: true,
      data: {
        tier_number: data.tier_number,
        tier_type: data.tier_type,
        reward_type: data.reward_type,
        reward_amount: data.reward_amount,
        reward_data: data.reward_data,
      },
    });
  } catch (error) {
    console.error("Error in claim reward API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

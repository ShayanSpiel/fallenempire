import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NotificationType } from "@/lib/types/notifications";
import { getHexNeighbors } from "@/components/map/hex-utils";

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
    const attackerCommunityId =
      typeof body?.attackerCommunityId === "string" ? body.attackerCommunityId : null;
    const targetHexId = typeof body?.targetHexId === "string" ? body.targetHexId : null;

    if (!attackerCommunityId || !targetHexId) {
      return NextResponse.json(
        { error: "attackerCommunityId and targetHexId are required" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get user's current location
    const { data: userData } = await supabase
      .from("users")
      .select("current_hex")
      .eq("id", profile.id)
      .maybeSingle();

    const userCurrentHex =
      typeof userData?.current_hex === "string" ? userData.current_hex.trim() : null;

    const isOnHex = userCurrentHex === targetHexId;

    // Check if user is on a neighboring hex
    const neighbors = getHexNeighbors(targetHexId);
    const isOnNeighbor = userCurrentHex ? neighbors.includes(userCurrentHex) : false;

    if (!isOnHex && !isOnNeighbor) {
      return NextResponse.json(
        { error: "You must be on this hex or a neighboring hex to start a battle" },
        { status: 403 }
      );
    }

    // Get region name for transaction description
    const { data: regionData } = await supabase
      .from("region_owners")
      .select("custom_name")
      .eq("hex_id", targetHexId)
      .maybeSingle();

    const regionName = regionData?.custom_name || `Region ${targetHexId}`;

    // Deduct gold cost using transaction service (single source of truth)
    const goldCost = 10;
    const { data: deductResult, error: goldError } = await supabase.rpc(
      "deduct_gold_enhanced",
      {
        p_user_id: profile.id,
        p_amount: goldCost,
        p_transaction_type: "battle_cost",
        p_description: `Battle start fee for ${regionName}`,
        p_metadata: {
          target_hex_id: targetHexId,
          region_name: regionName,
          attacker_community_id: attackerCommunityId,
        },
        p_scope: "personal",
      }
    );

    if (goldError || !deductResult?.success) {
      return NextResponse.json(
        {
          error: deductResult?.error || "Failed to deduct gold cost",
          current_balance: deductResult?.current_balance,
          required: goldCost,
        },
        { status: 400 }
      );
    }

    const { data: battleId, error } = await supabase.rpc("start_battle", {
      p_attacker_community_id: attackerCommunityId,
      p_target_hex_id: targetHexId,
    });

    if (error || !battleId) {
      return NextResponse.json(
        { error: error?.message ?? "Battle failed" },
        { status: 400 }
      );
    }

    // Fetch battle and community context for notifications
    const { data: battle } = await supabaseAdmin
      .from("battles")
      .select("id, attacker_community_id, defender_community_id, target_hex_id, status")
      .eq("id", battleId)
      .maybeSingle();

    const { data: attackerCommunity } = await supabaseAdmin
      .from("communities")
      .select("id, name, slug")
      .eq("id", attackerCommunityId)
      .maybeSingle();

    const defenderId = battle?.defender_community_id ?? null;
    const { data: defenderCommunity } = defenderId
      ? await supabaseAdmin
          .from("communities")
          .select("id, name, slug")
          .eq("id", defenderId)
          .maybeSingle()
      : { data: null };

    const now = new Date().toISOString();
    const attackerName = attackerCommunity?.name ?? "Your community";
    const defenderName = defenderCommunity?.name ?? "an unclaimed region";

    const [attackerMembersRes, defenderMembersRes] = await Promise.all([
      supabaseAdmin
        .from("community_members")
        .select("user_id")
        .eq("community_id", attackerCommunityId)
        .is("left_at", null),
      defenderId
        ? supabaseAdmin
            .from("community_members")
            .select("user_id")
            .eq("community_id", defenderId)
            .is("left_at", null)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const attackerMembers = attackerMembersRes.data ?? [];
    const defenderMembers = defenderMembersRes.data ?? [];

    const uniqueAttackerUserIds = Array.from(
      new Set(attackerMembers.map((m) => m.user_id).filter(Boolean))
    ).filter((userId) => userId !== profile.id);

    const uniqueDefenderUserIds = Array.from(
      new Set(defenderMembers.map((m) => m.user_id).filter(Boolean))
    ).filter((userId) => userId !== profile.id);

    const notifications = [
      ...uniqueAttackerUserIds.map((userId) => ({
          user_id: userId,
          type: NotificationType.BATTLE_STARTED,
          title: "Battle Commenced!",
          body: `${attackerName} engaged ${defenderName}.`,
          community_id: attackerCommunityId,
          battle_id: battleId,
          triggered_by_user_id: profile.id,
          action_url: `/battle/${battleId}`,
          metadata: {
            battle_id: battleId,
            attacker_community_id: attackerCommunityId,
            defender_community_id: defenderId,
            target_hex_id: targetHexId,
          },
          is_read: false,
          is_archived: false,
          created_at: now,
          updated_at: now,
        })),
      ...(defenderId
        ? uniqueDefenderUserIds.map((userId) => ({
              user_id: userId,
              type: NotificationType.BATTLE_STARTED,
              title: "Your community is under attack!",
              body: `${attackerName} opened a battle against ${defenderName}.`,
              community_id: defenderId,
              battle_id: battleId,
              triggered_by_user_id: profile.id,
              action_url: `/battle/${battleId}`,
              metadata: {
                battle_id: battleId,
                attacker_community_id: attackerCommunityId,
                defender_community_id: defenderId,
                target_hex_id: targetHexId,
              },
              is_read: false,
              is_archived: false,
              created_at: now,
              updated_at: now,
            }))
        : []),
    ];

    if (notifications.length > 0) {
      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .upsert(notifications, {
          onConflict: "user_id,battle_id,community_id,type",
          ignoreDuplicates: true,
        });
      if (notifError) {
        console.error("Battle start notification insert error:", notifError);
      }
    }

    return NextResponse.json({ battleId });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

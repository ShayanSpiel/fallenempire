import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordMoraleEvent } from "@/lib/morale";
import { ENERGY_CAP } from "@/lib/gameplay/constants";
import {
  getBattleConfig,
  calculateFocus,
  checkFocusHit,
  checkRageCritical,
  calculateCriticalDamage,
  getDisarrayMultiplier,
  calculateEnergyCost,
} from "@/lib/battle-mechanics";
import { getRankDamageMultiplier, type MilitaryRank } from "@/lib/military-ranks";

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
    const adrenalineBonus = typeof body?.adrenalineBonus === "number" ? body.adrenalineBonus : 0;

    if (!battleId) {
      return NextResponse.json(
        { error: "battleId (string) is required" },
        { status: 400 }
      );
    }

    const selectFields = "id, energy, energy_updated_at, morale, rage, strength, main_community_id, current_military_rank";
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select(selectFields)
      .eq("auth_id", user.id)
      .maybeSingle();

    let actorUserId = profile?.id ?? null;
    let storedEnergy = profile?.energy;
    let energyUpdatedAt = profile?.energy_updated_at ?? null;
    let morale = profile?.morale ?? 50;
    let rage = profile?.rage ?? 0;
    let strength = profile?.strength ?? 1;
    let communityId = profile?.main_community_id ?? null;
    let militaryRank: MilitaryRank = (profile?.current_military_rank as MilitaryRank) ?? 'Recruit';

    if (!actorUserId) {
      const fallbackUsername =
        (user.user_metadata as Record<string, any>)?.username ||
        (user.user_metadata as Record<string, any>)?.name ||
        user.email?.split("@")[0] ||
        `player-${user.id.slice(0, 8)}`;

      const { data: insertedProfile, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          auth_id: user.id,
          username: fallbackUsername,
          email: user.email,
          is_bot: false,
          energy: ENERGY_CAP,
          energy_updated_at: new Date().toISOString(),
          morale: 50,
          rage: 0,
        })
        .select(selectFields)
        .single();

      if (insertError) {
        console.error("Could not create user profile for battle attack:", insertError);
        return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 500 });
      }

      actorUserId = insertedProfile?.id ?? null;
      storedEnergy = insertedProfile?.energy;
      energyUpdatedAt = insertedProfile?.energy_updated_at ?? null;
      morale = insertedProfile?.morale ?? 50;
      rage = insertedProfile?.rage ?? 0;
      strength = insertedProfile?.strength ?? 1;
      communityId = insertedProfile?.main_community_id ?? null;
      militaryRank = (insertedProfile?.current_military_rank as MilitaryRank) ?? 'Recruit';
    }

    if (!actorUserId) {
      return NextResponse.json({ error: "Unable to resolve user profile" }, { status: 400 });
    }

    let currentEnergy: number;
    if (typeof storedEnergy !== "number") {
      currentEnergy = ENERGY_CAP;
    } else if (storedEnergy <= 0 && !energyUpdatedAt) {
      currentEnergy = ENERGY_CAP;
    } else {
      currentEnergy = storedEnergy;
    }

    // ========================================
    // BATTLE MECHANICS SYSTEM
    // ========================================

    // Get battle mechanics config
    const config = await getBattleConfig(communityId);

    // Calculate disarray multiplier (if user's community is in disarray)
    let disarrayMultiplier = 1.0;
    if (communityId) {
      disarrayMultiplier = await getDisarrayMultiplier(communityId);
    }

    // Calculate energy cost with disarray
    const energyCost = calculateEnergyCost(config.base_energy_cost, disarrayMultiplier);

    // Check energy
    if (currentEnergy < energyCost) {
      return NextResponse.json(
        {
          error: "Insufficient energy",
          required: energyCost,
          current: currentEnergy,
          disarrayMultiplier,
        },
        { status: 400 }
      );
    }

    // Gate 1: Focus Check (Accuracy)
    const focus = calculateFocus(morale, config);
    const hit = checkFocusHit(focus);

    let damage = 0;
    let critical = false;
    let result: "HIT" | "CRITICAL" | "MISS" = "MISS";
    let battleState: any = null;
    let battleSide: "attacker" | "defender" = "attacker";

    if (hit) {
      const { data: battle } = await supabaseAdmin
        .from("battles")
        .select("attacker_community_id, defender_community_id, target_hex_id")
        .eq("id", battleId)
        .maybeSingle();

      if (battle && communityId) {
        battleSide =
          battle.defender_community_id === communityId ? "defender" : "attacker";

        // Check if user is on the battle hex or in their community's territory
        const { data: isOnHex } = await supabaseAdmin.rpc("is_user_on_hex", {
          p_user_id: actorUserId,
          p_hex_id: battle.target_hex_id,
        });

        const { data: isInTerritory } = await supabaseAdmin.rpc("is_user_in_community_territory", {
          p_user_id: actorUserId,
          p_community_id: communityId,
        });

        if (!isOnHex && !isInTerritory) {
          return NextResponse.json(
            { error: "You must be on the battle hex or in your community's territory to fight" },
            { status: 403 }
          );
        }
      }

      // Validate and apply adrenaline bonus (defenders only)
      let effectiveRage = rage;
      if (adrenalineBonus > 0 && battleSide === "defender") {
        // Server-side validation of client-calculated adrenaline bonus
        const { data: validationResult } = await supabaseAdmin.rpc(
          "validate_adrenaline_bonus",
          {
            p_battle_id: battleId,
            p_claimed_bonus: adrenalineBonus,
            p_user_side: battleSide,
          }
        );

        if (validationResult === true) {
          effectiveRage = Math.min(100, rage + adrenalineBonus);
        } else {
          console.warn("Adrenaline bonus validation failed", {
            claimed: adrenalineBonus,
            userId: actorUserId,
            battleId,
          });
          // Don't fail the request, just ignore invalid bonus
          effectiveRage = rage;
        }
      }

      // Gate 2: Rage Check (Critical)
      critical = checkRageCritical(effectiveRage);

      // Calculate damage with rank bonus
      const rankMultiplier = getRankDamageMultiplier(militaryRank);
      const baseDamage = 100 * strength * rankMultiplier;
      damage = Math.floor(critical ? calculateCriticalDamage(baseDamage, config) : baseDamage);

      result = critical ? "CRITICAL" : "HIT";

      // CRITICAL: Verify user exists before calling RPC
      const { data: userVerify, error: verifyError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", actorUserId)
        .maybeSingle();

      if (!userVerify || verifyError) {
        console.error("User verification failed:", {
          actorUserId,
          verifyError,
          profileExists: !!profile,
        });
        return NextResponse.json(
          { error: `User ${actorUserId} does not exist in database` },
          { status: 500 }
        );
      }

      // Apply damage to battle
      // Try with result parameter first (new version)
      let attackError = null;
      const signedDamage = battleSide === "defender" ? -damage : damage;
      let attackResponse = await supabaseAdmin.rpc("attack_battle", {
        p_battle_id: battleId,
        p_damage: signedDamage,
        p_actor_id: actorUserId,
        p_result: result,
      });

      attackError = attackResponse.error;
      battleState = attackResponse.data;

      // If error, try without result parameter (old version - backward compatibility)
      if (attackError && attackError.code === '42703') {
        console.log("Retrying without p_result parameter (old function version)");
        attackResponse = await supabaseAdmin.rpc("attack_battle", {
          p_battle_id: battleId,
          p_damage: signedDamage,
          p_actor_id: actorUserId,
        });
        attackError = attackResponse.error;
        battleState = attackResponse.data;
      }

      if (attackError) {
        console.error("Failed to apply damage:", {
          error: attackError,
          code: attackError.code,
          message: attackError.message,
          details: attackError.details,
          hint: attackError.hint,
        });
        return NextResponse.json({ error: attackError.message }, { status: 400 });
      }
    } else {
      // Even on MISS, we need to log it for toast display

      // CRITICAL: Verify user exists before logging MISS
      const { data: userVerify, error: verifyError } = await supabaseAdmin
        .from("users")
        .select("id, username, avatar_url")
        .eq("id", actorUserId)
        .maybeSingle();

      if (!userVerify || verifyError) {
        console.error("User verification failed for MISS:", {
          actorUserId,
          verifyError,
        });
        // Don't fail the whole request, just skip logging
      } else {
      const { data: battle } = await supabaseAdmin
        .from("battles")
        .select("attacker_community_id, defender_community_id")
        .eq("id", battleId)
        .single();

      if (battle) {
        const side =
          communityId === battle.defender_community_id ? "defender" : "attacker";

        // Use verified user data
        const { error: missLogError } = await supabaseAdmin.from("battle_logs").insert({
          battle_id: battleId,
          user_id: userVerify.id,
          username: userVerify.username ?? "Unknown",
          actor_avatar_url: userVerify.avatar_url ?? null,
          damage: 0,
          side: side,
          result: "MISS",
        });
        if (missLogError && missLogError.code === "42703") {
          await supabaseAdmin.from("battle_logs").insert({
            battle_id: battleId,
            user_id: userVerify.id,
            username: userVerify.username ?? "Unknown",
            damage: 0,
            side: side,
            result: "MISS",
          });
        }
      }
      }
    }

    // Consume energy
    const nextEnergy = Math.max(0, currentEnergy - energyCost);
    const { data: updatedProfile, error: energyError } = await supabaseAdmin
      .from("users")
      .update({ energy: nextEnergy, energy_updated_at: new Date().toISOString() })
      .eq("id", actorUserId)
      .select("energy, energy_updated_at")
      .maybeSingle();

    if (energyError) {
      return NextResponse.json({ error: energyError.message }, { status: 400 });
    }

    // Log action to battle_action_log (use effective rage if adrenaline was applied)
    const loggedRage = hit && battleSide === "defender" && adrenalineBonus > 0
      ? Math.min(100, rage + adrenalineBonus)
      : rage;

    await supabaseAdmin.from("battle_action_log").insert({
      battle_id: battleId,
      user_id: actorUserId,
      action_type: "FIGHT",
      hit,
      critical,
      damage_dealt: damage,
      user_morale: morale,
      user_rage: loggedRage,
      user_energy: currentEnergy,
      energy_cost: energyCost,
      disarray_multiplier: disarrayMultiplier,
    });

    try {
      await recordMoraleEvent({
        userId: actorUserId,
        eventType: "action",
        eventTrigger: "action:FIGHT",
        moraleChange: -0.5,
        metadata: {
          battle_id: battleId,
          result,
          hit,
          energy_cost: energyCost,
        },
      });
    } catch (moraleErr) {
      console.error("Failed to record fight morale event:", moraleErr);
    }

    return NextResponse.json(
      {
        result,
        hit,
        critical,
        damage,
        focus,
        rage,
        morale,
        energy: updatedProfile?.energy ?? nextEnergy,
        energyUpdatedAt: updatedProfile?.energy_updated_at ?? null,
        energyCost,
        disarrayMultiplier,
        // Include battle state for instant UI updates
        current_defense: battleState?.current_defense,
        attacker_score: battleState?.attacker_score,
        defender_score: battleState?.defender_score,
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (err: any) {
    console.error("Battle attack error:", err);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

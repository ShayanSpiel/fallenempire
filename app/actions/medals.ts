"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recordMoraleEvent } from "@/lib/morale";

export interface MedalAwardResult {
  success: boolean;
  medalKey?: string;
  medalName?: string;
  isNewAward?: boolean;
  error?: string;
}

/**
 * Award Battle Hero Medal to a user
 * Checks if they already have it, only awards if they don't
 *
 * @param userId - User ID to award medal to
 * @param battleId - Battle ID for metadata
 * @param damageDealt - Amount of damage dealt
 * @returns Result indicating if medal was newly awarded
 */
export async function awardBattleHeroMedal(
  userId: string,
  battleId: string,
  damageDealt: number,
): Promise<MedalAwardResult> {
  try {
    // Verify the user exists (service role bypasses row-level security)
    const { data: userExists, error: userCheckError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (userCheckError || !userExists) {
      // User doesn't exist - silently skip medal award
      return {
        success: true,
        isNewAward: false,
      };
    }

    // Get the Battle Hero medal
    const { data: medal, error: medalError } = await supabaseAdmin
      .from("medals")
      .select("id, key, name")
      .eq("key", "battle_hero")
      .single();

    if (medalError || !medal) {
      console.error("Error fetching Battle Hero medal:", medalError);
      return {
        success: false,
        error: "Battle Hero medal not found",
      };
    }

    console.log("Battle Hero medal found:", medal);

    const recordHeroMoraleBonus = async () => {
      try {
        await recordMoraleEvent({
          userId,
          eventType: "custom",
          eventTrigger: "medal:battle_hero",
          moraleChange: 3,
          metadata: {
            battle_id: battleId,
            damage_dealt: damageDealt,
          },
        });
      } catch (moraleErr) {
        console.error("Failed to record Battle Hero morale bonus:", moraleErr);
      }
    };

    const awardHeroGoldReward = async () => {
      try {
        const { error: goldError } = await supabaseAdmin.rpc(
          "add_gold_enhanced",
          {
            p_user_id: userId,
            p_amount: 3, // Medal reward amount (reduced from 50 to 3)
            p_transaction_type: "medal_reward",
            p_description: "Battle Hero Medal reward",
            p_metadata: {
              medal_key: "battle_hero",
              battle_id: battleId,
              damage_dealt: damageDealt,
            },
            p_scope: "global",
          }
        );
        if (goldError) {
          console.error("Failed to award Battle Hero gold reward:", goldError);
        }
      } catch (goldErr) {
        console.error("Failed to award Battle Hero gold reward:", goldErr);
      }
    };

    // Check if user already has this medal
    const { data: existing, error: checkError } = await supabaseAdmin
      .from("user_medals")
      .select("id, metadata")
      .eq("user_id", userId)
      .eq("medal_id", medal.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking existing medal:", checkError);
      return {
        success: false,
        error: "Database error",
      };
    }

    // If already has medal, increment the count stored in metadata
    if (existing) {
      console.log("User already has Battle Hero medal");
      const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
      const existingCount =
        typeof existingMetadata.count === "number" ? existingMetadata.count : 1;
      const nextCount = existingCount + 1;

      const { error: updateError } = await supabaseAdmin
        .from("user_medals")
        .update({
          metadata: {
            ...existingMetadata,
            count: nextCount,
            last_battle_id: battleId,
            last_damage_dealt: damageDealt,
            last_awarded_at: new Date().toISOString(),
          },
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("Error updating existing medal:", updateError);
        return {
          success: false,
          error: "Failed to update medal count",
        };
      }

      await recordHeroMoraleBonus();
      await awardHeroGoldReward();

      return {
        success: true,
        medalKey: medal.key,
        medalName: medal.name,
        isNewAward: false,
      };
    }

    console.log("User does not have medal yet, awarding...");

    // Award the medal
    const { data: awarded, error: awardError } = await supabaseAdmin
      .from("user_medals")
      .insert({
        user_id: userId,
        medal_id: medal.id,
        metadata: {
          count: 1,
          battle_id: battleId,
          damage_dealt: damageDealt,
          awarded_at: new Date().toISOString(),
        },
      })
      .select("id");

    if (awardError) {
      console.error("Error awarding medal:", awardError);
      return {
        success: false,
        error: "Failed to award medal",
      };
    }

    await recordHeroMoraleBonus();
    await awardHeroGoldReward();

    return {
      success: true,
      medalKey: medal.key,
      medalName: medal.name,
      isNewAward: true,
    };
  } catch (err) {
    console.error("Error awarding Battle Hero medal:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Get all medals earned by a user
 */
export async function getUserMedals(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_medals")
      .select(
        `
        id,
        medal_id,
        earned_at,
        metadata,
        medals:medal_id (
          id,
          key,
          name,
          description,
          category,
          icon_type
        )
      `,
      )
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    if (error) {
      console.error("Error fetching user medals:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error getting user medals:", err);
    return [];
  }
}

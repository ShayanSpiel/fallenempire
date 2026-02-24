"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { awardXp } from "./xp";
import { updateMissionProgress } from "./missions";
import {
  DAILY_STRENGTH_INCREMENT,
  parseStrengthValue,
  roundStrength,
  STRENGTH_STORAGE_PRECISION,
} from "@/lib/gameplay/strength";

export type TrainingState = {
  message?: string | null;
  error?: string | null;
  newStrength?: number;
  newPower?: number;
  levelUp?: boolean;
  newLevel?: number;
};

export async function trainAction(): Promise<TrainingState> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, strength, last_trained_at")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  const now = new Date();
  const lastTrained = profile.last_trained_at ? new Date(profile.last_trained_at) : null;
  const isSameDay =
    lastTrained &&
    lastTrained.getUTCFullYear() === now.getUTCFullYear() &&
    lastTrained.getUTCMonth() === now.getUTCMonth() &&
    lastTrained.getUTCDate() === now.getUTCDate();

  if (isSameDay) {
    return { error: "Rest is as important as training. Come back tomorrow." };
  }

  const currentStrength = parseStrengthValue(profile.strength)
  const newStrength = roundStrength(
    currentStrength + DAILY_STRENGTH_INCREMENT,
    STRENGTH_STORAGE_PRECISION,
  )

  const { error: updateError } = await supabase
    .from("users")
    .update({
      strength: newStrength,
      last_trained_at: now.toISOString(),
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Training update failed:", updateError);
    return { error: "Failed to log training session." };
  }

  // Award XP for training
  const xpResult = await awardXp(profile.id, "training");

  // Update daily training mission - pass userId directly
  await updateMissionProgress("daily-train", 1, profile.id);

  revalidatePath("/train");
  revalidatePath("/profile");
  revalidatePath("/feed");

  return {
    message: "Strength increased.",
    newStrength,
    newPower: newStrength,
    levelUp: xpResult.levelUps > 0,
    newLevel: xpResult.newLevel,
  };
}

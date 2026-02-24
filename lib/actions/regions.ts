/**
 * Save province name to database for caching
 * Called when hex-map geocodes a location
 */
"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function saveProvinceName(
  hexId: string,
  provinceName: string | null
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("world_regions")
    .update({ province_name: provinceName })
    .eq("hex_id", hexId);

  if (error) {
    console.error(`Failed to save province name for hex ${hexId}:`, error);
  }
}

/**
 * Batch save province names for multiple hexes
 * More efficient than individual calls
 */
export async function batchSaveProvinceNames(
  updates: Array<{ hexId: string; provinceName: string | null }>
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // Upsert all province names in one call
  for (const { hexId, provinceName } of updates) {
    const { error } = await supabase
      .from("world_regions")
      .update({ province_name: provinceName })
      .eq("hex_id", hexId);

    if (error) {
      console.error(`Failed to save province name for hex ${hexId}:`, error);
    }
  }
}

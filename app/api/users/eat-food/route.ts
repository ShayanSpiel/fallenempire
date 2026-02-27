import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { recordMoraleEvent } from "@/lib/morale";
import { ENERGY_CAP } from "@/lib/gameplay/constants";

// Energy restoration by quality tier
const ENERGY_BY_QUALITY: Record<number, number> = {
  1: 10,  // Common
  2: 20,  // Uncommon
  3: 30,  // Rare
  4: 40,  // Epic
  5: 50,  // Legendary
};

// Morale boost from eating food
const MORALE_BOOST = 2;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Get the authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user ID from auth_id
    const { data: userProfile } = await supabase
      .from("users")
      .select("id, energy, energy_updated_at")
      .eq("auth_id", user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.log("[EAT-FOOD] User ID:", userProfile.id);

    // Get food resource ID
    const { data: foodResource, error: resourceError } = await supabase
      .from("resources")
      .select("id")
      .eq("key", "food")
      .single();

    if (resourceError || !foodResource) {
      console.error("[EAT-FOOD] Resource error:", resourceError);
      return NextResponse.json(
        { error: "Food resource not found" },
        { status: 404 }
      );
    }

    console.log("[EAT-FOOD] Food resource ID:", foodResource.id);

    // Get user's food inventory - simpler query without join
    const { data: foodInventory, error: inventoryQueryError } = await supabase
      .from("user_inventory")
      .select("id, quantity, quality_id")
      .eq("user_id", userProfile.id)
      .eq("resource_id", foodResource.id)
      .gt("quantity", 0);

    console.log("[EAT-FOOD] Inventory query result:", {
      data: foodInventory,
      error: inventoryQueryError,
      count: foodInventory?.length || 0
    });

    if (inventoryQueryError) {
      console.error("[EAT-FOOD] Error fetching inventory:", inventoryQueryError);
      return NextResponse.json(
        { error: "Failed to fetch inventory" },
        { status: 500 }
      );
    }

    if (!foodInventory || foodInventory.length === 0) {
      console.log("[EAT-FOOD] No food found in inventory");
      return NextResponse.json(
        { error: "No food in inventory" },
        { status: 400 }
      );
    }

    console.log("[EAT-FOOD] Found", foodInventory.length, "food items");

    // Get quality tiers for all food items
    const qualityIds = foodInventory.map(item => item.quality_id);
    const { data: qualities } = await supabase
      .from("resource_qualities")
      .select("id, tier")
      .in("id", qualityIds);

    // Create quality map
    const qualityMap = new Map((qualities as { id: string; tier: number }[] | null)?.map(q => [q.id, q.tier]) || []);

    // Sort by quality tier (prefer lower quality first)
    const sortedInventory = foodInventory.sort((a, b) => {
      const aTier = qualityMap.get(a.quality_id) || 999;
      const bTier = qualityMap.get(b.quality_id) || 999;
      return aTier - bTier;
    });

    const foodItem = sortedInventory[0];
    const qualityTier = qualityMap.get(foodItem.quality_id) || 1;
    const energyRestoration = ENERGY_BY_QUALITY[qualityTier] || 10;

    // Calculate current energy with regeneration
    const now = new Date();
    const energyUpdatedAt = userProfile.energy_updated_at
      ? new Date(userProfile.energy_updated_at)
      : now;
    const hoursSinceUpdate = Math.max(
      0,
      (now.getTime() - energyUpdatedAt.getTime()) / (1000 * 60 * 60)
    );
    const regenEnergy = Math.floor(hoursSinceUpdate * 10); // ENERGY_REGEN_PER_HOUR = 10
    const currentEnergy = Math.min(
      ENERGY_CAP,
      (userProfile.energy || 0) + regenEnergy
    );

    // Calculate new energy after eating (capped at ENERGY_CAP)
    const newEnergy = Math.min(ENERGY_CAP, currentEnergy + energyRestoration);
    const actualEnergyGained = newEnergy - currentEnergy;

    // If already at max energy, don't waste food
    if (actualEnergyGained === 0) {
      return NextResponse.json(
        { error: "Energy already at maximum" },
        { status: 400 }
      );
    }

    // Start a transaction to deduct food and restore energy
    // Deduct 1 food from inventory
    const { error: inventoryError } = await supabase
      .from("user_inventory")
      .update({ quantity: foodItem.quantity - 1 })
      .eq("id", foodItem.id);

    if (inventoryError) {
      console.error("Error updating inventory:", inventoryError);
      return NextResponse.json(
        { error: "Failed to consume food" },
        { status: 500 }
      );
    }

    // Update user energy
    const { error: energyError } = await supabase
      .from("users")
      .update({
        energy: newEnergy,
        energy_updated_at: now.toISOString(),
      })
      .eq("id", userProfile.id);

    if (energyError) {
      console.error("Error updating energy:", energyError);
      // Rollback inventory change
      await supabase
        .from("user_inventory")
        .update({ quantity: foodItem.quantity })
        .eq("id", foodItem.id);
      return NextResponse.json(
        { error: "Failed to restore energy" },
        { status: 500 }
      );
    }

    // Record morale boost
    try {
      await recordMoraleEvent({
        userId: userProfile.id,
        eventType: "custom",
        eventTrigger: "food:consumed",
        moraleChange: MORALE_BOOST,
        metadata: {
          food_quality: qualityTier,
          energy_restored: actualEnergyGained,
        },
      });
    } catch (moraleErr) {
      console.error("Failed to record food morale event:", moraleErr);
      // Don't fail the entire request if morale update fails
    }

    return NextResponse.json({
      success: true,
      energy: newEnergy,
      energyGained: actualEnergyGained,
      foodQuality: qualityTier,
      moraleBoost: MORALE_BOOST,
      remainingFood: foodItem.quantity - 1,
    });
  } catch (error) {
    console.error("Error eating food:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

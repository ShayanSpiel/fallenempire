#!/usr/bin/env node

/**
 * Script to verify and seed test resources for company creation
 * Usage: node seed-test-resources.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("🔍 Checking resources...");

  // Check if resources exist
  const { data: resources, error: resourcesError } = await supabase
    .from("resources")
    .select("id, key, name, category");

  if (resourcesError) {
    console.error("❌ Error fetching resources:", resourcesError);
    process.exit(1);
  }

  console.log(`✅ Found ${resources?.length || 0} resources:`);
  resources?.forEach((r) => console.log(`   - ${r.key} (${r.name})`));

  // Check if quality tiers exist
  const { data: qualities, error: qualitiesError } = await supabase
    .from("resource_qualities")
    .select("id, key, name, quality_level");

  if (qualitiesError) {
    console.error("❌ Error fetching quality tiers:", qualitiesError);
    process.exit(1);
  }

  console.log(`\n✅ Found ${qualities?.length || 0} quality tiers:`);
  qualities?.forEach((q) => console.log(`   - ${q.key} (Level ${q.quality_level})`));

  // Get common quality ID
  const commonQuality = qualities?.find((q) => q.key === "common");
  if (!commonQuality) {
    console.error("❌ Common quality tier not found");
    process.exit(1);
  }

  // Get first user
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, username")
    .limit(1);

  if (usersError || !users || users.length === 0) {
    console.error("❌ No users found in database");
    process.exit(1);
  }

  const testUser = users[0];
  console.log(`\n👤 Testing with user: ${testUser.username}`);

  // Check current inventory
  const { data: currentInventory } = await supabase
    .from("user_inventory")
    .select("resource_id, quantity")
    .eq("user_id", testUser.id);

  console.log(
    `\n📦 Current inventory for ${testUser.username}:`
  );
  if (!currentInventory || currentInventory.length === 0) {
    console.log("   (empty)");
  } else {
    for (const inv of currentInventory) {
      const resource = resources?.find((r) => r.id === inv.resource_id);
      console.log(`   - ${resource?.key || "unknown"}: ${inv.quantity}`);
    }
  }

  // Seed resources for company creation
  console.log(`\n🌱 Seeding test resources...`);

  const resourcesToAdd = [
    { key: "grain", quantity: 20 },
    { key: "iron", quantity: 20 },
    { key: "oil", quantity: 10 },
  ];

  for (const { key, quantity } of resourcesToAdd) {
    const resource = resources?.find((r) => r.key === key);
    if (!resource) {
      console.log(`⚠️  Skipping ${key} - resource not found`);
      continue;
    }

    // Insert or update inventory
    const { error } = await supabase.from("user_inventory").upsert(
      {
        user_id: testUser.id,
        resource_id: resource.id,
        quality_id: commonQuality.id,
        quantity: quantity,
      },
      { onConflict: "user_id,resource_id,quality_id" }
    );

    if (error) {
      console.error(`❌ Error adding ${key}:`, error);
    } else {
      console.log(`✅ Added ${quantity} x ${key}`);
    }
  }

  // Show final inventory
  const { data: finalInventory } = await supabase
    .from("user_inventory")
    .select("resource_id, quantity")
    .eq("user_id", testUser.id);

  console.log(`\n📦 Final inventory for ${testUser.username}:`);
  if (!finalInventory || finalInventory.length === 0) {
    console.log("   (empty)");
  } else {
    for (const inv of finalInventory) {
      const resource = resources?.find((r) => r.id === inv.resource_id);
      console.log(`   - ${resource?.key || "unknown"}: ${inv.quantity}`);
    }
  }

  console.log("\n✨ Setup complete! You can now try creating companies.");
}

main().catch(console.error);

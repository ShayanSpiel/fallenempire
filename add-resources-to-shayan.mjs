import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Find Shayan user
  const { data: users } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", "Shayan")
    .single();

  if (!users) {
    console.error("❌ User Shayan not found");
    process.exit(1);
  }

  console.log(`👤 User: ${users.username} (ID: ${users.id})`);

  // Get resource IDs
  const { data: resources } = await supabase
    .from("resources")
    .select("id, key")
    .in("key", ["grain", "iron", "oil"]);

  // Get common quality
  const { data: quality } = await supabase
    .from("resource_qualities")
    .select("id")
    .eq("key", "common")
    .single();

  console.log(`\nAdding resources...`);

  for (const resource of resources) {
    const quantities = {
      grain: 20,
      iron: 20,
      oil: 10,
    };

    const { error } = await supabase
      .from("user_inventory")
      .upsert(
        {
          user_id: users.id,
          resource_id: resource.id,
          quality_id: quality.id,
          quantity: quantities[resource.key],
        },
        { onConflict: "user_id,resource_id,quality_id" }
      );

    if (error) {
      console.error(`❌ Error adding ${resource.key}:`, error);
    } else {
      console.log(`✅ Added ${quantities[resource.key]} x ${resource.key}`);
    }
  }

  // Show final inventory
  const { data: finalInventory } = await supabase
    .from("user_inventory")
    .select("resources!inner(key), quantity")
    .eq("user_id", users.id);

  console.log(`\n📦 Final inventory:`);
  finalInventory.forEach((inv) => {
    console.log(`   - ${inv.resources.key}: ${inv.quantity}`);
  });
}

main().catch(console.error);

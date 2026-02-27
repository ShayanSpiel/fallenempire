/**
 * Seed Battle Pass Data
 * Run this after applying the battle pass migrations to verify everything works
 * Usage: node seed-battlepass.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedBattlePass() {
  console.log("🎮 Seeding Battle Pass data...\n");

  try {
    // Check if season exists
    const { data: seasons, error: seasonError } = await supabase
      .from("battle_pass_seasons")
      .select("*")
      .eq("is_active", true)
      .limit(1);

    if (seasonError) {
      console.error("❌ Error checking seasons:", seasonError.message);
      console.log("\n💡 Make sure you've run the battle pass migrations first!");
      console.log("   Run: psql <your-db-url> -f supabase/migrations/20270227_battle_pass_system.sql");
      process.exit(1);
    }

    if (seasons && seasons.length > 0) {
      console.log("✅ Active battle pass season found!");
      console.log(`   Season: ${seasons[0].name}`);
      console.log(`   Tiers: ${seasons[0].total_tiers}`);
      console.log(`   XP per tier: ${seasons[0].xp_per_tier}`);
      console.log(`   Ends: ${new Date(seasons[0].end_date).toLocaleDateString()}`);

      // Check tier count
      const { data: tiers, error: tierError } = await supabase
        .from("battle_pass_tiers")
        .select("*")
        .eq("season_id", seasons[0].id);

      if (!tierError && tiers) {
        console.log(`\n✅ ${tiers.length} tier rewards configured`);
        const freeTiers = tiers.filter((t) => t.tier_type === "free").length;
        const keeperTiers = tiers.filter((t) => t.tier_type === "keeper").length;
        console.log(`   Free: ${freeTiers} rewards`);
        console.log(`   Keeper: ${keeperTiers} rewards`);
      }

      // Test awarding XP to current user
      console.log("\n🧪 Testing Battle Pass XP system...");

      // Get first user to test with
      const { data: users } = await supabase
        .from("users")
        .select("id, username")
        .limit(1);

      if (users && users.length > 0) {
        const testUser = users[0];
        console.log(`   Testing with user: ${testUser.username}`);

        // Award 1000 test XP
        const { data: xpResult, error: xpError } = await supabase.rpc(
          "award_battle_pass_xp",
          {
            p_user_id: testUser.id,
            p_xp_amount: 1000,
            p_source: "test",
          }
        );

        if (xpError) {
          console.log("   ⚠️  XP test failed:", xpError.message);
        } else if (xpResult) {
          console.log("   ✅ XP awarded successfully!");
          console.log(`   Old XP: ${xpResult.old_xp}`);
          console.log(`   New XP: ${xpResult.new_xp}`);
          console.log(`   Current Tier: ${xpResult.new_tier}`);
          if (xpResult.unlocked_tiers > 0) {
            console.log(`   🎉 Unlocked ${xpResult.unlocked_tiers} new tier(s)!`);
          }
        }
      }

      console.log("\n✅ Battle Pass system is ready!");
      console.log("\n📝 Next steps:");
      console.log("   1. Visit /feed to see the battle pass banner");
      console.log("   2. Visit /battlepass for the full view");
      console.log("   3. Complete missions to earn XP");
      console.log("   4. Log in daily for 100 bonus XP");
    } else {
      console.log("❌ No active battle pass season found!");
      console.log("\n💡 The migration might not have run successfully.");
      console.log("   Make sure to run both migrations:");
      console.log("   1. supabase/migrations/20270227_battle_pass_system.sql");
      console.log("   2. supabase/migrations/20270227_integrate_battlepass_xp.sql");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

seedBattlePass();

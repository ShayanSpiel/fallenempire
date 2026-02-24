/**
 * Script to add coherence column to users table
 * Run with: npx tsx scripts/add-coherence-column.ts
 */

import { supabaseAdmin } from "../lib/supabaseAdmin";

async function main() {
  console.log("Adding coherence column to users table...");

  try {
    // Check if column already exists
    const { data: checkData, error: checkError } = await supabaseAdmin
      .from("users")
      .select("coherence")
      .limit(1);

    if (!checkError) {
      console.log("✅ Coherence column already exists!");
      return;
    }

    // Apply migration using SQL
    const migrationSQL = `
      -- Add coherence column to users table
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS coherence NUMERIC DEFAULT 50 NOT NULL CHECK (coherence >= 0 AND coherence <= 100);

      -- Create index for performance
      CREATE INDEX IF NOT EXISTS idx_users_coherence ON public.users(coherence);

      -- Set initial values for existing users (default 50 = neutral coherence)
      UPDATE public.users SET coherence = 50 WHERE coherence IS NULL;
    `;

    const { error } = await supabaseAdmin.rpc("exec_sql", { sql: migrationSQL });

    if (error) {
      console.error("❌ Error adding coherence column:", error);

      // Try alternative: direct column addition (might work with service_role)
      console.log("Trying alternative approach...");
      const { error: altError } = await supabaseAdmin
        .from("users")
        .update({ coherence: 50 })
        .eq("id", "non-existent-id"); // This will fail but might reveal column status

      console.error("Alt error:", altError);
      process.exit(1);
    }

    console.log("✅ Successfully added coherence column!");
    console.log("✅ All users set to default coherence of 50");
  } catch (err) {
    console.error("❌ Unexpected error:", err);
    process.exit(1);
  }
}

main();

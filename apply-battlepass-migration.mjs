import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  console.log("🚀 Applying Battle Pass migration...");

  const migrationPath = path.join(
    __dirname,
    "supabase",
    "migrations",
    "20270227_battle_pass_system.sql"
  );

  const sql = fs.readFileSync(migrationPath, "utf8");

  try {
    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct query
      const { error: directError } = await supabase.from("_temp").select().limit(0);

      // Split and execute statements
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      for (const statement of statements) {
        if (statement) {
          console.log(`Executing: ${statement.substring(0, 60)}...`);
          const { error: execError } = await supabase.rpc("exec", {
            query: statement + ";",
          });

          if (execError) {
            console.error("Error executing statement:", execError);
            throw execError;
          }
        }
      }
    }

    console.log("✅ Battle Pass migration applied successfully!");

    // Verify
    const { data: seasons, error: verifyError } = await supabase
      .from("battle_pass_seasons")
      .select("*");

    if (verifyError) {
      console.error("Verification failed:", verifyError);
    } else {
      console.log(`✅ Verified: ${seasons?.length || 0} season(s) created`);
    }

    const { data: tiers } = await supabase
      .from("battle_pass_tiers")
      .select("count");

    console.log(`✅ Verified: ${tiers?.length || 0} tier(s) created`);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

applyMigration();

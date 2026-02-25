import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users } = await supabase
    .from("users")
    .select("id, username")
    .limit(1);

  const user = users[0];
  console.log(`Adding gold to user: ${user.username}`);

  // Add 2000 gold
  const { data: result, error } = await supabase.rpc(
    "add_gold_enhanced",
    {
      p_user_id: user.id,
      p_amount: 2000,
      p_transaction_type: "admin_grant",
      p_description: "Gold grant for testing",
      p_metadata: {},
      p_scope: "personal",
    }
  );

  if (error) {
    console.error("❌ Error:", error.message);
  } else {
    console.log("✅ Gold added!");
    console.log(`New balance: ${result.new_balance}`);
  }
}

main().catch(console.error);

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
  console.log(`Testing with user: ${user.username}`);

  // Get company type
  const { data: companyTypes } = await supabase
    .from("company_types")
    .select("*")
    .eq("key", "farm")
    .single();

  console.log(`\nCompany type: ${companyTypes.key}`);
  console.log(`Build cost gold: ${companyTypes.build_cost_gold}`);

  // Check wallet
  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("gold_coins")
    .eq("user_id", user.id)
    .eq("currency_type", "gold")
    .single();

  console.log(`Current gold: ${wallet.gold_coins}`);

  // Try deduct with valid transaction type
  console.log(`\nAttempting to deduct ${companyTypes.build_cost_gold} gold for company_creation...`);
  const { data: result, error: rpcError } = await supabase.rpc(
    "deduct_gold_enhanced",
    {
      p_user_id: user.id,
      p_amount: companyTypes.build_cost_gold,
      p_transaction_type: "company_creation",
      p_description: `Company creation: Test Farm`,
      p_metadata: {
        company_type_id: companyTypes.id,
        company_name: "Test Farm",
      },
      p_scope: "personal",
    }
  );

  if (rpcError) {
    console.error("❌ RPC Error:", rpcError.message);
  } else {
    console.log("✅ RPC Success:", result);
  }
}

main().catch(console.error);

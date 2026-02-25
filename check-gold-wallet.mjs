#!/usr/bin/env node

/**
 * Script to check user's gold wallet status
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
  // Get first user
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, username, auth_id")
    .limit(1);

  if (usersError || !users || users.length === 0) {
    console.error("❌ No users found");
    process.exit(1);
  }

  const testUser = users[0];
  console.log(`👤 User: ${testUser.username} (ID: ${testUser.id})`);

  // Check wallet
  const { data: wallet, error: walletError } = await supabase
    .from("user_wallets")
    .select("*")
    .eq("user_id", testUser.id)
    .eq("currency_type", "gold")
    .single();

  if (walletError) {
    console.log("❌ Error fetching wallet:", walletError);
  } else if (!wallet) {
    console.log("❌ No gold wallet found for user!");
  } else {
    console.log(`✅ Gold Wallet Found:`);
    console.log(`   - ID: ${wallet.id}`);
    console.log(`   - Balance: ${wallet.gold_coins}`);
    console.log(`   - Created: ${wallet.created_at}`);
  }

  // Try to deduct gold
  console.log(`\n🧪 Testing gold deduction (50 gold)...`);
  const { data: result, error: rpcError } = await supabase.rpc(
    "deduct_gold_enhanced",
    {
      p_user_id: testUser.id,
      p_amount: 50,
      p_transaction_type: "test",
      p_description: "Test deduction",
      p_metadata: {},
      p_scope: "personal",
    }
  );

  if (rpcError) {
    console.error("❌ RPC Error:", rpcError);
  } else {
    console.log("✅ RPC Result:", result);
  }

  // Check final balance
  const { data: finalWallet } = await supabase
    .from("user_wallets")
    .select("gold_coins")
    .eq("user_id", testUser.id)
    .eq("currency_type", "gold")
    .single();

  if (finalWallet) {
    console.log(`\n💰 Final Balance: ${finalWallet.gold_coins}`);
  }
}

main().catch(console.error);

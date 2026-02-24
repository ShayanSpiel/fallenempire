#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const migrations = [
  '20270212_fix_apply_to_job_trade_history.sql',
  '20270213_enforce_community_currency_only.sql',
  '20270214_enforce_location_on_currency_exchange.sql',
];

async function applyMigration(filename) {
  try {
    console.log(`\n📄 Applying migration: ${filename}`);
    const sql = readFileSync(`supabase/migrations/${filename}`, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error(`❌ Error applying ${filename}:`, error.message);
      return false;
    }

    console.log(`✅ Successfully applied: ${filename}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to apply ${filename}:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting migration application...\n');

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.log('\n⚠️  Migration failed. Please check the errors above.');
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations applied successfully!');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

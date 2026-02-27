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
  '20270226_company_level_quality_bonuses.sql',
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
  console.log('🚀 Starting migration application for company quality bonuses...\n');

  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (!success) {
      console.log('\n⚠️  Migration failed. Please check the errors above.');
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations applied successfully!');
  console.log('\n📊 Company quality bonuses are now enabled:');
  console.log('   - Level 1: 100% Common quality');
  console.log('   - Level 2: 60% Common, 40% Uncommon');
  console.log('   - Level 3: 40% Common, 40% Uncommon, 20% Rare');
  console.log('   - Level 4: 20% Uncommon, 50% Rare, 30% Epic');
  console.log('   - Level 5: 10% Rare, 40% Epic, 50% Legendary');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

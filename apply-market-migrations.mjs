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
  '20270215_fix_perform_work_wallet_creation.sql',
];

async function executeSqlDirect(sql) {
  // Split by semicolons but be careful with function bodies
  const statements = sql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/) // Split on semicolons not inside quotes
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;

    try {
      const { error } = await supabase.rpc('exec', { query: statement });
      if (error) {
        // Try direct query if rpc fails
        const { error: directError } = await supabase.from('_query').select('*').limit(0);
        if (directError) {
          console.warn('Could not execute via RPC, statement may need manual application');
        }
      }
    } catch (err) {
      // Silent catch - will need manual application
    }
  }
}

async function main() {
  console.log('🚀 Market & Currency System Migrations\n');
  console.log('⚠️  These migrations must be applied manually via Supabase Dashboard SQL Editor:\n');

  console.log('📋 Instructions:');
  console.log('1. Go to Supabase Dashboard → SQL Editor');
  console.log('2. Copy and paste each migration file content');
  console.log('3. Execute in order:\n');

  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i];
    const filePath = `supabase/migrations/${migration}`;

    console.log(`\n${i + 1}. ${migration}`);
    console.log(`   File: ${filePath}`);

    const sql = readFileSync(filePath, 'utf8');
    const lines = sql.split('\n').length;
    console.log(`   Size: ${lines} lines`);
  }

  console.log('\n\n📝 Quick Summary:');
  console.log('   • Migration 1: Fixes job application trade_history schema error');
  console.log('   • Migration 2: Enforces community currency only (removes gold)');
  console.log('   • Migration 3: Adds location validation to currency exchange');
  console.log('   • Migration 4: ⚠️  CRITICAL - Fixes wallet creation with NULL currency_id');

  console.log('\n\n✅ Alternative: Use Supabase CLI if available:');
  console.log('   npx supabase db push\n');

  console.log('📖 Full documentation: MARKET_CURRENCY_SYSTEM_COMPLETE.md\n');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

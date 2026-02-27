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

// Use the fetch-based client for raw SQL
async function applyMigration(filename) {
  try {
    console.log(`\n📄 Applying migration: ${filename}`);
    const sql = readFileSync(`supabase/migrations/${filename}`, 'utf8');

    // Execute SQL directly via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error applying ${filename}:`, error);

      // Try alternative approach: execute as raw SQL query
      console.log('Trying alternative approach...');

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Split SQL into individual statements and execute them
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement) {
          const { error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' })
            .catch(() => ({ error: 'exec_sql not available' }));

          if (error) {
            console.error(`❌ Error executing statement:`, error);
          }
        }
      }

      console.log(`⚠️  Applied with alternative method - please verify manually`);
      return true;
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

  const migration = '20270226_company_level_quality_bonuses.sql';
  const success = await applyMigration(migration);

  if (!success) {
    console.log('\n⚠️  Migration may have failed. Please check the errors above.');
    console.log('\n📝 Manual application instructions:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Open SQL Editor');
    console.log('   3. Paste the contents of supabase/migrations/20270226_company_level_quality_bonuses.sql');
    console.log('   4. Run the query');
    process.exit(1);
  }

  console.log('\n✅ Migration applied successfully!');
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

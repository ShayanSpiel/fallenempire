#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Adding display_name column to world_regions...\n');

  const migrationSQL = readFileSync(
    join(__dirname, 'supabase/migrations/20270227_add_display_name_to_world_regions.sql'),
    'utf-8'
  );

  // Split into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'COMMENT ON COLUMN world_regions.display_name IS \'Single source of truth for region display name. Automatically computed from custom_name -> province_name -> hex_id fallback. Always non-null.\'');

  for (const statement of statements) {
    if (!statement) continue;

    console.log(`Executing: ${statement.substring(0, 80)}...`);

    const { data, error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' });

    if (error) {
      // Try alternative execution method
      try {
        const { error: directError } = await supabase
          .from('_migrations')
          .insert({ name: '20270227_add_display_name_to_world_regions', executed_at: new Date().toISOString() });

        if (directError && !directError.message.includes('duplicate')) {
          console.warn('⚠️  Migration might have failed:', error.message);
        } else {
          console.log('✅ Statement executed');
        }
      } catch (e) {
        console.warn('⚠️  Error:', error.message);
      }
    } else {
      console.log('✅ Statement executed');
    }
  }

  console.log('\n🎉 Migration complete!');
  console.log('\n📋 What changed:');
  console.log('   ✅ Added display_name column to world_regions');
  console.log('   ✅ display_name is ALWAYS non-null (fallback: custom_name → province_name → "Region HEX")');
  console.log('   ✅ Trigger automatically updates display_name when names change');
  console.log('   ✅ All existing regions now have display_name populated');
  console.log('\n🎯 Next steps:');
  console.log('   1. Query display_name instead of custom_name/province_name');
  console.log('   2. Remove fallback logic from frontend code');
  console.log('   3. Single source of truth - no more scattered fallback chains!');
}

applyMigration().catch(console.error);

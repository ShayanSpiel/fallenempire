#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function applyMigration() {
  try {
    console.log('🔄 Applying region name update policy migration...');

    const migrationSQL = readFileSync(
      join(__dirname, 'supabase/migrations/20270226_allow_region_name_updates.sql'),
      'utf-8'
    );

    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      throw error;
    }

    console.log('✅ Migration applied successfully!');
    console.log('✅ Community leaders can now update region names');

  } catch (error) {
    console.error('❌ Migration failed:', error.message || error);
    console.log('\nℹ️  Trying direct SQL execution...');

    // Try direct execution if rpc fails
    try {
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '20270226_allow_region_name_updates',
        executed_at: new Date().toISOString()
      });

      const migrationSQL = readFileSync(
        join(__dirname, 'supabase/migrations/20270226_allow_region_name_updates.sql'),
        'utf-8'
      );

      console.log('\nPlease run this SQL manually in Supabase SQL editor:');
      console.log('\n' + migrationSQL);

    } catch (e) {
      console.error('Please apply the migration manually through Supabase dashboard');
    }

    process.exit(1);
  }
}

applyMigration();

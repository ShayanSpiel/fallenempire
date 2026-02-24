#!/usr/bin/env node
/**
 * Fix Job Application Location Check
 *
 * This script applies the migration to fix location validation in job applications.
 * Previously it checked main_community_id instead of the user's actual location (current_hex).
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🔧 Applying job application location check fix...\n');

  try {
    // Read the migration file
    const migrationPath = join(__dirname, 'supabase/migrations/20270211_fix_job_application_location_check.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('\n');

    // Since we can't execute raw SQL through Supabase client easily,
    // let's just output the SQL for manual execution
    console.log('⚠️  Please execute the migration manually using one of these methods:');
    console.log('\n1. Using Supabase Dashboard:');
    console.log('   - Go to SQL Editor');
    console.log('   - Paste the SQL from: supabase/migrations/20270211_fix_job_application_location_check.sql');
    console.log('   - Run it');
    console.log('\n2. Using psql:');
    console.log('   psql <your-database-url> -f supabase/migrations/20270211_fix_job_application_location_check.sql');
    console.log('\n3. Using Supabase CLI:');
    console.log('   npx supabase db push');

  } catch (error) {
    console.error('❌ Failed to read migration:', error);
    process.exit(1);
  }
}

applyMigration().then(() => {
  console.log('\n✨ Migration file ready to apply!');
  process.exit(0);
});

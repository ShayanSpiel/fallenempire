#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('🔧 Fixing get_user_location function...');

  const migrationSQL = readFileSync(
    join(__dirname, 'supabase/migrations/20270227_fix_get_user_location.sql'),
    'utf-8'
  );

  console.log('📄 Executing migration...');

  const { error } = await supabase.rpc('exec_sql', { sql_string: migrationSQL });

  if (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  }

  console.log('✅ Migration executed successfully');
  console.log('✅ get_user_location() now returns raw custom_name and province_name');
  console.log('✅ Frontend can now properly display: custom_name → province_name → hex_id');
}

applyMigration().catch(console.error);

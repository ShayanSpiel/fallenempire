#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
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

async function setTestTiers() {
  console.log('🚀 Setting test user tiers...\n');

  const updates = [
    { username: 'Shayan', tier: 'omega' },
    { username: 'ASAD', tier: 'sigma' },
    { username: 'Apency', tier: 'omega' },
  ];

  for (const { username, tier } of updates) {
    console.log(`Setting ${username} to ${tier}...`);

    const { data, error } = await supabase
      .from('users')
      .update({ user_tier: tier })
      .eq('username', username)
      .select();

    if (error) {
      console.error(`  ❌ Error updating ${username}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`  ✅ ${username} is now ${tier}`);
    } else {
      console.log(`  ⚠️  User ${username} not found`);
    }
  }

  console.log('\n🎉 Done!');
}

setTestTiers().catch(console.error);

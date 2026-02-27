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

async function checkDisplayName() {
  console.log('🔍 Checking if display_name column exists...\n');

  // Check if display_name column exists
  const { data: regions, error } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name, display_name')
    .limit(5);

  if (error) {
    if (error.message.includes('display_name')) {
      console.log('❌ display_name column does NOT exist yet');
      console.log('   You need to run the SQL in Supabase SQL Editor!');
      return;
    }
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ display_name column EXISTS!\n');
  console.log('Sample data:');
  console.table(regions);

  // Check battles pointing to non-existent regions
  console.log('\n🔍 Checking for battles with invalid hex_ids...\n');

  const { data: allBattles } = await supabase
    .from('battles')
    .select('id, target_hex_id, status')
    .order('created_at', { ascending: false })
    .limit(20);

  const battleHexIds = [...new Set(allBattles?.map(b => b.target_hex_id) || [])];

  console.log(`Found ${battleHexIds.length} unique battle hex locations`);

  for (const hexId of battleHexIds) {
    const { data: region, error: regionError } = await supabase
      .from('world_regions')
      .select('hex_id, custom_name, province_name, display_name')
      .eq('hex_id', hexId)
      .single();

    if (regionError || !region) {
      console.log(`❌ Battle hex ${hexId} - REGION DOES NOT EXIST IN world_regions!`);

      // Check how many battles point to this
      const { count } = await supabase
        .from('battles')
        .select('*', { count: 'exact', head: true })
        .eq('target_hex_id', hexId);

      console.log(`   ${count} battle(s) pointing to this non-existent region`);
    } else {
      const name = region.display_name || region.custom_name || 'NO NAME';
      console.log(`✅ ${hexId} → "${name}"`);
    }
  }
}

checkDisplayName().catch(console.error);

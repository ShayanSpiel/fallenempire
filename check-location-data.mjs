#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
  console.log('🔍 Checking location data...\n');

  // 1. Check a sample of world_regions data
  console.log('📊 Sample world_regions data:');
  const { data: regions, error: regionsError } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name')
    .limit(10);

  if (regionsError) {
    console.error('❌ Error fetching regions:', regionsError);
  } else {
    console.table(regions);
  }

  // 2. Check user location
  console.log('\n👤 Checking your current location:');
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('id, current_hex')
      .eq('auth_id', user.id)
      .single();

    console.log('Your user ID:', profile?.id);
    console.log('Your current_hex:', profile?.current_hex);

    if (profile?.current_hex) {
      // Check the region data for your hex
      const { data: yourRegion } = await supabase
        .from('world_regions')
        .select('hex_id, custom_name, province_name')
        .eq('hex_id', profile.current_hex)
        .single();

      console.log('\n🗺️  Your region data:');
      console.log(yourRegion);

      // Test the RPC function
      console.log('\n🔧 Testing get_user_location RPC:');
      const { data: locationData, error: rpcError } = await supabase
        .rpc('get_user_location', { p_user_id: profile.id });

      if (rpcError) {
        console.error('❌ RPC Error:', rpcError);
      } else {
        console.log('RPC Response:');
        console.log(locationData);
      }
    }
  }

  // 3. Check battles data
  console.log('\n⚔️  Sample battles data:');
  const { data: battles, error: battlesError } = await supabase
    .from('battles')
    .select('id, target_hex_id, status')
    .limit(5);

  if (battlesError) {
    console.error('❌ Error fetching battles:', battlesError);
  } else {
    for (const battle of battles || []) {
      const { data: battleRegion } = await supabase
        .from('world_regions')
        .select('hex_id, custom_name, province_name')
        .eq('hex_id', battle.target_hex_id)
        .single();

      console.log(`\nBattle ${battle.id}:`);
      console.log('  target_hex_id:', battle.target_hex_id);
      console.log('  custom_name:', battleRegion?.custom_name);
      console.log('  province_name:', battleRegion?.province_name);
    }
  }
}

checkData().catch(console.error);

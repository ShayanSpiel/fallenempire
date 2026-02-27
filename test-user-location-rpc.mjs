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

async function testRPC() {
  console.log('🧪 Testing get_user_location RPC function...\n');

  // Get a user with a known location
  const { data: userWithLocation } = await supabase
    .from('users')
    .select('id, current_hex')
    .not('current_hex', 'is', null)
    .limit(1)
    .single();

  if (!userWithLocation) {
    console.log('❌ No users with locations found');
    return;
  }

  console.log('Testing with user:', userWithLocation.id);
  console.log('User current_hex:', userWithLocation.current_hex);

  // Get the actual region data
  const { data: regionData } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name')
    .eq('hex_id', userWithLocation.current_hex)
    .single();

  console.log('\n📍 Direct region data from world_regions:');
  console.log('  hex_id:', regionData?.hex_id);
  console.log('  custom_name:', regionData?.custom_name);
  console.log('  province_name:', regionData?.province_name);

  // Call the RPC function
  const { data: rpcResult, error } = await supabase
    .rpc('get_user_location', { p_user_id: userWithLocation.id });

  if (error) {
    console.error('\n❌ RPC Error:', error);
    return;
  }

  console.log('\n🔧 RPC function result:');
  console.log(JSON.stringify(rpcResult, null, 2));

  // Check if the RPC is returning raw values or computed fallback
  if (rpcResult.custom_name && !regionData?.custom_name && !regionData?.province_name) {
    console.log('\n❌ BUG STILL EXISTS: RPC is computing fallback in custom_name field');
    console.log('   The function is still using the OLD version');
  } else if (rpcResult.custom_name === regionData?.custom_name) {
    console.log('\n✅ SUCCESS: RPC is returning RAW custom_name value');
    console.log('   The function has been updated correctly');
  } else {
    console.log('\n⚠️  UNEXPECTED: RPC result doesn\'t match expected behavior');
  }
}

testRPC().catch(console.error);

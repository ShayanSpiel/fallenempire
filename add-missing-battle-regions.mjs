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

async function addMissingRegions() {
  console.log('🔍 Finding all battles with missing regions...\n');

  // Get all unique battle hex_ids
  const { data: allBattles } = await supabase
    .from('battles')
    .select('target_hex_id')
    .not('target_hex_id', 'is', null);

  const allHexIds = [...new Set(allBattles?.map(b => b.target_hex_id) || [])];
  console.log(`Found ${allHexIds.length} unique hex_ids from battles`);

  // Get all existing regions
  const { data: existingRegions } = await supabase
    .from('world_regions')
    .select('hex_id');

  const existingHexIds = new Set(existingRegions?.map(r => r.hex_id) || []);
  console.log(`Found ${existingHexIds.size} existing regions in world_regions`);

  // Find missing ones
  const missingHexIds = allHexIds.filter(hexId => !existingHexIds.has(hexId));

  if (missingHexIds.length === 0) {
    console.log('\n✅ All battle hex_ids exist in world_regions!');
    return;
  }

  console.log(`\n❌ Found ${missingHexIds.length} missing regions:\n`);
  missingHexIds.forEach(hexId => console.log(`   - ${hexId}`));

  console.log('\n🔧 Adding missing regions to world_regions...\n');

  for (const hexId of missingHexIds) {
    const regionData = {
      hex_id: hexId,
      custom_name: `Region ${hexId}`,
      province_name: null,
      display_name: `Region ${hexId}`,
      owner_community_id: null,
      fortification_level: 0,
      resource_yield: 0,
    };

    console.log(`   Adding ${hexId}...`);

    const { error } = await supabase
      .from('world_regions')
      .insert(regionData);

    if (error) {
      console.error(`   ❌ Error adding ${hexId}:`, error.message);
    } else {
      console.log(`   ✅ Added ${hexId}`);
    }
  }

  console.log('\n✅ All missing regions have been added!');
  console.log('   Refresh your browser to see the changes.');
}

addMissingRegions().catch(console.error);

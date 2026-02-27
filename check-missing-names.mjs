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

async function checkMissingNames() {
  console.log('🔍 Checking for regions without names...\n');

  // Get all regions without custom_name
  const { data: missingRegions, error } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name')
    .or('custom_name.is.null,custom_name.eq.');

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`Found ${missingRegions?.length || 0} regions without custom_name:\n`);

  if (missingRegions && missingRegions.length > 0) {
    console.table(missingRegions.slice(0, 20)); // Show first 20
    console.log(`\n...and ${Math.max(0, missingRegions.length - 20)} more`);
  }

  // Check active battles pointing to regions without names
  console.log('\n⚔️  Active battles with missing region names:');
  const { data: activeBattles } = await supabase
    .from('battles')
    .select('id, target_hex_id, status')
    .eq('status', 'active');

  if (activeBattles) {
    for (const battle of activeBattles) {
      const { data: region } = await supabase
        .from('world_regions')
        .select('hex_id, custom_name, province_name')
        .eq('hex_id', battle.target_hex_id)
        .single();

      if (!region?.custom_name && !region?.province_name) {
        console.log(`  Battle ${battle.id.slice(0, 8)}... → Hex ${battle.target_hex_id} (NO NAME)`);
      }
    }
  }
}

checkMissingNames().catch(console.error);

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

async function fixMissingNames() {
  console.log('🔧 Fixing regions without names...\n');

  // Get all regions without custom_name
  const { data: missingRegions, error } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name')
    .or('custom_name.is.null,custom_name.eq.');

  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  console.log(`Found ${missingRegions?.length || 0} regions to fix\n`);

  if (!missingRegions || missingRegions.length === 0) {
    console.log('✅ All regions have names!');
    return;
  }

  for (const region of missingRegions) {
    // Set a default name based on hex_id
    const defaultName = `Region ${region.hex_id}`;

    console.log(`Updating ${region.hex_id} → "${defaultName}"`);

    const { error: updateError } = await supabase
      .from('world_regions')
      .update({
        custom_name: defaultName
      })
      .eq('hex_id', region.hex_id);

    if (updateError) {
      console.error(`  ❌ Error updating ${region.hex_id}:`, updateError.message);
    } else {
      console.log(`  ✅ Updated`);
    }
  }

  console.log('\n✅ All missing region names have been fixed!');
  console.log('   Refresh your browser to see the changes.');
}

fixMissingNames().catch(console.error);

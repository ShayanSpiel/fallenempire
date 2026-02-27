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

async function checkNames() {
  console.log('🔍 Checking display_name vs custom_name...\n');

  const { data: regions } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name, display_name')
    .order('hex_id');

  if (!regions) {
    console.log('❌ No regions found');
    return;
  }

  console.log(`Total regions: ${regions.length}\n`);

  // Find regions where display_name doesn't match custom_name
  const mismatched = regions.filter(r => {
    const shouldBe = r.custom_name || r.province_name || `Region ${r.hex_id}`;
    return r.display_name !== shouldBe;
  });

  if (mismatched.length > 0) {
    console.log(`❌ Found ${mismatched.length} regions with incorrect display_name:\n`);
    console.table(mismatched.slice(0, 20));
  } else {
    console.log('✅ All display_names are correct!');
  }

  // Show some examples
  console.log('\n📋 Sample regions:');
  console.table(regions.slice(0, 10));
}

checkNames().catch(console.error);

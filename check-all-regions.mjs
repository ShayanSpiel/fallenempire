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

async function analyzeRegions() {
  console.log('🔍 Analyzing ALL regions...\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('world_regions')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Total regions: ${totalCount}`);

  // Get regions with custom_name
  const { count: withCustomName } = await supabase
    .from('world_regions')
    .select('*', { count: 'exact', head: true })
    .not('custom_name', 'is', null);

  console.log(`📊 Regions with custom_name: ${withCustomName}`);

  // Get regions with province_name
  const { count: withProvinceName } = await supabase
    .from('world_regions')
    .select('*', { count: 'exact', head: true })
    .not('province_name', 'is', null);

  console.log(`📊 Regions with province_name: ${withProvinceName}`);

  // Get regions with NO name at all
  const { count: withNoName } = await supabase
    .from('world_regions')
    .select('*', { count: 'exact', head: true })
    .is('custom_name', null)
    .is('province_name', null);

  console.log(`📊 Regions with NO name: ${withNoName}`);

  console.log('\n📈 Summary:');
  console.log(`   ${withCustomName} regions have names in custom_name`);
  console.log(`   ${withProvinceName} regions have names in province_name`);
  console.log(`   ${withNoName} regions have NO name at all (${((withNoName / totalCount) * 100).toFixed(1)}%)`);

  // Sample some regions to see the data quality
  console.log('\n📋 Sample regions:');
  const { data: samples } = await supabase
    .from('world_regions')
    .select('hex_id, custom_name, province_name')
    .limit(20);

  console.table(samples);
}

analyzeRegions().catch(console.error);

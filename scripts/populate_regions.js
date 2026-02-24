// scripts/populate_regions.js
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' }); // Load environment variables

// 1. Setup Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. Load Hex Data
const hexFilePath = path.join(__dirname, '../public/data/world-hexes.json');

async function populateRegions() {
  console.log('📦 Loading hex data from:', hexFilePath);
  
  let hexes;
  try {
    const rawData = fs.readFileSync(hexFilePath, 'utf8');
    hexes = JSON.parse(rawData);
  } catch (error) {
    console.error('❌ Failed to read world-hexes.json:', error.message);
    return;
  }

  console.log(`🔍 Found ${hexes.length} hexes. Starting import to 'world_regions'...`);

  // 3. Prepare Data (Batching to avoid timeouts)
  const batchSize = 100;
  let importedCount = 0;

  for (let i = 0; i < hexes.length; i += batchSize) {
    const batch = hexes.slice(i, i + batchSize).map((hex) => ({
      hex_id: hex.id,
      fortification_level: 1000, // Default value
      resource_yield: 10,       // Default value
      // owner_community_id is left null (neutral)
    }));

    const { error } = await supabase
      .from('world_regions')
      .upsert(batch, { onConflict: 'hex_id', ignoreDuplicates: true });

    if (error) {
      console.error(`❌ Error importing batch ${i}:`, error.message);
    } else {
      importedCount += batch.length;
      process.stdout.write(`\r🚀 Imported ${importedCount}/${hexes.length} regions...`);
    }
  }

  console.log('\n✅ Import complete!');
}

populateRegions();
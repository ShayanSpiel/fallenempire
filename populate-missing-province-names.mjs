#!/usr/bin/env node

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load hex data
console.log('📦 Loading hex data...');
const hexes = JSON.parse(readFileSync('./public/data/world-hexes.json', 'utf8'));
console.log(`✓ Loaded ${hexes.length} hexes\n`);

// Fetch GeoJSON data
const GEO_ADMIN1_URL = "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_1_states_provinces.geojson";

console.log('📥 Fetching GeoJSON data...');
const provincesRes = await fetch(GEO_ADMIN1_URL);

if (!provincesRes.ok) {
  console.error('❌ Failed to fetch GeoJSON data');
  process.exit(1);
}

const provincesGeoJSON = await provincesRes.json();
console.log(`✓ Loaded ${provincesGeoJSON.features.length} provinces\n`);

// Helper function
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getProvinceName(lon, lat, geojson) {
  for (const feature of geojson.features) {
    const { geometry, properties } = feature;
    if (!geometry || !properties) continue;

    let coords = [];
    if (geometry.type === 'Polygon') {
      coords = [geometry.coordinates[0]];
    } else if (geometry.type === 'MultiPolygon') {
      coords = geometry.coordinates.map(poly => poly[0]);
    }

    for (const ring of coords) {
      if (pointInPolygon([lon, lat], ring)) {
        return properties.name || properties.name_en || properties.NAME || null;
      }
    }
  }
  return null;
}

// Get regions with "Region XX-XX" format
console.log('🔍 Finding regions with generic names...\n');
const { data: regions } = await supabase
  .from('world_regions')
  .select('hex_id, custom_name')
  .like('custom_name', 'Region %');

console.log(`Found ${regions?.length || 0} regions to geocode\n`);

if (!regions || regions.length === 0) {
  console.log('✅ All regions already have proper names!');
  process.exit(0);
}

let updated = 0;
let notFound = 0;

for (const region of regions) {
  const hex = hexes.find(h => h.id === region.hex_id);
  if (!hex) {
    console.log(`⚠️  ${region.hex_id} - Not found in world-hexes.json`);
    notFound++;
    continue;
  }

  const [lon, lat] = hex.center;
  const provinceName = getProvinceName(lon, lat, provincesGeoJSON);

  if (provinceName) {
    console.log(`✅ ${region.hex_id} → ${provinceName}`);

    const { error } = await supabase
      .from('world_regions')
      .update({ custom_name: provinceName })
      .eq('hex_id', region.hex_id);

    if (error) {
      console.error(`   ❌ Error updating: ${error.message}`);
    } else {
      updated++;
    }
  } else {
    console.log(`⚠️  ${region.hex_id} - No province found (keeping generic name)`);
    notFound++;
  }
}

console.log('\n' + '='.repeat(60));
console.log(`✅ Updated ${updated} regions with real province names`);
console.log(`⚠️  ${notFound} regions kept generic names (not in any province)`);
console.log('='.repeat(60));
console.log('\n💡 display_name will auto-update via trigger!');
console.log('🔄 Refresh your browser to see the changes.');

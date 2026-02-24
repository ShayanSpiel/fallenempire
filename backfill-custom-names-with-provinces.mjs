import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('📦 Getting hexes...');
const { data: dbHexes } = await supabase.from('world_regions').select('hex_id');
console.log(`✓ ${dbHexes.length} hexes\n`);

const allHexes = JSON.parse(readFileSync('./public/data/world-hexes.json', 'utf8'));
const hexMap = new Map(allHexes.map(h => [h.id, h.center]));

async function geocodeProvince(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(url);
    const data = await res.json();

    // Get province/state name
    let province = data.principalSubdivision || data.localityInfo?.administrative?.[0]?.name || null;

    // Clean up
    if (province) {
      province = province.replace(/\s+(Province|State|Territory|Oblast|Region|Governorate|County)$/i, '').trim();
    }

    return province || data.countryName || null;
  } catch (err) {
    return null;
  }
}

console.log('🔄 Geocoding and updating ALL hexes...\n');
let updated = 0, skipped = 0;

for (let i = 0; i < dbHexes.length; i++) {
  const coords = hexMap.get(dbHexes[i].hex_id);
  if (!coords) { skipped++; continue; }

  const [lon, lat] = coords;
  const name = await geocodeProvince(lat, lon);

  if (i < 5) {
    console.log(`  ${dbHexes[i].hex_id} [${lon}, ${lat}] → ${name || 'NOT FOUND'}`);
  }

  if (name) {
    await supabase.from('world_regions').update({ custom_name: name }).eq('hex_id', dbHexes[i].hex_id);
    updated++;
  } else {
    skipped++;
  }

  // Rate limit
  await new Promise(r => setTimeout(r, 100));

  if ((i + 1) % 10 === 0) {
    process.stdout.write(`\r  ${i + 1}/${dbHexes.length} (${updated} updated, ${skipped} skipped)`);
  }
}

console.log(`\n\n✅ ${updated} updated, ${skipped} skipped\n`);

const { data: samples } = await supabase.from('world_regions').select('hex_id, custom_name').limit(20);
console.log('Samples:');
samples?.forEach(s => console.log(`  ${s.hex_id}: ${s.custom_name}`));

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import RBush from 'rbush';

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

// Fetch GeoJSON data (same as hex-map.tsx)
const GEO_ADMIN1_URL = "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_1_states_provinces.geojson";
const GEO_COUNTRIES_URL = "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson";

console.log('📥 Fetching GeoJSON data...');
const [provincesRes, countriesRes] = await Promise.all([
  fetch(GEO_ADMIN1_URL),
  fetch(GEO_COUNTRIES_URL)
]);

if (!provincesRes.ok || !countriesRes.ok) {
  console.error('❌ Failed to fetch GeoJSON data');
  process.exit(1);
}

const provincesGeoJSON = await provincesRes.json();
const countriesGeoJSON = await countriesRes.json();
console.log(`✓ Loaded ${provincesGeoJSON.features.length} provinces`);
console.log(`✓ Loaded ${countriesGeoJSON.features.length} countries\n`);

// Helper functions (same as hex-map.tsx)
function getStringProp(props, keys) {
  if (!props) return null;
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function normalizeIso2(val) {
  if (!val || typeof val !== 'string') return null;
  const cleaned = val.replace(/[^A-Za-z]/g, '').toUpperCase();
  return cleaned.length === 2 ? cleaned : null;
}

function normalizeProvinceName(name) {
  if (!name || typeof name !== 'string') return null;
  // Remove " Province", " State", etc. from end
  return name
    .replace(/\s+(Province|State|Territory|Region|Oblast|Krai|Prefecture|Department|District)$/i, '')
    .trim() || name;
}

// Build spatial index for provinces (same logic as hex-map.tsx)
console.log('🗺️  Building province spatial index...');
const provinceTree = new RBush();
for (const feature of provincesGeoJSON.features) {
  if (feature.geometry?.type === 'Polygon') {
    const coords = feature.geometry.coordinates[0];
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    provinceTree.insert({
      minX: Math.min(...lons),
      minY: Math.min(...lats),
      maxX: Math.max(...lons),
      maxY: Math.max(...lats),
      feature
    });
  } else if (feature.geometry?.type === 'MultiPolygon') {
    for (const poly of feature.geometry.coordinates) {
      const coords = poly[0];
      const lons = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      provinceTree.insert({
        minX: Math.min(...lons),
        minY: Math.min(...lats),
        maxX: Math.max(...lons),
        maxY: Math.max(...lats),
        feature
      });
    }
  }
}
console.log(`✓ Indexed ${provinceTree.all().length} province polygons\n`);

// Build country spatial index
console.log('🌍 Building country spatial index...');
const countryTree = new RBush();
for (const feature of countriesGeoJSON.features) {
  if (feature.geometry?.type === 'Polygon') {
    const coords = feature.geometry.coordinates[0];
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    countryTree.insert({
      minX: Math.min(...lons),
      minY: Math.min(...lats),
      maxX: Math.max(...lons),
      maxY: Math.max(...lats),
      feature
    });
  } else if (feature.geometry?.type === 'MultiPolygon') {
    for (const poly of feature.geometry.coordinates) {
      const coords = poly[0];
      const lons = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      countryTree.insert({
        minX: Math.min(...lons),
        minY: Math.min(...lats),
        maxX: Math.max(...lons),
        maxY: Math.max(...lats),
        feature
      });
    }
  }
}
console.log(`✓ Indexed ${countryTree.all().length} country polygons\n`);

// Point-in-polygon check (simplified ray casting)
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }

  return inside;
}

// Geocode a hex center to get province name
function geocodeHex(lon, lat) {
  const point = [lon, lat];

  // Check provinces first
  const provinceCandidates = provinceTree.search({
    minX: lon,
    minY: lat,
    maxX: lon,
    maxY: lat
  });

  for (const item of provinceCandidates) {
    const geom = item.feature.geometry;
    let polygons = [];

    if (geom.type === 'Polygon') {
      polygons = [geom.coordinates[0]];
    } else if (geom.type === 'MultiPolygon') {
      polygons = geom.coordinates.map(p => p[0]);
    }

    for (const poly of polygons) {
      if (pointInPolygon(point, poly)) {
        const props = item.feature.properties;
        const provinceName = getStringProp(props, [
          'name', 'NAME', 'name_en', 'NAME_EN',
          'postal', 'POSTAL', 'abbrev', 'ABBREV'
        ]);

        if (provinceName) {
          return normalizeProvinceName(provinceName);
        }
      }
    }
  }

  // Fallback to country name
  const countryCandidates = countryTree.search({
    minX: lon,
    minY: lat,
    maxX: lon,
    maxY: lat
  });

  for (const item of countryCandidates) {
    const geom = item.feature.geometry;
    let polygons = [];

    if (geom.type === 'Polygon') {
      polygons = [geom.coordinates[0]];
    } else if (geom.type === 'MultiPolygon') {
      polygons = geom.coordinates.map(p => p[0]);
    }

    for (const poly of polygons) {
      if (pointInPolygon(point, poly)) {
        const props = item.feature.properties;
        const countryName = getStringProp(props, [
          'name', 'NAME', 'name_en', 'NAME_EN',
          'admin', 'ADMIN', 'sovereignt', 'SOVEREIGNT'
        ]);

        if (countryName) {
          return countryName;
        }
      }
    }
  }

  return null;
}

// Backfill all hexes
console.log('🔄 Backfilling province names...\n');

let updated = 0;
let skipped = 0;
let errors = 0;

const BATCH_SIZE = 100;
for (let i = 0; i < hexes.length; i += BATCH_SIZE) {
  const batch = hexes.slice(i, i + BATCH_SIZE);
  const updates = [];

  for (const hex of batch) {
    const [lon, lat] = hex.center;
    const provinceName = geocodeHex(lon, lat);

    if (provinceName) {
      updates.push({
        hex_id: hex.id,
        province_name: provinceName
      });
    }
  }

  // Batch update
  if (updates.length > 0) {
    try {
      for (const update of updates) {
        const { error } = await supabase
          .from('world_regions')
          .update({ province_name: update.province_name })
          .eq('hex_id', update.hex_id);

        if (error) {
          console.error(`❌ Error updating ${update.hex_id}:`, error.message);
          errors++;
        } else {
          updated++;
        }
      }
    } catch (err) {
      console.error(`❌ Batch error:`, err.message);
      errors++;
    }
  }

  skipped += batch.length - updates.length;

  const progress = ((i + batch.length) / hexes.length * 100).toFixed(1);
  process.stdout.write(`\r  Progress: ${progress}% (${updated} updated, ${skipped} skipped, ${errors} errors)`);
}

console.log('\n\n✅ Backfill complete!');
console.log(`   Total hexes: ${hexes.length}`);
console.log(`   Updated: ${updated}`);
console.log(`   Skipped (no match): ${skipped}`);
console.log(`   Errors: ${errors}\n`);

// Verify
console.log('🔍 Verifying...');
const { data: sample, error: sampleError } = await supabase
  .from('world_regions')
  .select('hex_id, province_name')
  .not('province_name', 'is', null)
  .limit(10);

if (sampleError) {
  console.error('❌ Verification failed:', sampleError.message);
} else {
  console.log(`✓ Found ${sample.length} regions with province names`);
  console.log('\nSample regions:');
  for (const region of sample) {
    console.log(`  ${region.hex_id}: ${region.province_name}`);
  }
}

console.log('\n🎉 Province names are now loaded in the database!');
console.log('   They will display instantly everywhere without geocoding delays.\n');

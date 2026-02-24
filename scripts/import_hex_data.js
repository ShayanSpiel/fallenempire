// --- WARNING: THIS IS A ONE-TIME SCRIPT TO INITIALIZE YOUR MAP DATABASE ---

// 1. Standard Node.js library for file system paths
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 2. Load the hex data from your permanent JSON file
const hexDataPath = path.join(__dirname, '..', 'public', 'data', 'world-hexes.json');
let hexes;
try {
    const rawData = fs.readFileSync(hexDataPath, 'utf8');
    hexes = JSON.parse(rawData);
} catch (e) {
    console.error(`FATAL: Could not read hex data from ${hexDataPath}`);
    console.error(`Please ensure you have run the "BAKE MAP" step and placed world-hexes.json there.`);
    process.exit(1);
}

// 3. Configuration check: Ensure environment variables are set
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use the service key for secure, high-permission insertion (replace YOUR_SERVICE_ROLE_KEY_NAME)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("FATAL: Supabase environment variables missing.");
    console.error("Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
}

async function importHexagons() {
    console.log(`Starting import of ${hexes.length} hexagons...`);

    // Initialize Supabase client using the Service Role Key for admin rights
    const supabase = createClient(supabaseUrl, supabaseServiceKey); 

    const dataToInsert = hexes.map(hex => ({
        hex_id: hex.id,
        center_lon: hex.center[0],
        center_lat: hex.center[1],
        // Assuming all hexes in your JSON are land, adjust if you have ocean hexes too.
        is_land: true 
    }));

    // Perform a large batch insert
    const { error } = await supabase
        .from('hexagons')
        .insert(dataToInsert);

    if (error) {
        if (error.code === '23505') {
             console.error("Error 23505: Data already exists (hex_id conflict). You need to clear the 'hexagons' table before re-importing.");
        } else {
             console.error('Error importing hexagons:', error);
        }
        return;
    }

    console.log(`Successfully imported ${hexes.length} hexagons into the 'hexagons' table.`);
}

importHexagons();
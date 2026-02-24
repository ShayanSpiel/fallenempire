// scripts/import_regions.js
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" }); // Make sure you have dotenv installed or set env vars manually

const hexDataPath = path.join(__dirname, "..", "public", "data", "world-hexes.json");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importRegions() {
  console.log("Reading hex data...");
  let hexes;
  try {
    const rawData = fs.readFileSync(hexDataPath, "utf8");
    hexes = JSON.parse(rawData);
  } catch (e) {
    console.error("Could not read world-hexes.json", e);
    return;
  }

  console.log(`Found ${hexes.length} hexes. Preparing import...`);

  // Prepare batch data
  const batchSize = 100;
  const chunks = [];
  for (let i = 0; i < hexes.length; i += batchSize) {
    chunks.push(hexes.slice(i, i + batchSize));
  }

  let totalImported = 0;

  for (const chunk of chunks) {
    const rows = chunk.map((hex) => ({
      hex_id: hex.id,
      fortification_level: 1000,
      resource_yield: 10,
      // owner_community_id is left NULL (neutral) by default
    }));

    const { error } = await supabase
      .from("world_regions")
      .upsert(rows, { onConflict: "hex_id", ignoreDuplicates: true });

    if (error) {
      console.error("Error importing batch:", error);
    } else {
      totalImported += rows.length;
      process.stdout.write(`\rImported ${totalImported}/${hexes.length} regions...`);
    }
  }

  console.log("\nImport complete!");
}

importRegions();

#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_IMAGE = path.join(__dirname, '../public/images/militaryranks.png');
const OUTPUT_DIR = path.join(__dirname, '../public/images/ranks');
const ICON_SIZE = 256; // Output size for each icon

// Manually defined extraction regions for pixel-perfect cuts
// Image is 1536x1024, 5 columns x 2 rows
// Format: { name, left, top, width, height }
const RANKS = [
  // Top row (5 icons) - y from ~90 to ~380
  { name: 'rank-1-chevron', left: 65, top: 90, width: 230, height: 290 },
  { name: 'rank-2-chevron-eye', left: 310, top: 90, width: 230, height: 290 },
  { name: 'rank-3-chevron', left: 555, top: 90, width: 230, height: 290 },
  { name: 'rank-4-chevron', left: 800, top: 90, width: 230, height: 290 },
  { name: 'rank-5-chevron-star', left: 1045, top: 90, width: 230, height: 290 },
  // Bottom row (5 icons) - y from ~490 to ~780
  { name: 'rank-6-star', left: 65, top: 490, width: 230, height: 290 },
  { name: 'rank-7-star-2', left: 310, top: 490, width: 230, height: 290 },
  { name: 'rank-8-star-3', left: 555, top: 490, width: 230, height: 290 },
  { name: 'rank-9-star-3-chevron', left: 800, top: 490, width: 230, height: 290 },
  { name: 'rank-10-star-3-chevron', left: 1045, top: 490, width: 230, height: 290 }
];

async function extractRanks() {
  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('Extracting 10 military rank icons with pixel-perfect precision...\n');

    // Extract each icon
    for (const rank of RANKS) {
      const outputPath = path.join(OUTPUT_DIR, `${rank.name}.png`);

      console.log(`📌 ${rank.name}`);

      // Extract the exact region and resize
      await sharp(INPUT_IMAGE)
        .extract({
          left: rank.left,
          top: rank.top,
          width: rank.width,
          height: rank.height
        })
        // Resize to standard square size while maintaining aspect ratio
        .resize(ICON_SIZE, ICON_SIZE, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // transparent background
        })
        .png()
        .toFile(outputPath);

      console.log(`   ✓ Extracted and saved\n`);
    }

    console.log(`\n✨ Successfully extracted all ${RANKS.length} rank icons!`);
    console.log(`📁 Location: ${OUTPUT_DIR}\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

extractRanks();

const fs = require("fs");
const https = require("https");
const path = require("path");

const HEX_SIZE_DEGREES_AT_EQUATOR = 1.2;
const HEX_SCALE_FACTOR = 0.92;
const MAX_GENERATOR_LAT = 85;
const SAFE_LAT_COS = Math.cos((80 * Math.PI) / 180);
const GEO_DATA_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson";

function getHexContour(lon, lat, radiusDeg) {
  const corners = [];
  const latRad = (lat * Math.PI) / 180;
  const cosLat = Math.cos(latRad);
  const safeCos = Math.max(cosLat, SAFE_LAT_COS);
  const r = radiusDeg * HEX_SCALE_FACTOR;

  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i + 30) * Math.PI) / 180;
    const dLon = r * Math.cos(angle);
    const dLat = r * Math.sin(angle) * safeCos;
    corners.push([Number((lon + dLon).toFixed(6)), Number((lat + dLat).toFixed(6))]);
  }

  return corners;
}

function generateHexGrid() {
  const hexes = [];
  const stepRadius = HEX_SIZE_DEGREES_AT_EQUATOR;
  let row = 0;
  let lat = 90;

  while (lat > -90) {
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const safeCos = Math.max(cosLat, SAFE_LAT_COS);
    const dx = Math.sqrt(3) * stepRadius;
    const cols = Math.ceil(360 / dx);

    if (lat >= -MAX_GENERATOR_LAT && lat <= MAX_GENERATOR_LAT) {
      for (let col = 0; col < cols; col++) {
        const lon = col * dx + (row % 2 === 1 ? dx / 2 : 0) - 180;
        hexes.push({
          id: `${row}-${col}`,
          center: [Number(lon.toFixed(6)), Number(lat.toFixed(6))],
          contour: getHexContour(lon, lat, stepRadius),
        });
      }
    }

    const dyLat = 1.5 * stepRadius * safeCos;
    lat -= dyLat;
    row += 1;
  }

  return hexes;
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function pointInRing(point, ring) {
  let inside = false;
  const [px, py] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      (yi > py) !== (yj > py) &&
      px <
        ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function isPointInGeometry(point, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    const [outerRing, ...holes] = geometry.coordinates;
    if (!pointInRing(point, outerRing)) {
      return false;
    }
    return !holes.some((hole) => pointInRing(point, hole));
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => {
      const [outerRing, ...holes] = polygon;
      if (!pointInRing(point, outerRing)) return false;
      return !holes.some((hole) => pointInRing(point, hole));
    });
  }
  return false;
}

function isPointOnLand(point, features) {
  for (const feature of features) {
    if (feature.geometry && isPointInGeometry(point, feature.geometry)) {
      return true;
    }
  }
  return false;
}

function fetchGeoData() {
  return new Promise((resolve, reject) => {
    https
      .get(GEO_DATA_URL, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`Failed to fetch geo data (${res.statusCode})`));
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  const outputDir = path.resolve(__dirname, "..", "public", "data");
  ensureDirectory(outputDir);

  const rawPath = path.join(outputDir, "world-hexes-raw.json");
  const filteredPath = path.join(outputDir, "world-hexes.json");

  const features = (await fetchGeoData()).features ?? [];

  const hexes = generateHexGrid();
  fs.writeFileSync(rawPath, JSON.stringify(hexes), "utf8");

  const landHexes = hexes.filter((hex) =>
    isPointOnLand(hex.center, features)
  );
  fs.writeFileSync(filteredPath, JSON.stringify(landHexes), "utf8");

  console.log(
    `Generated ${hexes.length} hexes (raw), ${landHexes.length} filtered → ${filteredPath}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

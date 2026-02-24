import fs from "fs";
import path from "path";

interface BoardHexRecord {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
  corners: [number, number][];
  geoCenter: [number, number];
  geoContour?: [number, number][];
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface SvgCliOptions {
  inputPath: string;
  outputPath: string;
  limit: number;
}

function parseSvgCliArgs(argv: string[]): SvgCliOptions {
  let inputPath = "public/data/world-hexes-board.json";
  let outputPath = "public/data/world-hexes-board-preview.svg";
  let limit = 5000;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && i + 1 < argv.length) {
      inputPath = argv[i + 1];
      i++;
    } else if (arg.startsWith("--input=")) {
      inputPath = arg.split("=", 2)[1];
    } else if (arg === "--output" && i + 1 < argv.length) {
      outputPath = argv[i + 1];
      i++;
    } else if (arg.startsWith("--output=")) {
      outputPath = arg.split("=", 2)[1];
    } else if (arg === "--limit" && i + 1 < argv.length) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value) && value > 0) {
        limit = Math.floor(value);
      } else {
        console.warn(`Ignoring invalid --limit value: ${argv[i + 1]}`);
      }
      i++;
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=", 2)[1]);
      if (!Number.isNaN(value) && value > 0) {
        limit = Math.floor(value);
      } else {
        console.warn(`Ignoring invalid --limit value: ${arg}`);
      }
    }
  }

  return {
    inputPath: path.resolve(process.cwd(), inputPath),
    outputPath: path.resolve(process.cwd(), outputPath),
    limit,
  };
}

function loadBoardHexes(inputPath: string): BoardHexRecord[] {
  let raw: string;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (err) {
    console.error(`Failed to read board file at ${inputPath}:`, err);
    throw err;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse JSON from board file:", err);
    throw err;
  }

  if (!Array.isArray(data)) {
    throw new Error(
      `Expected board JSON to be an array, got ${typeof data} instead.`,
    );
  }

  return data as BoardHexRecord[];
}

function computeCornerBounds(hexes: BoardHexRecord[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const hex of hexes) {
    for (const corner of hex.corners) {
      const x = corner[0];
      const y = corner[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!Number.isFinite(minX)) {
    minX = maxX = minY = maxY = 0;
  }

  return { minX, maxX, minY, maxY };
}

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  const { inputPath, outputPath, limit } = parseSvgCliArgs(process.argv);

  console.log(
    `Exporting SVG preview from ${inputPath} to ${outputPath} (limit=${limit})`,
  );

  const allHexes = loadBoardHexes(inputPath);
  if (allHexes.length === 0) {
    console.error("Board JSON contains no hexes. Aborting SVG export.");
    process.exitCode = 1;
    return;
  }

  const subset = allHexes.slice(0, limit);
  const bounds = computeCornerBounds(subset);

  const margin = 10;
  const width = bounds.maxX - bounds.minX + margin * 2;
  const height = bounds.maxY - bounds.minY + margin * 2;

  // Helper to map board-space coordinates to SVG pixels.
  const mapPoint = (x: number, y: number): [number, number] => {
    const sx = x - bounds.minX + margin;
    const sy = y - bounds.minY + margin;
    return [sx, sy];
  };

  let svg = "";
  svg += '<?xml version="1.0" encoding="UTF-8"?>\n';
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;

  const hasOriginInBounds =
    0 >= bounds.minX && 0 <= bounds.maxX && 0 >= bounds.minY && 0 <= bounds.maxY;

  if (hasOriginInBounds) {
    const [ox, oy] = mapPoint(0, 0);
    // Axes lines through origin
    const [xAxisStartX, xAxisStartY] = mapPoint(bounds.minX, 0);
    const [xAxisEndX, xAxisEndY] = mapPoint(bounds.maxX, 0);
    const [yAxisStartX, yAxisStartY] = mapPoint(0, bounds.minY);
    const [yAxisEndX, yAxisEndY] = mapPoint(0, bounds.maxY);

    svg += `  <line x1="${xAxisStartX.toFixed(2)}" y1="${xAxisStartY.toFixed(
      2
    )}" x2="${xAxisEndX.toFixed(2)}" y2="${xAxisEndY.toFixed(2)}" stroke="#444" stroke-width="0.8" stroke-dasharray="4,4" />\n`;
    svg += `  <line x1="${yAxisStartX.toFixed(2)}" y1="${yAxisStartY.toFixed(
      2
    )}" x2="${yAxisEndX.toFixed(2)}" y2="${yAxisEndY.toFixed(2)}" stroke="#444" stroke-width="0.8" stroke-dasharray="4,4" />\n`;

    // Origin marker and label
    svg += `  <circle cx="${ox.toFixed(2)}" cy="${oy.toFixed(
      2
    )}" r="3" fill="red" />\n`;
    svg += `  <text x="${(ox + 6).toFixed(2)}" y="${(oy - 6).toFixed(
      2
    )}" font-size="8" fill="#fff">(0,0)</text>\n`;
  }

  for (const hex of subset) {
    if (!Array.isArray(hex.corners) || hex.corners.length !== 6) {
      continue;
    }

    const points = hex.corners
      .map(([cx, cy]) => {
        const [sx, sy] = mapPoint(cx, cy);
        return `${sx.toFixed(2)},${sy.toFixed(2)}`;
      })
      .join(" ");

    const parity = (hex.q + hex.r) & 1;
    const fill = parity === 0 ? "#88c" : "#c88";

    svg += `  <polygon points="${points}" fill="${fill}" fill-opacity="0.6" stroke="#333" stroke-width="0.5">\n`;
    svg += `    <title>${hex.id}</title>\n`;
    svg += "  </polygon>\n";
  }

  svg += "</svg>\n";

  ensureDirectoryExists(outputPath);

  try {
    fs.writeFileSync(outputPath, svg, "utf8");
  } catch (err) {
    console.error(`Failed to write SVG file at ${outputPath}:`, err);
    throw err;
  }

  console.log(
    `SVG preview written to ${outputPath} with ${subset.length} hexes (width=${width.toFixed(2)}, height=${height.toFixed(2)}).`,
  );
}

main().catch((err) => {
  console.error("Unexpected error during SVG export:", err);
  process.exitCode = 1;
});

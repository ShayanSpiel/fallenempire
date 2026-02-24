import fs from "fs";
import path from "path";

interface WorldHexInput {
  id: string;
  contour?: [number, number][];
  center?: [number, number];
}

export interface BoardHexOutput {
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

type LayoutMode = "pointy" | "flat";
type IdMode = "axial" | "rowcol";
type OffsetMode = "oddr" | "evenr" | "oddc" | "evenc";

interface CliOptions {
  hexSize: number;
  inputPath: string;
  outputPath: string;
  layout: LayoutMode;
  idMode: IdMode;
  offsetMode: OffsetMode;
  flipY: boolean;
  rotateDeg: number;
}

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const v = value.toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

function parseCliArgs(argv: string[]): CliOptions {
  let hexSize = 20;
  let inputPath = "public/data/world-hexes.json";
  let outputPath = "public/data/world-hexes-board.json";
  let layout: LayoutMode = "pointy";
  let idMode: IdMode = "axial";
  let offsetMode: OffsetMode = "oddr";
  let flipY = false;
  let rotateDeg = 0;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    const [key, inlineValue] = arg.startsWith("--") ? arg.split("=", 2) : [arg, undefined];

    const getNext = () => {
      if (inlineValue !== undefined) return inlineValue;
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        i += 1;
        return argv[i];
      }
      return undefined;
    };

    switch (key) {
      case "--size": {
        const value = Number(getNext());
        if (!Number.isNaN(value) && value > 0) {
          hexSize = value;
        } else {
          console.warn(`Ignoring invalid --size value: ${inlineValue ?? argv[i]}`);
        }
        break;
      }
      case "--input": {
        const val = getNext();
        if (val) inputPath = val;
        break;
      }
      case "--output": {
        const val = getNext();
        if (val) outputPath = val;
        break;
      }
      case "--layout": {
        const val = (getNext() ?? "").toLowerCase();
        if (val === "pointy" || val === "flat") {
          layout = val;
        } else {
          console.warn(`Unknown --layout "${val}", falling back to "pointy".`);
        }
        break;
      }
      case "--idmode": {
        const val = (getNext() ?? "").toLowerCase();
        if (val === "axial" || val === "rowcol") {
          idMode = val;
        } else {
          console.warn(`Unknown --idmode "${val}", falling back to "axial".`);
        }
        break;
      }
      case "--offset": {
        const val = (getNext() ?? "").toLowerCase();
        if (val === "oddr" || val === "evenr" || val === "oddc" || val === "evenc") {
          offsetMode = val;
        } else {
          console.warn(`Unknown --offset "${val}", falling back to "oddr".`);
        }
        break;
      }
      case "--flipY": {
        const val = getNext();
        flipY = parseBooleanFlag(val, flipY);
        break;
      }
      case "--rotateDeg": {
        const value = Number(getNext());
        if (!Number.isNaN(value)) {
          rotateDeg = value;
        } else {
          console.warn(`Ignoring invalid --rotateDeg value: ${inlineValue ?? argv[i]}`);
        }
        break;
      }
      default:
        // ignore unknown flags
        break;
    }
  }

  return {
    hexSize,
    inputPath: path.resolve(process.cwd(), inputPath),
    outputPath: path.resolve(process.cwd(), outputPath),
    layout,
    idMode,
    offsetMode,
    flipY,
    rotateDeg
  };
}

function parseIdToAxial(id: string, idMode: IdMode, offsetMode: OffsetMode): { q: number; r: number } | null {
  const trimmed = id.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 2) {
    console.warn(`Skipping hex with id "${id}": expected "A-B" numeric format.`);
    return null;
  }

  const a = Number(parts[0]);
  const b = Number(parts[1]);
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    console.warn(
      `Skipping hex with id "${id}": expected integer components, got "${parts[0]}", "${parts[1]}".`
    );
    return null;
  }

  if (idMode === "axial") {
    return { q: a, r: b };
  }

  // row/col offset interpretation
  const row = a;
  const col = b;
  const rowParity = row & 1;
  const colParity = col & 1;

  switch (offsetMode) {
    case "oddr": {
      const q = col - (row - rowParity) / 2;
      const r = row;
      return { q, r };
    }
    case "evenr": {
      const q = col - (row + rowParity) / 2;
      const r = row;
      return { q, r };
    }
    case "oddc": {
      const q = col;
      const r = row - (col - colParity) / 2;
      return { q, r };
    }
    case "evenc": {
      const q = col;
      const r = row - (col + colParity) / 2;
      return { q, r };
    }
    default: {
      const q = col - (row - rowParity) / 2;
      const r = row;
      return { q, r };
    }
  }
}

function computeBounds(points: { x: number; y: number }[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  if (!Number.isFinite(minX)) {
    minX = maxX = minY = maxY = 0;
  }

  return { minX, maxX, minY, maxY };
}

function loadWorldHexes(inputPath: string): WorldHexInput[] {
  let raw: string;
  try {
    raw = fs.readFileSync(inputPath, "utf8");
  } catch (err) {
    console.error(`Failed to read input file at ${inputPath}:`, err);
    throw err;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse JSON from input file:", err);
    throw err;
  }

  if (!Array.isArray(data)) {
    throw new Error(
      `Expected input JSON to be an array, got ${typeof data} instead.`
    );
  }

  return data as WorldHexInput[];
}

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function axialToBoardCenter(q: number, r: number, size: number, layout: LayoutMode): { x: number; y: number } {
  const sqrt3 = Math.sqrt(3);

  if (layout === "pointy") {
    const x = size * sqrt3 * (q + r / 2);
    const y = size * 1.5 * r;
    return { x, y };
  }

  const x = size * 1.5 * q;
  const y = size * sqrt3 * (r + q / 2);
  return { x, y };
}

function buildCorners(x: number, y: number, size: number, layout: LayoutMode): [number, number][] {
  const corners: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = layout === "pointy" ? 60 * i - 30 : 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    const cx = x + size * Math.cos(angleRad);
    const cy = y + size * Math.sin(angleRad);
    corners.push([cx, cy]);
  }
  return corners;
}

function applyFlipY(hexes: BoardHexOutput[]): void {
  for (const h of hexes) {
    h.y = -h.y;
    h.corners = h.corners.map(([cx, cy]) => [cx, -cy] as [number, number]);
  }
}

function applyRotation(hexes: BoardHexOutput[], deg: number): void {
  if (deg === 0) return;
  const rad = (Math.PI / 180) * deg;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  for (const h of hexes) {
    const x0 = h.x;
    const y0 = h.y;
    h.x = x0 * cos - y0 * sin;
    h.y = x0 * sin + y0 * cos;

    h.corners = h.corners.map(([cx, cy]) => {
      const nx = cx * cos - cy * sin;
      const ny = cx * sin + cy * cos;
      return [nx, ny] as [number, number];
    });
  }
}

async function main() {
  const { hexSize, inputPath, outputPath, layout, idMode, offsetMode, flipY, rotateDeg } =
    parseCliArgs(process.argv);

  console.log(
    `Converting world hexes to board-space with size=${hexSize}, layout=${layout}, idMode=${idMode}, offset=${offsetMode}, flipY=${flipY}, rotateDeg=${rotateDeg} (input: ${inputPath}, output: ${outputPath})`
  );

  const inputHexes = loadWorldHexes(inputPath);

  const boardHexes: BoardHexOutput[] = [];
  let skippedCount = 0;

  for (const hex of inputHexes) {
    if (!hex || typeof hex.id !== "string") {
      skippedCount++;
      continue;
    }

    const axial = parseIdToAxial(hex.id, idMode, offsetMode);
    if (!axial) {
      skippedCount++;
      continue;
    }

    const center = hex.center;
    if (
      !Array.isArray(center) ||
      center.length !== 2 ||
      typeof center[0] !== "number" ||
      typeof center[1] !== "number"
    ) {
      console.warn(
        `Skipping hex with id "${hex.id}": missing or invalid center property.`
      );
      skippedCount++;
      continue;
    }

    const { q, r } = axial;
    const { x, y } = axialToBoardCenter(q, r, hexSize, layout);
    const corners = buildCorners(x, y, hexSize, layout);

    const geoContour =
      Array.isArray(hex.contour) && hex.contour.length > 0
        ? (hex.contour.map((pt) => [pt[0], pt[1]]) as [number, number][])
        : undefined;

    boardHexes.push({
      id: hex.id,
      q,
      r,
      x,
      y,
      corners,
      geoCenter: [center[0], center[1]],
      geoContour
    });
  }

  if (boardHexes.length === 0) {
    console.error("No valid hexes were converted. Aborting.");
    process.exitCode = 1;
    return;
  }

  const preTransformBounds = computeBounds(boardHexes);

  if (flipY) {
    applyFlipY(boardHexes);
  }

  if (rotateDeg !== 0) {
    applyRotation(boardHexes, rotateDeg);
  }

  const postTransformBounds = computeBounds(boardHexes);

  const centerX = (postTransformBounds.minX + postTransformBounds.maxX) / 2;
  const centerY = (postTransformBounds.minY + postTransformBounds.maxY) / 2;

  for (const h of boardHexes) {
    h.x -= centerX;
    h.y -= centerY;
    h.corners = h.corners.map(
      ([cx, cy]) => [cx - centerX, cy - centerY] as [number, number]
    );
  }

  const finalBounds = computeBounds(boardHexes);

  ensureDirectoryExists(outputPath);

  try {
    fs.writeFileSync(outputPath, JSON.stringify(boardHexes, null, 2), "utf8");
  } catch (err) {
    console.error(`Failed to write output file at ${outputPath}:`, err);
    throw err;
  }

  console.log(
    `Converted ${boardHexes.length} hexes (skipped ${skippedCount} invalid entries).`
  );
  console.log(
    `Bounds before transform:  x=[${preTransformBounds.minX.toFixed(
      2
    )}, ${preTransformBounds.maxX.toFixed(2)}], y=[${preTransformBounds.minY.toFixed(
      2
    )}, ${preTransformBounds.maxY.toFixed(2)}]`
  );
  console.log(
    `Bounds after transform:   x=[${postTransformBounds.minX.toFixed(
      2
    )}, ${postTransformBounds.maxX.toFixed(2)}], y=[${postTransformBounds.minY.toFixed(
      2
    )}, ${postTransformBounds.maxY.toFixed(2)}]`
  );
  console.log(
    `Bounds after normalization: x=[${finalBounds.minX.toFixed(
      2
    )}, ${finalBounds.maxX.toFixed(2)}], y=[${finalBounds.minY.toFixed(
      2
    )}, ${finalBounds.maxY.toFixed(2)}]`
  );
}

main().catch((err) => {
  console.error("Unexpected error during conversion:", err);
  process.exitCode = 1;
});

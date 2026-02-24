export type GridCoordinate = { row: number; col: number };

// "Odd-R" Offset Coordinates (shifts odd rows right)
const ODD_ROW_NEIGHBORS = [
  { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },  { dr: 1, dc: 1 },
];

const EVEN_ROW_NEIGHBORS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 },
  { dr: 0, dc: -1 },  { dr: 0, dc: 1 },
  { dr: 1, dc: -1 },  { dr: 1, dc: 0 },
];

const GRID_ID_RE = /^(\d+)-(\d+)$/;

export function parseGridId(id: string): GridCoordinate | null {
  const match = GRID_ID_RE.exec(id);
  if (!match) return null;
  return { row: Number(match[1]), col: Number(match[2]) };
}

export function makeGridId(row: number, col: number) {
  return `${row}-${col}`;
}

export function getHexNeighbors(hexId: string): string[] {
  const coord = parseGridId(hexId);
  if (!coord) return [];

  const isOdd = coord.row % 2 !== 0;
  const offsets = isOdd ? ODD_ROW_NEIGHBORS : EVEN_ROW_NEIGHBORS;

  return offsets.map((offset) => makeGridId(coord.row + offset.dr, coord.col + offset.dc));
}

import { geoContains } from "d3-geo";
import RBush from "rbush";
import type { Feature, FeatureCollection } from "geojson";

// Hex Resource Distribution System
// Config-driven placement with spacing + country limits + base 5% bonus.

// ============================================================================
// GRID HELPERS (Odd-R offset)
// ============================================================================

type GridCoordinate = { row: number; col: number };

const ODD_ROW_NEIGHBORS = [
  { dr: -1, dc: 0 },
  { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
];

const EVEN_ROW_NEIGHBORS = [
  { dr: -1, dc: -1 },
  { dr: -1, dc: 0 },
  { dr: 0, dc: -1 },
  { dr: 0, dc: 1 },
  { dr: 1, dc: -1 },
  { dr: 1, dc: 0 },
];

const GRID_ID_RE = /^(\d+)-(\d+)$/;

function parseGridId(id: string): GridCoordinate | null {
  const match = GRID_ID_RE.exec(id);
  if (!match) return null;
  return { row: Number(match[1]), col: Number(match[2]) };
}

function makeGridId(row: number, col: number) {
  return `${row}-${col}`;
}

export function getHexNeighbors(hexId: string): string[] {
  const coord = parseGridId(hexId);
  if (!coord) return [];
  const offsets = coord.row % 2 !== 0 ? ODD_ROW_NEIGHBORS : EVEN_ROW_NEIGHBORS;
  return offsets.map((offset) =>
    makeGridId(coord.row + offset.dr, coord.col + offset.dc)
  );
}

// ============================================================================
// CONFIG
// ============================================================================

export interface LatitudeBand {
  min: number;
  max: number;
  multiplier: number;
}

export interface GeographicRegion {
  name: string;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  multiplier: number;
}

export interface ResourceDistributionConfig {
  name: string;
  icon: string;
  color: string;
  baseBonus: number;
  label: string;
  countryShare: number;
  hexShare: number;
  priority: number;
  minScore?: number;
  randomWeight?: number;
  biomeAffinity: Record<string, number>;
  latitudeBands: LatitudeBand[];
  geographicRegions: GeographicRegion[];
}

export const RESOURCE_DISTRIBUTION_RULES = {
  minSameResourceSpacing: 4,
  maxResourcesPerCountry: 1,
  bonusZoneSteps: [
    { minNeighbors: 0, bonus: 0.05, label: "Base Zone" },
    { minNeighbors: 2, bonus: 0.1, label: "Expanded Zone" },
    { minNeighbors: 4, bonus: 0.2, label: "Developed Zone" },
    { minNeighbors: 6, bonus: 0.3, label: "Complete Zone" },
  ],
};

export const RESOURCE_DISTRIBUTION_CONFIG: Record<
  string,
  ResourceDistributionConfig
> = {
  grain: {
    name: "Grain",
    icon: "wheat",
    color: "#F59E0B",
    baseBonus: 0.05,
    label: "Base Resource",
    countryShare: 0.25,
    hexShare: 0.004,
    priority: 1,
    minScore: 0.45,
    randomWeight: 0.28,
    biomeAffinity: {
      Ocean: 0.0,
      Plains: 1.0,
      Desert: 0.2,
      Forest: 0.6,
      Mountain: 0.1,
    },
    latitudeBands: [
      { min: -90, max: -60, multiplier: 0.2 },
      { min: -60, max: -30, multiplier: 0.9 },
      { min: -30, max: 30, multiplier: 0.7 },
      { min: 30, max: 60, multiplier: 1.0 },
      { min: 60, max: 90, multiplier: 0.2 },
    ],
    geographicRegions: [
      { name: "US Great Plains", latMin: 35, latMax: 50, lonMin: -105, lonMax: -95, multiplier: 1.7 },
      { name: "Ukraine", latMin: 45, latMax: 52, lonMin: 22, lonMax: 40, multiplier: 1.6 },
      { name: "Northern China", latMin: 35, latMax: 45, lonMin: 105, lonMax: 125, multiplier: 1.5 },
      { name: "Argentina Pampas", latMin: -40, latMax: -30, lonMin: -65, lonMax: -55, multiplier: 1.5 },
    ],
  },

  iron: {
    name: "Iron",
    icon: "mountain",
    color: "#6B7280",
    baseBonus: 0.05,
    label: "Base Resource",
    countryShare: 0.2,
    hexShare: 0.0035,
    priority: 2,
    minScore: 0.48,
    randomWeight: 0.26,
    biomeAffinity: {
      Ocean: 0.0,
      Plains: 0.2,
      Desert: 0.6,
      Forest: 0.3,
      Mountain: 1.0,
    },
    latitudeBands: [{ min: -90, max: 90, multiplier: 1.0 }],
    geographicRegions: [
      { name: "Western Australia", latMin: -25, latMax: -15, lonMin: 115, lonMax: 125, multiplier: 1.8 },
      { name: "Brazil", latMin: -25, latMax: -15, lonMin: -50, lonMax: -40, multiplier: 1.7 },
      { name: "Northern China", latMin: 40, latMax: 50, lonMin: 110, lonMax: 125, multiplier: 1.6 },
      { name: "India", latMin: 18, latMax: 24, lonMin: 82, lonMax: 88, multiplier: 1.5 },
    ],
  },

  oil: {
    name: "Oil",
    icon: "droplet",
    color: "#111827",
    baseBonus: 0.05,
    label: "Base Resource",
    countryShare: 0.12,
    hexShare: 0.002,
    priority: 3,
    minScore: 0.55,
    randomWeight: 0.24,
    biomeAffinity: {
      Ocean: 0.5,
      Plains: 0.4,
      Desert: 1.0,
      Forest: 0.0,
      Mountain: 0.1,
    },
    latitudeBands: [
      { min: -90, max: -30, multiplier: 0.4 },
      { min: -30, max: 30, multiplier: 0.8 },
      { min: 30, max: 50, multiplier: 1.0 },
      { min: 50, max: 90, multiplier: 0.3 },
    ],
    geographicRegions: [
      { name: "Persian Gulf", latMin: 24, latMax: 32, lonMin: 44, lonMax: 56, multiplier: 2.5 },
      { name: "Saudi Arabia", latMin: 18, latMax: 28, lonMin: 42, lonMax: 52, multiplier: 2.3 },
      { name: "Venezuela", latMin: 8, latMax: 11, lonMin: -72, lonMax: -60, multiplier: 1.9 },
      { name: "West Texas", latMin: 30, latMax: 34, lonMin: -104, lonMax: -100, multiplier: 2.0 },
      { name: "North Sea", latMin: 56, latMax: 62, lonMin: 0, lonMax: 6, multiplier: 1.8 },
      { name: "West Siberia", latMin: 58, latMax: 65, lonMin: 65, lonMax: 80, multiplier: 1.9 },
      { name: "Gulf of Mexico", latMin: 26, latMax: 30, lonMin: -94, lonMax: -88, multiplier: 1.8 },
    ],
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface HexResourceBonus {
  resourceKey: string;
  resourceName: string;
  level: number;
  bonus: number;
  label: string;
  percentage: string;
}

export interface ResourceHexInput {
  id: string;
  center: [number, number];
  biome: string;
  countryKey?: string | null;
}

export interface ResourceDistribution {
  byHexId: Map<string, HexResourceBonus>;
  byResourceKey: Map<string, Set<string>>;
}

export interface ResourceZoneBonus {
  resourceKey: string;
  resourceName: string;
  centerHexId: string;
  ownedNeighbors: number;
  totalNeighbors: number;
  bonus: number;
  percentage: string;
  label: string;
  level: number;
}

// ============================================================================
// HASH + BIOME
// ============================================================================

function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function getBiomeFromHexId(hexId: string): string {
  const seed = hash01(hexId);
  return seed < 0.2
    ? "Ocean"
    : seed < 0.45
      ? "Plains"
      : seed < 0.7
        ? "Desert"
        : seed < 0.9
          ? "Forest"
          : "Mountain";
}

// ============================================================================
// SCORING + DISTRIBUTION
// ============================================================================

function scoreHexForResource(
  hex: ResourceHexInput,
  resourceKey: string,
  config: ResourceDistributionConfig
) {
  const [longitude, latitude] = hex.center;
  const biomeScore = config.biomeAffinity[hex.biome] ?? 0;
  const latBand = config.latitudeBands.find(
    (band) => latitude >= band.min && latitude < band.max
  );
  const latScore = latBand?.multiplier ?? 0.5;

  let geoMultiplier = 1.0;
  for (const region of config.geographicRegions) {
    if (
      latitude >= region.latMin &&
      latitude <= region.latMax &&
      longitude >= region.lonMin &&
      longitude <= region.lonMax
    ) {
      geoMultiplier = Math.max(geoMultiplier, region.multiplier);
    }
  }

  const randomSeed = hash01(`${hex.id}-${resourceKey}`);
  const randomWeight = config.randomWeight ?? 0.25;
  const baseScore =
    biomeScore * 0.45 + latScore * 0.25 + randomSeed * randomWeight;
  return baseScore * geoMultiplier;
}

function isSameResourceNearby(
  hexId: string,
  assigned: Set<string>,
  hexIdSet: Set<string>,
  minSpacing: number
) {
  if (!assigned.size) return false;
  const maxDist = Math.max(0, minSpacing - 1);
  const visited = new Set<string>();
  const queue: Array<{ id: string; dist: number }> = [{ id: hexId, dist: 0 }];
  visited.add(hexId);

  while (queue.length) {
    const current = queue.shift()!;
    if (current.dist >= maxDist) continue;
    for (const neighborId of getHexNeighbors(current.id)) {
      if (!hexIdSet.has(neighborId)) continue;
      if (visited.has(neighborId)) continue;
      const nextDist = current.dist + 1;
      if (nextDist <= maxDist && assigned.has(neighborId)) return true;
      visited.add(neighborId);
      if (nextDist < maxDist) queue.push({ id: neighborId, dist: nextDist });
    }
  }

  return false;
}

export function buildResourceDistribution(
  hexes: ResourceHexInput[],
  rules: Partial<typeof RESOURCE_DISTRIBUTION_RULES> = {}
): ResourceDistribution {
  const minSpacing =
    rules.minSameResourceSpacing ?? RESOURCE_DISTRIBUTION_RULES.minSameResourceSpacing;
  const maxPerCountry =
    rules.maxResourcesPerCountry ?? RESOURCE_DISTRIBUTION_RULES.maxResourcesPerCountry;

  const byHexId = new Map<string, HexResourceBonus>();
  const byResourceKey = new Map<string, Set<string>>();
  const hexIdSet = new Set(hexes.map((hex) => hex.id));
  const countrySet = new Set(
    hexes
      .map((hex) => hex.countryKey)
      .filter((value): value is string => Boolean(value))
  );
  const totalCountries = countrySet.size;
  const countryAssignments = new Map<string, number>();

  const orderedResources = Object.entries(RESOURCE_DISTRIBUTION_CONFIG).sort(
    (a, b) => (b[1].priority ?? 0) - (a[1].priority ?? 0)
  );

  for (const [resourceKey, config] of orderedResources) {
    const assigned = new Set<string>();
    byResourceKey.set(resourceKey, assigned);

    const share = totalCountries > 0 ? config.countryShare : config.hexShare;
    const targetPool = totalCountries > 0 ? totalCountries : hexes.length;
    const targetCount = Math.max(0, Math.round(targetPool * share));
    if (targetCount === 0) continue;

    const candidates = hexes
      .map((hex) => {
        const score = scoreHexForResource(hex, resourceKey, config);
        const jitter = hash01(`rank:${resourceKey}:${hex.id}`) * 0.02;
        return {
          hex,
          score: score + jitter,
        };
      })
      .filter((candidate) =>
        config.minScore ? candidate.score >= config.minScore : true
      )
      .sort((a, b) => b.score - a.score);

    for (const candidate of candidates) {
      if (assigned.size >= targetCount) break;
      const { hex } = candidate;
      const countryKey = hex.countryKey ?? null;

      if (countryKey && maxPerCountry > 0) {
        const currentCount = countryAssignments.get(countryKey) ?? 0;
        if (currentCount >= maxPerCountry) continue;
      }

      if (isSameResourceNearby(hex.id, assigned, hexIdSet, minSpacing)) {
        continue;
      }

      const bonus = config.baseBonus;
      const bonusEntry: HexResourceBonus = {
        resourceKey,
        resourceName: config.name,
        level: 1,
        bonus,
        label: config.label,
        percentage: `${(bonus * 100).toFixed(0)}%`,
      };

      assigned.add(hex.id);
      byHexId.set(hex.id, bonusEntry);

      if (countryKey) {
        countryAssignments.set(countryKey, (countryAssignments.get(countryKey) ?? 0) + 1);
      }
    }
  }

  return { byHexId, byResourceKey };
}

export function getHexResourceBonus(
  hexId: string,
  distribution: ResourceDistribution | null | undefined
): HexResourceBonus | null {
  if (!distribution) return null;
  return distribution.byHexId.get(hexId) ?? null;
}

export function getAllHexResourceBonuses(
  hexId: string,
  distribution: ResourceDistribution | null | undefined
): HexResourceBonus[] {
  const bonus = getHexResourceBonus(hexId, distribution);
  return bonus ? [bonus] : [];
}

export function getResourceZoneHexes(centerHexId: string): string[] {
  return [centerHexId, ...getHexNeighbors(centerHexId)];
}

export function calculateResourceZoneBonus(
  centerHexId: string,
  ownedHexIds: Set<string>,
  baseBonus: HexResourceBonus
): ResourceZoneBonus | null {
  if (!ownedHexIds.has(centerHexId)) return null;
  const neighbors = getHexNeighbors(centerHexId);
  const ownedNeighbors = neighbors.filter((id) => ownedHexIds.has(id)).length;
  const totalNeighbors = neighbors.length;

  const steps = RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps;
  let selected = steps[0];
  for (const step of steps) {
    if (ownedNeighbors >= step.minNeighbors) {
      selected = step;
    }
  }

  return {
    resourceKey: baseBonus.resourceKey,
    resourceName: baseBonus.resourceName,
    centerHexId,
    ownedNeighbors,
    totalNeighbors,
    bonus: selected.bonus,
    percentage: `${(selected.bonus * 100).toFixed(0)}%`,
    label: selected.label,
    level: steps.indexOf(selected) + 1,
  };
}

// ============================================================================
// RESOURCE METADATA HELPERS
// ============================================================================

export function getResourceName(resourceKey: string): string {
  return RESOURCE_DISTRIBUTION_CONFIG[resourceKey]?.name ?? resourceKey;
}

export function getResourceIcon(resourceKey: string): string {
  return RESOURCE_DISTRIBUTION_CONFIG[resourceKey]?.icon ?? "box";
}

export function getResourceColor(resourceKey: string): string {
  return RESOURCE_DISTRIBUTION_CONFIG[resourceKey]?.color ?? "#6B7280";
}

export function formatBonusPercentage(bonus: number): string {
  return `+${(bonus * 100).toFixed(0)}%`;
}

// ============================================================================
// WORLD DATA LOADER (cached)
// ============================================================================

type SpatialBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SpatialIndexItem = SpatialBBox & {
  feature: Feature;
};

const GEO_DATA_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson";
const WORLD_HEX_DATA_URL = "/data/world-hexes.json";
const MAX_NORTH_LAT = 85;
const MIN_SOUTH_LAT = -60;

let cachedDistribution: ResourceDistribution | null = null;
let distributionPromise: Promise<ResourceDistribution> | null = null;

function mergeBBoxes(a: SpatialBBox | null, b: SpatialBBox | null): SpatialBBox | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function expandBBoxWithCoords(
  coords: unknown,
  bbox: SpatialBBox | null = null
): SpatialBBox | null {
  if (!Array.isArray(coords)) return bbox;

  if (
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    const lon = coords[0];
    const lat = coords[1];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return bbox;
    if (!bbox) {
      return { minX: lon, minY: lat, maxX: lon, maxY: lat };
    }
    return {
      minX: Math.min(bbox.minX, lon),
      minY: Math.min(bbox.minY, lat),
      maxX: Math.max(bbox.maxX, lon),
      maxY: Math.max(bbox.maxY, lat),
    };
  }

  let next = bbox;
  for (const child of coords) {
    next = expandBBoxWithCoords(child, next);
  }
  return next;
}

function calculateGeometryBBox(
  geometry: Feature["geometry"] | null | undefined
): SpatialBBox | null {
  if (!geometry) return null;

  if (geometry.type === "GeometryCollection" && geometry.geometries?.length) {
    return geometry.geometries.reduce(
      (acc, child) => mergeBBoxes(acc, calculateGeometryBBox(child)),
      null as SpatialBBox | null
    );
  }

  if (!("coordinates" in geometry)) {
    return null;
  }

  return expandBBoxWithCoords(geometry.coordinates ?? null, null);
}

function getStringProp(
  props: Record<string, unknown> | null | undefined,
  keys: string[]
): string | null {
  if (!props) return null;
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeIso2(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed === "-99") return null;
  const upper = trimmed.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return upper;
}

function buildCountryIndex(geoData: FeatureCollection | null) {
  const features = (geoData?.features ?? []) as Feature[];
  if (!features.length) return null;
  const tree = new RBush<SpatialIndexItem>();
  const items: SpatialIndexItem[] = [];

  for (const feature of features) {
    const bbox = calculateGeometryBBox(feature.geometry);
    if (!bbox) continue;
    items.push({ ...bbox, feature });
  }

  if (items.length) tree.load(items);
  return tree;
}

function lookupCountryKey(
  tree: RBush<SpatialIndexItem> | null,
  lon: number,
  lat: number
) {
  if (!tree) return null;
  const nearby = tree.search({ minX: lon, minY: lat, maxX: lon, maxY: lat });
  const point: [number, number] = [lon, lat];

  for (const item of nearby) {
    try {
      if (!geoContains(item.feature, point)) continue;
    } catch {
      continue;
    }

    const props = item.feature.properties as Record<string, unknown> | null | undefined;
    const countryName = getStringProp(props, [
      "admin",
      "ADMIN",
      "name_long",
      "NAME_LONG",
      "name",
      "NAME",
      "geounit",
      "GEOUNIT",
      "sovereignt",
      "SOVEREIGNT",
    ]);
    const iso2 = normalizeIso2(
      getStringProp(props, ["iso_a2", "ISO_A2", "ISO2", "iso2"])
    );

    return iso2 ?? countryName ?? null;
  }

  return null;
}

export async function loadResourceDistribution(): Promise<ResourceDistribution> {
  if (cachedDistribution) return cachedDistribution;
  if (distributionPromise) return distributionPromise;

  distributionPromise = (async () => {
    const [hexRes, geoRes] = await Promise.all([
      fetch(WORLD_HEX_DATA_URL),
      fetch(GEO_DATA_URL).catch(() => null),
    ]);

    if (!hexRes?.ok) {
      throw new Error("Failed to load world-hexes.json");
    }

    const hexData = (await hexRes.json()) as Array<{
      id: string;
      center: [number, number];
    }>;

    const geoData = geoRes && geoRes.ok ? ((await geoRes.json()) as FeatureCollection) : null;
    const countryIndex = buildCountryIndex(geoData);

    const hexes: ResourceHexInput[] = hexData
      .filter(
        (h) => h.center[1] <= MAX_NORTH_LAT && h.center[1] >= MIN_SOUTH_LAT
      )
      .map((hex) => {
        const countryKey = lookupCountryKey(
          countryIndex,
          hex.center[0],
          hex.center[1]
        );
        return {
          id: hex.id,
          center: hex.center,
          biome: getBiomeFromHexId(hex.id),
          countryKey,
        };
      });

    const distribution = buildResourceDistribution(hexes);
    cachedDistribution = distribution;
    return distribution;
  })();

  return distributionPromise;
}

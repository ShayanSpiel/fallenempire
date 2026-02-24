"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  PolygonLayer,
  GeoJsonLayer,
  LineLayer,
  ScatterplotLayer,
  BitmapLayer,
  IconLayer,
} from "@deck.gl/layers";
import {
  MapView,
  LightingEffect,
  AmbientLight,
  DirectionalLight,
  FlyToInterpolator,
  type MapViewState,
  type Color,
  type Layer,
  type Material,
  type PickingInfo,
  type ViewStateChangeParameters,
} from "@deck.gl/core";
import { useTheme } from "next-themes";
import { geoContains } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import { CanvasContext, log as lumaLog } from "@luma.gl/core";
import { countries } from "countries-list";
import RBush from "rbush";
import { error as logError } from "@/lib/logger";

const CANVAS_CONTEXT_MAX_DRAW_BUFFER_PATCH =
  "__eintelligence_canvas_context_max_draw_buffer_patch" as const;

if (typeof window !== "undefined") {
  const canvasProto = CanvasContext.prototype as CanvasContext &
    Record<typeof CANVAS_CONTEXT_MAX_DRAW_BUFFER_PATCH, boolean | undefined>;

  if (!canvasProto[CANVAS_CONTEXT_MAX_DRAW_BUFFER_PATCH]) {
    const originalGetMaxDrawingBufferSize =
      canvasProto.getMaxDrawingBufferSize;

    canvasProto.getMaxDrawingBufferSize = function (
      this: CanvasContext
    ) {
      if (!this?.device?.limits?.maxTextureDimension2D) {
        const fallbackLimit = 8192;
        return [fallbackLimit, fallbackLimit];
      }
      return originalGetMaxDrawingBufferSize.call(this);
    };

    canvasProto[CANVAS_CONTEXT_MAX_DRAW_BUFFER_PATCH] = true;
  }
}

// suppress noisy luma.gl shader logs and errors
lumaLog.enable(false);
lumaLog.setLevel(-1);
// Suppress WebGL errors in console
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;

  const isLumaError = (args: any[]) => {
    const str = String(args[0]);
    return str.includes('maxTextureDimension2D') || str.includes('canvas-context');
  };

  console.warn = (...args: any[]) => {
    if (!isLumaError(args)) originalWarn(...args);
  };

  console.error = (...args: any[]) => {
    if (!isLumaError(args)) originalError(...args);
  };
}

import type {
  RegionOwnersMap,
  DiplomacyMap,
  ActiveBattleRow,
} from "@/components/map/region-types";
import {
  RESOURCE_DISTRIBUTION_RULES,
  formatBonusPercentage,
  getHexResourceBonus,
  getResourceColor,
  getResourceZoneHexes,
  loadResourceDistribution,
  type HexResourceBonus,
  type ResourceDistribution,
} from "@/lib/economy/hex-resource-distribution";
import { makeDiplomacyKey } from "@/components/map/region-types";
import {
  makeGridId,
  parseGridId,
  getHexNeighbors,
} from "@/components/map/hex-utils";
import MapControls from "@/components/map/map-controls";
import { BattleMiniList } from "@/components/map/battle-mini-list";
import ErrorBoundary from "@/components/error-boundary";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import RegionDrawer, {
  type DrawerHex,
  type RegionInfo,
  type ActionMode,
  type RegionActionResult,
} from "@/components/map/region-drawer";
import { TILE_TEXTURE_DEFINITIONS } from "@/components/map/terrain-textures";
import { globalPerformanceMonitor } from "@/lib/performance-monitor";
import { PerformanceOverlay } from "@/components/map/performance-overlay";
import { NetworkDiagnostic } from "@/components/map/network-diagnostic";
import { PrototypeHexStyleLayer } from "@/components/map/prototype-hex-style-layer";
import { HexBorderLayer, type HexBorderDatum } from "@/components/map/hex-border-layer";
import { HexCapitalRingLayer, type HexCapitalRingDatum } from "@/components/map/hex-capital-ring-layer";

/* -------------------- CONFIG -------------------- */

const STATIC_HEX_DATA_URL = "/data/world-hexes.json";
const GEO_DATA_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson";
const GEO_ADMIN1_URL =
  "https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_admin_1_states_provinces.geojson";

const MAX_NORTH_LAT = 85;
const MIN_SOUTH_LAT = -60;

const TILT_ANGLE = 25;
const SUN_UPDATE_MS = 60_000;
const USER_LOCATION_ANIMATION_MS = 1400;

const USER_LOCATION_PIN_ATLAS_URL = "/images/map/user-location-pin.svg";
const USER_LOCATION_PIN_MAPPING = {
  "location-pin": {
    x: 0,
    y: 0,
    width: 48,
    height: 56,
    anchorX: 24,
    anchorY: 52,
    mask: false,
  },
} as const;

const PROTOTYPE_MAP_PIN_HOUSE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" overflow="visible">
  <defs>
    <linearGradient id="pinGradient" x1="4" y1="4" x2="20" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#facc15"/>
      <stop offset="55%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#fde047"/>
    </linearGradient>
    <filter id="pinShadow" x="-8" y="-8" width="40" height="40" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="1.25" stdDeviation="2.1" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#pinShadow)" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#111827" stroke-opacity="0.7" stroke-width="3.6">
      <path d="M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z"/>
      <path d="M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2"/>
      <path d="M18 22v-3"/>
      <circle cx="10" cy="10" r="3"/>
    </g>
    <g stroke="url(#pinGradient)" stroke-width="2.25">
      <path d="M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z"/>
      <path d="M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2"/>
      <path d="M18 22v-3"/>
      <circle cx="10" cy="10" r="3"/>
    </g>
  </g>
</svg>
`.trim();

const PROTOTYPE_MAP_PIN_HOUSE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  PROTOTYPE_MAP_PIN_HOUSE_SVG
)}`;

const PROTOTYPE_BRICK_WALL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" overflow="visible">
  <defs>
    <linearGradient id="silverGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f3f4f6"/>
      <stop offset="55%" stop-color="#9ca3af"/>
      <stop offset="100%" stop-color="#e5e7eb"/>
    </linearGradient>
    <filter id="iconShadow" x="-8" y="-8" width="40" height="40" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="1.15" stdDeviation="2.0" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#iconShadow)" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#111827" stroke-opacity="0.7" stroke-width="3.6">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M12 9v6"/>
      <path d="M16 15v6"/>
      <path d="M16 3v6"/>
      <path d="M3 15h18"/>
      <path d="M3 9h18"/>
      <path d="M8 15v6"/>
      <path d="M8 3v6"/>
    </g>
    <g stroke="url(#silverGrad)" stroke-width="2.25">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M12 9v6"/>
      <path d="M16 15v6"/>
      <path d="M16 3v6"/>
      <path d="M3 15h18"/>
      <path d="M3 9h18"/>
      <path d="M8 15v6"/>
      <path d="M8 3v6"/>
    </g>
  </g>
</svg>
`.trim();

const RESOURCE_ICON_MAP = {
  grain: {
    url: "/images/resources/grain.svg",
    width: 128,
    height: 128,
    anchorX: 64,
    anchorY: 64,
    mask: true,
  },
  iron: {
    url: "/images/resources/iron.svg",
    width: 128,
    height: 128,
    anchorX: 64,
    anchorY: 64,
    mask: true,
  },
  oil: {
    url: "/images/resources/oil.svg",
    width: 128,
    height: 128,
    anchorX: 64,
    anchorY: 64,
    mask: true,
  },
} as const;

const RESOURCE_ICON_COLORS: Record<keyof typeof RESOURCE_ICON_MAP, Color> = {
  grain: [255, 215, 0, 255],
  iron: [200, 205, 215, 255],
  oil: [0, 0, 0, 255],
};

const PROTOTYPE_BRICK_WALL_FIRE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" overflow="visible">
  <defs>
    <linearGradient id="silverGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f3f4f6"/>
      <stop offset="55%" stop-color="#9ca3af"/>
      <stop offset="100%" stop-color="#e5e7eb"/>
    </linearGradient>
    <filter id="iconShadow" x="-8" y="-8" width="40" height="40" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="1.15" stdDeviation="2.0" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#iconShadow)" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#111827" stroke-opacity="0.7" stroke-width="3.6">
      <path d="M16 3v2.107"/>
      <path d="M17 9c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 22 17a5 5 0 0 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C13 11.5 16 9 17 9"/>
      <path d="M21 8.274V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.938"/>
      <path d="M3 15h5.253"/>
      <path d="M3 9h8.228"/>
      <path d="M8 15v6"/>
      <path d="M8 3v6"/>
    </g>
    <g stroke="url(#silverGrad)" stroke-width="2.25">
      <path d="M16 3v2.107"/>
      <path d="M17 9c1 3 2.5 3.5 3.5 4.5A5 5 0 0 1 22 17a5 5 0 0 1-10 0c0-.3 0-.6.1-.9a2 2 0 1 0 3.3-2C13 11.5 16 9 17 9"/>
      <path d="M21 8.274V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.938"/>
      <path d="M3 15h5.253"/>
      <path d="M3 9h8.228"/>
      <path d="M8 15v6"/>
      <path d="M8 3v6"/>
    </g>
  </g>
</svg>
`.trim();

const PROTOTYPE_BRICK_WALL_SHIELD_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" overflow="visible">
  <defs>
    <linearGradient id="silverGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f3f4f6"/>
      <stop offset="55%" stop-color="#9ca3af"/>
      <stop offset="100%" stop-color="#e5e7eb"/>
    </linearGradient>
    <filter id="iconShadow" x="-8" y="-8" width="40" height="40" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="1.15" stdDeviation="2.0" flood-color="#000" flood-opacity="0.5"/>
    </filter>
  </defs>
  <g filter="url(#iconShadow)" stroke-linecap="round" stroke-linejoin="round">
    <g stroke="#111827" stroke-opacity="0.7" stroke-width="3.6">
      <path d="M12 9v1.258"/>
      <path d="M16 3v5.46"/>
      <path d="M21 9.118V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5.75"/>
      <path d="M22 17.5c0 2.499-1.75 3.749-3.83 4.474a.5.5 0 0 1-.335-.005c-2.085-.72-3.835-1.97-3.835-4.47V14a.5.5 0 0 1 .5-.499c1 0 2.25-.6 3.12-1.36a.6.6 0 0 1 .76-.001c.875.765 2.12 1.36 3.12 1.36a.5.5 0 0 1 .5.5z"/>
      <path d="M3 15h7"/>
      <path d="M3 9h12.142"/>
      <path d="M8 15v6"/>
      <path d="M8 3v6"/>
    </g>
    <g stroke="url(#silverGrad)" stroke-width="2.25">
      <path d="M12 9v1.258"/>
      <path d="M16 3v5.46"/>
      <path d="M21 9.118V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5.75"/>
      <path d="M22 17.5c0 2.499-1.75 3.749-3.83 4.474a.5.5 0 0 1-.335-.005c-2.085-.72-3.835-1.97-3.835-4.47V14a.5.5 0 0 1 .5-.499c1 0 2.25-.6 3.12-1.36a.6.6 0 0 1 .76-.001c.875.765 2.12 1.36 3.12 1.36a.5.5 0 0 1 .5.5z"/>
      <path d="M3 15h7"/>
      <path d="M3 9h12.142"/>
      <path d="M8 15v6"/>
      <path d="M8 3v6"/>
    </g>
  </g>
</svg>
`.trim();

const PROTOTYPE_BRICK_WALL_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  PROTOTYPE_BRICK_WALL_SVG
)}`;
const PROTOTYPE_BRICK_WALL_FIRE_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  PROTOTYPE_BRICK_WALL_FIRE_SVG
)}`;
const PROTOTYPE_BRICK_WALL_SHIELD_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  PROTOTYPE_BRICK_WALL_SHIELD_SVG
)}`;

/* -------------------- THEME -------------------- */

const STYLES = {
  dark: {
    bgWater: "#081a2c",
    land: [118, 137, 156] as [number, number, number],
    border: [190, 203, 214] as [number, number, number],
    hex: [108, 120, 132] as [number, number, number],
    night: [54, 61, 72] as [number, number, number],
    highlight: [190, 201, 212] as [number, number, number],
    selectedBorder: [255, 255, 255] as [number, number, number],
  },
  light: {
    bgWater: "#BFE9FF",
    land: [240, 238, 215] as [number, number, number],
    border: [51, 65, 85] as [number, number, number],
    hex: [160, 161, 164] as [number, number, number],
    night: [95, 100, 110] as [number, number, number],
    highlight: [255, 255, 255] as [number, number, number],
    selectedBorder: [0, 0, 0] as [number, number, number],
  },
};

const SELECTED_DARKEN_FACTOR = 0.78;
const HOVER_DARKEN_FACTOR = 0.86;

function clampColorValue(value: number) {
  return Math.min(255, Math.max(0, value));
}

function darkenRgb(
  rgb: [number, number, number],
  factor = SELECTED_DARKEN_FACTOR
) {
  return rgb.map((value) => clampColorValue(Math.round(value * factor))) as [
    number,
    number,
    number
  ];
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

function normalizeProvinceName(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\s+(Province|Governorate|State|Region)$/i, "");
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

type SpatialBBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type SpatialIndexItem = SpatialBBox & {
  feature: Feature;
};

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
  if (!Array.isArray(coords)) {
    return bbox;
  }

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

function findSharedEdgeSegment(
  contourA: [number, number][],
  contourB: [number, number][]
): [[number, number], [number, number]] | null {
  const epsilon = 1e-5;
  const close = (p: [number, number], q: [number, number]) =>
    Math.abs(p[0] - q[0]) <= epsilon && Math.abs(p[1] - q[1]) <= epsilon;

  for (let i = 0; i < contourA.length; i++) {
    const a1 = contourA[i];
    const a2 = contourA[(i + 1) % contourA.length];
    for (let j = 0; j < contourB.length; j++) {
      const b1 = contourB[j];
      const b2 = contourB[(j + 1) % contourB.length];
      if ((close(a1, b1) && close(a2, b2)) || (close(a1, b2) && close(a2, b1))) {
        return [a1, a2];
      }
    }
  }
  return null;
}

function findSharedEdgeIndex(
  contourA: [number, number][],
  contourB: [number, number][]
): number | null {
  const epsilon = 1e-5;
  const close = (p: [number, number], q: [number, number]) =>
    Math.abs(p[0] - q[0]) <= epsilon && Math.abs(p[1] - q[1]) <= epsilon;

  for (let i = 0; i < contourA.length; i++) {
    const a1 = contourA[i];
    const a2 = contourA[(i + 1) % contourA.length];
    for (let j = 0; j < contourB.length; j++) {
      const b1 = contourB[j];
      const b2 = contourB[(j + 1) % contourB.length];
      if ((close(a1, b1) && close(a2, b2)) || (close(a1, b2) && close(a2, b1))) {
        return i;
      }
    }
  }

  return null;
}

function isResourceZoneHex(
  hexId: string | null,
  distribution: ResourceDistribution | null
) {
  if (!hexId || !distribution) return false;
  if (distribution.byHexId.has(hexId)) return true;
  for (const [centerHexId] of distribution.byHexId) {
    const zoneHexes = getResourceZoneHexes(centerHexId);
    if (zoneHexes.includes(hexId)) return true;
  }
  return false;
}

export type HexTile = {
  id: string;
  contour: [number, number][];
  center: [number, number];
};

type HexTileComputed = HexTile & {
  region: RegionInfo;
};

type HexGridResult = {
  gridData: HexTileComputed[];
  geoData: FeatureCollection | null;
  geoAdmin1: FeatureCollection | null;
  loading: boolean;
};

type HexOverlay = {
  id: string;
  hexId: string;
  image: string;
  bounds: [number, number, number, number];
  tintColor?: [number, number, number];
  transparentColor?: [number, number, number, number];
  wrapLongitude?: boolean;
  disableDepthTest?: boolean;
};

export type HexMapProps = {
  onHexClick?: (hexId: string) => void;
  onSelectionChange?: (hexId: string | null) => void;
  regionOwners?: RegionOwnersMap;
  diplomacyMap?: DiplomacyMap;
  currentCommunityId?: string | null;
  activeBattles?: ActiveBattleRow[];
  capitalHexIds?: string[];
  showResourceIcons?: boolean;
  drawerActionMode?: ActionMode;
  drawerOnFight?: () => Promise<{ battleId?: string }>;
  drawerActionLoading?: boolean;
  drawerActionResult?: RegionActionResult | null;
  drawerOnReloadData?: () => void | Promise<void>;
  drawerActiveBattleId?: string | null;
  drawerOnUpdateRegionName?: (hexId: string, newName: string) => Promise<void>;
  drawerUserRankTier?: number | null;
  drawerUserId?: string | null;
  drawerOnTravel?: (hexId: string) => Promise<void>;
  drawerUserCurrentHex?: string | null;
  drawerUserCurrentHexName?: string | null;
  drawerUserTicketCount?: number;
  drawerUserGold?: number;
  drawerIsFirstClaim?: boolean;
  prototypePaintBatches?: PrototypePaintBatch[];
  prototypeHexShaderDemo?: {
    hexId: string;
    patternKind?: number;
    borderColor?: [number, number, number];
    borderMaxAlpha?: number;
    borderFadeRatio?: number;
    debugFillAlpha?: number;
    edgeMask?: [number, number, number, number, number, number];
    edgeMidPower?: number;
    excludeSharedEdgesWithHexIds?: string[];
    sideEnabled?: boolean;
    sideDirLngLat?: [number, number];
    sideSoftnessRatio?: number;
    noiseEnabled?: boolean;
    noiseScale?: number;
    noiseAmount?: number;
    noisePaletteA?: [number, number, number];
    noisePaletteB?: [number, number, number];
    noiseDotScale?: number;
    noiseDotSize?: number;
    noiseThreshold?: number;
    fillColorA?: [number, number, number];
    fillColorB?: [number, number, number];
    fillAlpha?: number;
    fillGradientPower?: number;
    fillGlossDirLngLat?: [number, number];
    fillGlossMagnitude?: number;
    fillGlossPower?: number;
    cubeEnabled?: boolean;
    cubeLineThickness?: number;
    cubeLineColor?: [number, number, number];
    cubeShadeBoost?: number;
    centerFadeInner?: number;
    centerFadeOuter?: number;
  };
  prototypeHexShaderDemos?: Array<{
    hexId: string;
    patternKind?: number;
    borderColor?: [number, number, number];
    borderMaxAlpha?: number;
    borderFadeRatio?: number;
    debugFillAlpha?: number;
    edgeMask?: [number, number, number, number, number, number];
    edgeMidPower?: number;
    excludeSharedEdgesWithHexIds?: string[];
    sideEnabled?: boolean;
    sideDirLngLat?: [number, number];
    sideSoftnessRatio?: number;
    noiseEnabled?: boolean;
    noiseScale?: number;
    noiseAmount?: number;
    noisePaletteA?: [number, number, number];
    noisePaletteB?: [number, number, number];
    noiseDotScale?: number;
    noiseDotSize?: number;
    noiseThreshold?: number;
    fillColorA?: [number, number, number];
    fillColorB?: [number, number, number];
    fillAlpha?: number;
    fillGradientPower?: number;
    fillGlossDirLngLat?: [number, number];
    fillGlossMagnitude?: number;
    fillGlossPower?: number;
    cubeEnabled?: boolean;
    cubeLineThickness?: number;
    cubeLineColor?: [number, number, number];
    cubeShadeBoost?: number;
    centerFadeInner?: number;
    centerFadeOuter?: number;
  }>;
};

type PrototypePaintBatch = {
  id: string;
  centerHexId: string;
  maxDistance: number;
  color: [number, number, number];
  pulseColor?: [number, number, number];
  borderColor?: [number, number, number];
  distanceStep?: number;
  opacityDropPerStep?: number;
  minOpacity?: number;
  innerShades?: {
    scale: number;
    darkenFactor: number;
  }[];
};

type BattleLineSegment = {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
};

type BattleArrowTip = {
  id: string;
  polygon: [number, number][];
};

type BattleVisual = {
  id: string;
  attacker: HexTileComputed;
  defender: HexTileComputed;
  tipPolygon: [number, number][];
  defenderCenter: [number, number];
};

type CountryMeta = {
  name: string | null;
  iso: string | null;
  emoji: string | null;
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "united states of america": "US",
  "u.s.a.": "US",
  usa: "US",
  "the former yugoslav republic of macedonia": "MK",
  macedonia: "MK",
  "russian federation": "RU",
  russia: "RU",
  "iran, islamic republic of": "IR",
  "venezuela, bolivarian republic of": "VE",
  "tanzania, united republic of": "TZ",
  "bolivia, plurinational state of": "BO",
  "moldova, republic of": "MD",
  "korea, republic of": "KR",
  "korea, democratic people's republic of": "KP",
  "syrian arab republic": "SY",
  "lao people's democratic republic": "LA",
  "viet nam": "VN",
  "czech republic": "CZ",
};

const COUNTRY_NAME_TO_ISO = (() => {
  const map = new Map<string, string>();
  for (const [code, info] of Object.entries(countries)) {
    const tryAdd = (value: string | undefined | null) => {
      if (!value) return;
      map.set(value.toLowerCase(), code);
    };
    tryAdd(info.name);
    tryAdd(info.native);
    tryAdd(info.emoji);
  }
  return map;
})();

function countryNameToIso(name: string | null): string | null {
  if (!name) return null;
  const key = name.toLowerCase();
  return COUNTRY_NAME_ALIASES[key] ?? COUNTRY_NAME_TO_ISO.get(key) ?? null;
}

function isoToFlagEmoji(code: string | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return upper
    .split("")
    .map((char) =>
      String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - "A".charCodeAt(0))
    )
    .join("");
}

function getCountryMeta(name: string | null): CountryMeta {
  const iso = countryNameToIso(name);
  return { name, iso, emoji: isoToFlagEmoji(iso) };
}

function getCountryMetaFromIsoOrName(input: {
  iso2?: string | null;
  name?: string | null;
}): CountryMeta {
  const rawIso = input.iso2?.trim() ?? null;
  const iso = rawIso && /^[A-Za-z]{2}$/.test(rawIso) ? rawIso.toUpperCase() : null;
  if (iso) {
    const country = (countries as Record<string, { name?: string } | undefined>)[iso];
    return { name: country?.name ?? input.name ?? null, iso, emoji: isoToFlagEmoji(iso) };
  }
  const name = input.name ?? null;
  return getCountryMeta(name);
}

/* -------------------- UTILS -------------------- */

const DEG = Math.PI / 180;

function getDayOfYear(d: Date) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

function computeSunVector(date: Date): [number, number, number] {
  const day = getDayOfYear(date);
  const decl = 23.44 * Math.sin(((360 / 365) * (day - 81)) * DEG);

  const hours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;
  const hourAngle = (12 - hours) * 15;

  const declRad = decl * DEG;
  const hourRad = hourAngle * DEG;

  const x = Math.cos(declRad) * Math.cos(hourRad);
  const y = Math.cos(declRad) * Math.sin(hourRad);
  const z = Math.sin(declRad);

  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
}

function getDaylightAt(
  lon: number,
  lat: number,
  sun: [number, number, number]
) {
  const latR = lat * DEG;
  const lonR = lon * DEG;

  const nx = Math.cos(latR) * Math.cos(lonR);
  const ny = Math.cos(latR) * Math.sin(lonR);
  const nz = Math.sin(latR);

  return Math.max(0, nx * sun[0] + ny * sun[1] + nz * sun[2]);
}

function hash01(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function normalizeVector(x: number, y: number): [number, number] {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

function distanceSquared(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function hexToRgb(raw: string): [number, number, number] | null {
  if (!raw) return null;
  let hex = raw.trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (hex.length === 4) {
    const [, r, g, b] = hex;
    hex = `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length !== 7) return null;
  const value = Number.parseInt(hex.slice(1), 16);
  if (Number.isNaN(value)) return null;
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const METERS_PER_DEGREE_LAT = 111_320;

function metersBetween(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number]
) {
  const latAvg = (lat1 + lat2) / 2;
  const dx =
    (lon2 - lon1) *
    METERS_PER_DEGREE_LAT *
    Math.cos(latAvg * DEG);
  const dy = (lat2 - lat1) * METERS_PER_DEGREE_LAT;
  return Math.hypot(dx, dy);
}

function estimateHexRadiusMeters(tile: HexTileComputed): number {
  if (!tile || !tile.contour || !tile.contour.length) return 0;
  const center = tile.center;
  const vertex = tile.contour[0];
  const radius = metersBetween(center, vertex);
  return Math.max(1, radius);
}

function estimateHexRadiusDegrees(tile: HexTileComputed): number {
  if (!tile || !tile.contour || !tile.contour.length) return 0;
  const [cx, cy] = tile.center;
  const [vx, vy] = tile.contour[0];
  const radius = Math.hypot(vx - cx, vy - cy);
  return Math.max(1e-6, radius);
}

function lightenRgb(
  color: [number, number, number],
  amount = 0.35
): [number, number, number] {
  const clampToByte = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)));
  return [
    clampToByte(color[0] + (255 - color[0]) * amount),
    clampToByte(color[1] + (255 - color[1]) * amount),
    clampToByte(color[2] + (255 - color[2]) * amount),
  ];
}

function getResourceBorderColor(
  resourceKey: string,
  baseColor: [number, number, number] | null
): [number, number, number] | null {
  if (!baseColor) return null;
  if (resourceKey === "iron") {
    return lightenRgb(baseColor, 0.38);
  }
  return baseColor;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(t: number) {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(t: number) {
  const x = clamp01(t);
  return x < 0.5
    ? 4 * x * x * x
    : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* -------------------- DATA HOOK -------------------- */

function useHexGridData(): HexGridResult {
  const [gridData, setGridData] = useState<HexTileComputed[]>([]);
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const [geoAdmin1, setGeoAdmin1] = useState<FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const hexRes = await fetch(STATIC_HEX_DATA_URL);
        if (!hexRes.ok) throw new Error("Could not load world-hexes.json");
        const rawHexData = (await hexRes.json()) as HexTile[];

        let geoJson: FeatureCollection | null = null;
        try {
          const geoRes = await fetch(GEO_DATA_URL);
          if (geoRes.ok) geoJson = (await geoRes.json()) as FeatureCollection;
        } catch {
          geoJson = null;
        }

        let geoAdminJson: FeatureCollection | null = null;
        try {
          const adminRes = await fetch(GEO_ADMIN1_URL);
          if (adminRes.ok)
            geoAdminJson = (await adminRes.json()) as FeatureCollection;
        } catch {
          geoAdminJson = null;
        }

        if (!mounted) return;

        const computed = rawHexData
          .filter(
            (h) => h.center[1] <= MAX_NORTH_LAT && h.center[1] >= MIN_SOUTH_LAT
          )
          .map((h) => {
            const seed = hash01(h.id);
            const biome =
              seed < 0.2
                ? "Ocean"
                : seed < 0.45
                  ? "Plains"
                  : seed < 0.7
                    ? "Desert"
                    : seed < 0.9
                      ? "Forest"
                      : "Mountain";
            const danger: RegionInfo["danger"] =
              seed < 0.55 ? "Low" : seed < 0.85 ? "Medium" : "High";

            return {
              ...h,
              region: {
                name: `Sector ${h.id}`,
                owner:
                  seed < 0.33
                    ? "Neutral"
                    : seed < 0.66
                      ? "House Aurum"
                      : "House Obsidian",
                biome,
                danger,
              },
            } as HexTileComputed;
          });

        setGeoData(geoJson);
        setGeoAdmin1(geoAdminJson);
        setGridData(computed);
      } catch (e) {
        logError("HexMap", "Map data loading failed", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  return { gridData, geoData, geoAdmin1, loading };
}

/* -------------------- MAIN COMPONENT -------------------- */

export default function HexMapFlat({
  onHexClick,
  onSelectionChange,
  regionOwners,
  diplomacyMap,
  currentCommunityId,
  activeBattles = [],
  capitalHexIds = [],
  showResourceIcons = true,
  drawerActionMode,
  drawerOnFight,
  drawerActionLoading,
  drawerActionResult,
  drawerOnReloadData,
  drawerActiveBattleId,
  drawerOnUpdateRegionName,
  drawerUserRankTier,
  drawerUserId,
  drawerOnTravel,
  drawerUserCurrentHex = null,
  drawerUserCurrentHexName = null,
  drawerUserTicketCount = 0,
  drawerUserGold = 0,
  drawerIsFirstClaim = false,
  prototypePaintBatches,
  prototypeHexShaderDemo,
  prototypeHexShaderDemos,
}: HexMapProps) {
  const { theme, systemTheme } = useTheme();
  const isDark = (theme === "system" ? systemTheme : theme) === "dark";
  const palette = isDark ? STYLES.dark : STYLES.light;

  const { gridData, geoData, geoAdmin1, loading } = useHexGridData();

  const [is3DMode, setIs3DMode] = useState(false);
  const [viewState, setViewState] = useState<MapViewState>({
    longitude: 0,
    latitude: 20,
    zoom: 2,
    minZoom: 1.5,
    maxZoom: 8,
    pitch: 0,
    bearing: 0,
  });

  const [enableLighting, setEnableLighting] = useState(true);
  const [showBackgroundMap, setShowBackgroundMap] = useState(true);
  const [battleListVisible, setBattleListVisible] = useState(true);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null);
  const hoveredHexIdRef = useRef<string | null>(null);
  const [visualZoom, setVisualZoom] = useState(viewState.zoom);
  const [resourceDistribution, setResourceDistribution] =
    useState<ResourceDistribution | null>(null);
  const resourceAnimStartRef = useRef<{
    key: string | null;
    startMs: number;
    startWallMs: number;
  }>({ key: null, startMs: 0, startWallMs: 0 });
  const [reverseGeoByHexId, setReverseGeoByHexId] = useState<
    Record<string, { countryName: string | null; countryIso2: string | null; province: string | null } | null>
  >({});
  const visualZoomPendingRef = useRef(viewState.zoom);
  const visualZoomRafRef = useRef<number | null>(null);
  const hasActiveBattles = (activeBattles?.length ?? 0) > 0;
  const hasResourcePulse = Boolean(
    selectedId && isResourceZoneHex(selectedId, resourceDistribution)
  );
  const shouldAnimate = hasActiveBattles || hasResourcePulse;

  const handleHexHover = useCallback((info: PickingInfo<HexTileComputed>) => {
    const nextId = info?.object?.id ?? null;
    if (hoveredHexIdRef.current === nextId) return;
    hoveredHexIdRef.current = nextId;
    setHoveredHexId(nextId);
  }, []);

  /* -------------------- OPTIMIZED ANIMATION CLOCK (20FPS for animations) -------------------- */
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const [animTimeMs, setAnimTimeMs] = useState(0);
  const animTimeRef = useRef(0);
  const lastAnimUpdateRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!shouldAnimate) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      animTimeRef.current = 0;
      setAnimTimeMs(0);
      return;
    }

    startRef.current = performance.now();
    lastAnimUpdateRef.current = performance.now();
    lastFrameTimeRef.current = performance.now();
      const loop = (now: number) => {
        // Record FPS metrics
        const deltaMs = now - lastFrameTimeRef.current;
        globalPerformanceMonitor.recordFrame(deltaMs);
        lastFrameTimeRef.current = now;

        if (now - lastAnimUpdateRef.current >= 50) {
          const elapsed = now - startRef.current;
          if (animTimeRef.current !== elapsed) {
            animTimeRef.current = elapsed;
            setAnimTimeMs(elapsed);
          }
          lastAnimUpdateRef.current = now;
        }
        rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [shouldAnimate]);
  /* -------------------- END CLOCK -------------------- */

  useEffect(() => {
    visualZoomPendingRef.current = viewState.zoom;
    if (visualZoomRafRef.current !== null) return;

    visualZoomRafRef.current = requestAnimationFrame(() => {
      visualZoomRafRef.current = null;
      setVisualZoom(visualZoomPendingRef.current);
    });
  }, [viewState.zoom]);


  useEffect(() => {
    return () => {
      if (visualZoomRafRef.current !== null) {
        cancelAnimationFrame(visualZoomRafRef.current);
        visualZoomRafRef.current = null;
      }
    };
  }, []);

  const [sunVector, setSunVector] = useState<[number, number, number]>(() =>
    computeSunVector(new Date())
  );
  useEffect(() => {
    const update = () => setSunVector(computeSunVector(new Date()));
    const id = window.setInterval(update, SUN_UPDATE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = "(max-width: 768px)";
    const mql = window.matchMedia(mediaQuery);
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mql.matches);

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange);
    } else {
      mql.addListener(handleChange);
    }

    return () => {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", handleChange);
      } else {
        mql.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadResourceDistribution()
      .then((distribution) => {
        if (active) setResourceDistribution(distribution);
      })
      .catch((err) => {
        logError("HexMap", "Resource distribution load failed", err);
      });

    return () => {
      active = false;
    };
  }, []);

  const hexColorMap = useMemo(() => {
    const map: Record<string, [number, number, number]> = {};
    if (!regionOwners) return map;

    for (const [id, region] of Object.entries(regionOwners)) {
      if (region?.communities?.color) {
        const rgb = hexToRgb(region.communities.color);
        if (rgb) map[id] = rgb;
      }
    }
    return map;
  }, [regionOwners]);

  const tileById = useMemo(() => {
    const map: Record<string, HexTileComputed> = {};
    for (const tile of gridData) map[tile.id] = tile;
    return map;
  }, [gridData]);


  const tileTextureOverlays = useMemo<HexOverlay[]>(() => {
    if (!gridData.length) return [];

    const overlays: HexOverlay[] = [];

    for (const texture of TILE_TEXTURE_DEFINITIONS) {
      for (const hexEntry of texture.hexes) {
        const tile = tileById[hexEntry.hexId];
        if (!tile) continue;

        let minLon = Number.POSITIVE_INFINITY;
        let maxLon = Number.NEGATIVE_INFINITY;
        let minLat = Number.POSITIVE_INFINITY;
        let maxLat = Number.NEGATIVE_INFINITY;

        for (const [lon, lat] of tile.contour) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }

        if (
          !Number.isFinite(minLon) ||
          !Number.isFinite(maxLon) ||
          !Number.isFinite(minLat) ||
          !Number.isFinite(maxLat)
        ) {
          continue;
        }

        const isResource = texture.type === "resource";
        if (isResource) {
          const cx = (minLon + maxLon) / 2;
          const cy = (minLat + maxLat) / 2;
          const scale = 0.82;
          const halfLon = (maxLon - minLon) / 2 * scale;
          const halfLat = (maxLat - minLat) / 2 * scale;
          minLon = cx - halfLon;
          maxLon = cx + halfLon;
          minLat = cy - halfLat;
          maxLat = cy + halfLat;
        }

        overlays.push({
          id: `${texture.key}-${hexEntry.hexId}`,
          hexId: hexEntry.hexId,
          image: hexEntry.image ?? texture.image,
          bounds: [minLon, minLat, maxLon, maxLat],
          tintColor:
            hexEntry.tintColor ??
            texture.defaultTintColor ??
            undefined,
          transparentColor:
            hexEntry.transparentColor ??
            texture.defaultTransparentColor ??
            undefined,
          wrapLongitude:
            hexEntry.wrapLongitude ?? texture.wrapLongitude ?? true,
          disableDepthTest:
            hexEntry.disableDepthTest ??
            texture.disableDepthTest ??
            false,
        });
      }
    }

    return overlays;
  }, [gridData, tileById]);

  const communityHexLookup = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    if (!regionOwners) return map;
    for (const [hexId, region] of Object.entries(regionOwners)) {
      const owner = region?.owner_community_id;
      if (!owner) continue;
      if (!map[owner]) map[owner] = new Set();
      map[owner]!.add(hexId);
    }
    return map;
  }, [regionOwners]);

  const battleVisuals = useMemo(() => {
    const visuals: BattleVisual[] = [];
    if (!activeBattles?.length) return visuals;

    for (const battle of activeBattles) {
      if (battle.status !== "active") continue;

      const defenderTile = tileById[battle.target_hex_id];
      if (!defenderTile) continue;

      const owned = communityHexLookup[battle.attacker_community_id];
      if (!owned || owned.size === 0) continue;

      let attackerTile: HexTileComputed | null = null;
      const neighborIds = getHexNeighbors(defenderTile.id);

      for (const neighborId of neighborIds) {
        if (!neighborId || !owned.has(neighborId)) continue;
        const neighborTile = tileById[neighborId];
        if (neighborTile) {
          attackerTile = neighborTile;
          break;
        }
      }

      if (!attackerTile) {
        let bestDist = Number.POSITIVE_INFINITY;
        owned.forEach((hexId) => {
          const tile = tileById[hexId];
          if (!tile) return;
          const dist = distanceSquared(tile.center, defenderTile.center);
          if (dist < bestDist) {
            bestDist = dist;
            attackerTile = tile;
          }
        });
      }

      if (!attackerTile) continue;

      const defenderLon = defenderTile.center[0];
      const defenderLat = defenderTile.center[1];
      const attackerLon = attackerTile.center[0];
      const attackerLat = attackerTile.center[1];

      const lonScale = Math.max(0.15, Math.cos((defenderLat * Math.PI) / 180));
      const dx = (defenderLon - attackerLon) * lonScale;
      const dy = defenderLat - attackerLat;
      const dir = normalizeVector(dx, dy);
      const totalDist = Math.hypot(dx, dy) || 1;

      const forward = Math.min(0.18, totalDist * 0.12);
      const tip: [number, number] = [
        defenderLon + (dir[0] * forward) / lonScale,
        defenderLat + dir[1] * forward,
      ];

      const tipLength = Math.min(Math.max(totalDist * 0.28, 0.36), 0.78);
      const tipWidth = tipLength * 0.6;

      const baseCenter: [number, number] = [
        tip[0] - (dir[0] * tipLength) / lonScale,
        tip[1] - dir[1] * tipLength,
      ];

      const perp: [number, number] = [-dir[1], dir[0]];
      const left: [number, number] = [
        baseCenter[0] + (perp[0] * tipWidth) / lonScale,
        baseCenter[1] + perp[1] * tipWidth,
      ];
      const right: [number, number] = [
        baseCenter[0] - (perp[0] * tipWidth) / lonScale,
        baseCenter[1] - perp[1] * tipWidth,
      ];

      visuals.push({
        id: battle.id,
        attacker: attackerTile,
        defender: defenderTile,
        tipPolygon: [tip, left, right],
        defenderCenter: defenderTile.center,
      });
    }

    return visuals;
  }, [activeBattles, tileById, communityHexLookup]);

  const idSet = useMemo(() => new Set(gridData.map((t) => t.id)), [gridData]);

  const provinceIndex = useMemo(() => {
    const features = (geoAdmin1?.features ?? []) as Feature[];
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
  }, [geoAdmin1]);

  const countryIndex = useMemo(() => {
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
  }, [geoData]);

  const geoLookup = useMemo(() => {
    if (!provinceIndex && !countryIndex) return null;

    return (lon: number, lat: number) => {
      const point: [number, number] = [lon, lat];

      let provinceMatch:
        | { country: string | null; countryIso2: string | null; province: string | null }
        | null = null;

      if (provinceIndex) {
        const nearby = provinceIndex.search({
          minX: lon,
          minY: lat,
          maxX: lon,
          maxY: lat,
        });
        for (const item of nearby) {
          try {
            if (!geoContains(item.feature, point)) continue;
          } catch {
            continue;
          }

          const props = item.feature.properties as Record<string, unknown> | null | undefined;
          const provinceName = getStringProp(props, [
            "name",
            "NAME",
            "name_en",
            "NAME_EN",
            "gn_name",
            "GN_NAME",
            "abbrev",
            "ABBREV",
          ]);
          const provinceCountry = getStringProp(props, [
            "admin",
            "ADMIN",
            "sovereignt",
            "SOVEREIGNT",
            "geounit",
            "GEOUNIT",
          ]);
          const provinceIso2 = normalizeIso2(
            getStringProp(props, ["iso_a2", "ISO_A2"])
          );

          provinceMatch = {
            country: typeof provinceCountry === "string" ? provinceCountry : null,
            countryIso2: provinceIso2,
            province: typeof provinceName === "string" ? provinceName : null,
          };
          break;
        }
      }

      let countryMatch: { country: string | null; countryIso2: string | null } | null = null;
      if (countryIndex) {
        const nearby = countryIndex.search({
          minX: lon,
          minY: lat,
          maxX: lon,
          maxY: lat,
        });
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

          countryMatch = {
            country: typeof countryName === "string" ? countryName : null,
            countryIso2: iso2,
          };
          break;
        }
      }

      if (!provinceMatch && !countryMatch)
        return { country: null, countryIso2: null, province: null };

      return {
        country: provinceMatch?.country ?? countryMatch?.country ?? null,
        countryIso2: provinceMatch?.countryIso2 ?? countryMatch?.countryIso2 ?? null,
        province: provinceMatch?.province ?? null,
      };
    };
  }, [provinceIndex, countryIndex]);

  const selectedReverseGeo = selectedId ? reverseGeoByHexId[selectedId] : undefined;

  const selectedGeoContext = useMemo(() => {
    if (!selectedId) return null;
    const tile = tileById[selectedId];
    if (!tile) return null;
    return geoLookup ? geoLookup(tile.center[0], tile.center[1]) : null;
  }, [selectedId, tileById, geoLookup]);

  useEffect(() => {
    if (!selectedId) return;
    const needsReverse =
      !selectedGeoContext?.countryIso2 ||
      !selectedGeoContext?.country ||
      !selectedGeoContext?.province;
    if (!needsReverse) return;
    if (selectedReverseGeo !== undefined) return;

    const tile = tileById[selectedId];
    if (!tile) return;

    const [lon, lat] = tile.center;

    let cancelled = false;

    (async () => {
      try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
          lat
        )}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);
        const json = (await res.json()) as {
          countryName?: unknown;
          countryCode?: unknown;
          principalSubdivision?: unknown;
        };

        const countryName =
          typeof json.countryName === "string" ? json.countryName : null;
        const countryIso2 = normalizeIso2(
          typeof json.countryCode === "string" ? json.countryCode : null
        );

        const province = normalizeProvinceName(
          typeof json.principalSubdivision === "string"
            ? json.principalSubdivision
            : null
        );

        if (cancelled) return;
        setReverseGeoByHexId((prev) => ({
          ...prev,
          [selectedId]: { countryName, countryIso2, province },
        }));
      } catch {
        if (cancelled) return;
        setReverseGeoByHexId((prev) => ({ ...prev, [selectedId]: null }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId, tileById, selectedGeoContext, selectedReverseGeo]);

  const effectiveCapitalHexIds = useMemo(() => {
    const fromProp = (capitalHexIds ?? [])
      .map((hexId) => hexId.trim())
      .filter(Boolean);
    if (fromProp.length) return fromProp;
    const fromRegions = Object.values(regionOwners ?? {})
      .map((region) => region.communities?.capital_hex_id?.trim())
      .filter((hexId): hexId is string => Boolean(hexId));
    return Array.from(new Set(fromRegions));
  }, [capitalHexIds, regionOwners]);

  const selectedHex: DrawerHex | null = useMemo(() => {
    if (!selectedId) return null;
    const t = tileById[selectedId];
    if (!t) return null;

    const realRegion = regionOwners?.[selectedId];
    const ownerName = realRegion?.communities?.name;
    const ownerCommunity = realRegion?.communities ?? null;
    const ownerCommunityId = realRegion?.owner_community_id ?? null;

    let relation: DrawerHex["relation"] = "neutral";
    if (ownerCommunityId) {
      if (currentCommunityId && ownerCommunityId === currentCommunityId) {
        relation = "ally";
      } else if (currentCommunityId) {
        const key = makeDiplomacyKey(ownerCommunityId, currentCommunityId);
        const status = diplomacyMap?.[key];
        if (status === "war") relation = "enemy";
        else if (status === "ally") relation = "ally";
      }
    }

    const displayRegion: RegionInfo = {
      name: ownerName ? `Territory of ${ownerName}` : `Sector ${t.id}`,
      customName: realRegion?.custom_name ?? null,
      owner: ownerName ?? "Neutral",
      biome: t.region.biome,
      danger: t.region.danger,
      subtitle: ownerName ? "Occupied status" : "Awaiting conquest",
    };

    const geoContext = selectedGeoContext;
    const reverse = selectedReverseGeo ?? null;
    const countryMeta = getCountryMetaFromIsoOrName({
      iso2: geoContext?.countryIso2 ?? reverse?.countryIso2 ?? null,
      name: geoContext?.country ?? reverse?.countryName ?? null,
    });

    return {
      id: t.id,
      center: t.center,
      region: displayRegion,
      ownerCommunity,
      ownerCommunityId,
      relation,
      countryName: countryMeta.name,
      provinceName: geoContext?.province ?? reverse?.province ?? null,
      countryCode: countryMeta.iso,
      countryEmoji: countryMeta.emoji,
      isCapital: effectiveCapitalHexIds.includes(t.id),
    };
  }, [
    selectedId,
    tileById,
    regionOwners,
    currentCommunityId,
    diplomacyMap,
    selectedGeoContext,
    selectedReverseGeo,
    effectiveCapitalHexIds,
  ]);

  const selectedResourceBonus = useMemo(() => {
    if (!selectedId || !resourceDistribution) return null;
    return getHexResourceBonus(selectedId, resourceDistribution);
  }, [selectedId, resourceDistribution]);

  const selectedResourceZone = useMemo<SelectedResourceZone | null>(() => {
    const selectedHexId = selectedId;
    if (!selectedHexId || !resourceDistribution) return null;

    const centerBonus = getHexResourceBonus(selectedHexId, resourceDistribution);
    if (centerBonus) {
      return {
        centerHexId: selectedHexId,
        bonus: centerBonus,
        zoneHexes: getResourceZoneHexes(selectedHexId),
        isCenter: true,
      };
    }

    for (const [centerHexId, bonus] of resourceDistribution.byHexId) {
      if (centerHexId === selectedHexId) continue;
      const zoneHexes = getResourceZoneHexes(centerHexId);
      if (zoneHexes.includes(selectedHexId)) {
        return {
          centerHexId,
          bonus,
          zoneHexes,
          isCenter: false,
        };
      }
    }

    return null;
  }, [selectedId, resourceDistribution]);

  const selectedResourceZoneKey = selectedResourceZone
    ? `${selectedResourceZone.centerHexId}:${selectedResourceZone.bonus.resourceKey}`
    : null;

  if (selectedResourceZoneKey && selectedResourceZoneKey !== resourceAnimStartRef.current.key) {
    resourceAnimStartRef.current = {
      key: selectedResourceZoneKey,
      startMs: animTimeMs,
      startWallMs:
        typeof performance !== "undefined" ? performance.now() : Date.now(),
    };
  }

  const selectedResourceStat = useMemo(() => {
    if (!selectedResourceZone || !selectedId) return null;
    const selectedHexId = selectedId;
    const isCenter = selectedResourceZone.isCenter;
    const centerBonus = isCenter ? selectedResourceZone.bonus : null;
    const bufferBonus = !isCenter ? selectedResourceZone.bonus : null;
    const statBonus = selectedResourceZone.bonus;

    let valueText = `${statBonus.resourceName} ${statBonus.percentage}`;
    let valueClassName: string | undefined;

    if (bufferBonus && !centerBonus) {
      valueText = "Buffer Zone";
    } else if (centerBonus) {
      const ownerRegion = regionOwners?.[selectedHexId];
      const ownerId = ownerRegion?.owner_community_id;
      if (ownerId) {
        const ownedNeighborCount = getHexNeighbors(selectedHexId).filter(
          (hexId) => regionOwners?.[hexId]?.owner_community_id === ownerId
        ).length;

        let bufferedStep:
          | (typeof RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps)[number]
          | null = null;
        for (const step of RESOURCE_DISTRIBUTION_RULES.bonusZoneSteps) {
          if (step.minNeighbors <= 0) continue;
          if (ownedNeighborCount >= step.minNeighbors) {
            bufferedStep = step;
          }
        }

        if (bufferedStep) {
          const multiplier = Math.min(3, Math.floor(ownedNeighborCount / 2));
          if (multiplier > 0) {
            valueText = `${formatBonusPercentage(bufferedStep.bonus)} · ${multiplier}x Buffered`;
            valueClassName = "text-emerald-400";
          }
        }
      }
    }

    return {
      bonus: statBonus,
      valueText,
      valueClassName,
    };
  }, [selectedResourceZone, regionOwners, selectedId]);

type SelectedResourceZone = {
  centerHexId: string;
  bonus: HexResourceBonus;
  zoneHexes: string[];
  isCenter: boolean;
};

function buildZoneBorderData({
  hexIds,
  tileById,
  zoneSet,
  color,
  alpha,
  orderByHex,
  borderWidthRatio,
  minBorderWidth,
}: {
  hexIds: string[];
  tileById: Record<string, HexTileComputed>;
  zoneSet: Set<string>;
  color: [number, number, number];
  alpha: number;
  orderByHex?: Map<string, number>;
  borderWidthRatio: number;
  minBorderWidth: number;
}): HexBorderDatum[] {
  const data: HexBorderDatum[] = [];

  for (const hexId of hexIds) {
    const tile = tileById[hexId];
    if (!tile?.contour?.length) continue;

    const edgeMask: [number, number, number, number, number, number] = [
      1, 1, 1, 1, 1, 1,
    ];

    for (const neighborId of getHexNeighbors(hexId)) {
      if (!zoneSet.has(neighborId)) continue;
      const neighborTile = tileById[neighborId];
      if (!neighborTile?.contour?.length) continue;
      const edgeIndex = findSharedEdgeIndex(tile.contour, neighborTile.contour);
      if (edgeIndex !== null) {
        edgeMask[edgeIndex] = 0;
      }
    }

    const hasVisibleEdge = edgeMask.some((value) => value > 0.01);
    if (!hasVisibleEdge) continue;

    const radiusDeg = estimateHexRadiusDegrees(tile);
    const borderWidth = Math.max(minBorderWidth, radiusDeg * borderWidthRatio);

    data.push({
      id: `resource-zone:${hexId}`,
      center: tile.center,
      vertices: tile.contour,
      color,
      alpha,
      borderWidth,
      edgeMask,
      order: orderByHex?.get(hexId) ?? -1,
    });
  }

  return data;
}

  const selectedResourceZoneBorders = useMemo<HexBorderDatum[]>(() => {
    if (!selectedResourceZone) return [];
    const baseColor = hexToRgb(getResourceColor(selectedResourceZone.bonus.resourceKey));
    if (!baseColor) return [];
    const zoneColor = getResourceBorderColor(
      selectedResourceZone.bonus.resourceKey,
      baseColor
    );
    if (!zoneColor) return [];

    const orderByHex = new Map<string, number>();
    selectedResourceZone.zoneHexes.forEach((hexId, index) => {
      orderByHex.set(hexId, index);
    });

    const zoneSet = new Set(selectedResourceZone.zoneHexes);

    return buildZoneBorderData({
      hexIds: selectedResourceZone.zoneHexes,
      tileById,
      zoneSet,
      color: zoneColor,
      alpha: 0.9,
      orderByHex,
      borderWidthRatio: 0.075,
      minBorderWidth: 0.015,
    });
  }, [selectedResourceZone, tileById]);

  const ownedResourceZoneBorders = useMemo<HexBorderDatum[]>(() => {
    if (!resourceDistribution || !regionOwners || !currentCommunityId) return [];
    const ownedHexes = new Set<string>();
    for (const [hexId, region] of Object.entries(regionOwners)) {
      if (region?.owner_community_id === currentCommunityId) {
        ownedHexes.add(hexId);
      }
    }
    if (!ownedHexes.size) return [];

    const data: HexBorderDatum[] = [];

    for (const [centerHexId, bonus] of resourceDistribution.byHexId) {
      const zoneHexes = getResourceZoneHexes(centerHexId);
      const ownedZoneHexes = zoneHexes.filter((hexId) => ownedHexes.has(hexId));
      if (!ownedZoneHexes.length) continue;

      const baseColor = hexToRgb(getResourceColor(bonus.resourceKey));
      if (!baseColor) continue;
      const zoneColor = getResourceBorderColor(bonus.resourceKey, baseColor);
      if (!zoneColor) continue;

      const zoneSet = new Set(ownedZoneHexes);
        data.push(
          ...buildZoneBorderData({
            hexIds: ownedZoneHexes,
            tileById,
            zoneSet,
            color: zoneColor,
            alpha: 0.75,
            borderWidthRatio: 0.075,
            minBorderWidth: 0.015,
          })
        );
    }

    return data;
  }, [resourceDistribution, regionOwners, currentCommunityId, tileById]);

  useEffect(() => {
    onSelectionChange?.(selectedId);
  }, [selectedId, onSelectionChange]);

  const battleLineWidth = useMemo(() => {
    const zoom = visualZoom ?? 2;
    const scaled = zoom * 0.45;
    return Math.max(0.8, Math.min(2.8, scaled));
  }, [visualZoom]);

  const toggle3D = useCallback(() => {
    setIs3DMode((prev) => {
      const next = !prev;
      setViewState((v) => ({
        ...v,
        pitch: next ? TILT_ANGLE : 0,
        bearing: 0,
        transitionDuration: 650,
        transitionInterpolator: new FlyToInterpolator(),
      }));
      return next;
    });
  }, []);

  const prototypeShaderFocusOnceRef = useRef(false);
  useEffect(() => {
    const demoHexId =
      prototypeHexShaderDemos?.[0]?.hexId ?? prototypeHexShaderDemo?.hexId;
    if (!demoHexId) return;
    if (prototypeShaderFocusOnceRef.current) return;
    const tile = tileById[demoHexId];
    if (!tile) return;

    prototypeShaderFocusOnceRef.current = true;
    setViewState((v) => ({
      ...v,
      longitude: tile.center[0],
      latitude: tile.center[1],
      zoom: Math.max(v.zoom, 6),
      bearing: 0,
      pitch: is3DMode ? TILT_ANGLE : 0,
      transitionDuration: 900,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, [prototypeHexShaderDemos, prototypeHexShaderDemo?.hexId, tileById, is3DMode]);

  const VIEW_ZOOM_STEP = 0.75;

  const handleZoomIn = useCallback(() => {
    setViewState((v) => ({
      ...v,
      zoom: Math.min(v.maxZoom ?? 8, v.zoom + VIEW_ZOOM_STEP),
      transitionDuration: 200,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState((v) => ({
      ...v,
      zoom: Math.max(v.minZoom ?? 1, v.zoom - VIEW_ZOOM_STEP),
      transitionDuration: 200,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, []);

  const moveSelection = useCallback(
    (dir: "left" | "right" | "up" | "down") => {
      if (!selectedId) return;
      const p = parseGridId(selectedId);
      if (!p) return;

      const { row, col } = p;
      const candidates = [
        dir === "left"
          ? makeGridId(row, col - 1)
          : dir === "right"
            ? makeGridId(row, col + 1)
            : dir === "up"
              ? makeGridId(row - 1, col)
              : makeGridId(row + 1, col),
      ];

      for (let step = 2; step <= 6; step++) {
        candidates.push(
          dir === "left"
            ? makeGridId(row, col - step)
            : dir === "right"
              ? makeGridId(row, col + step)
              : dir === "up"
                ? makeGridId(row - step, col)
                : makeGridId(row + step, col)
        );
      }

      for (const c of candidates) {
        if (idSet.has(c)) {
          setSelectedId(c);
          return;
        }
      }
    },
    [selectedId, idSet]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      const key = e.key.toLowerCase();
      if (!selectedId) return;

      if (key === "escape") setSelectedId(null);
      if (key === "arrowleft" || key === "a") moveSelection("left");
      if (key === "arrowright" || key === "d") moveSelection("right");
      if (key === "arrowup" || key === "w") moveSelection("up");
      if (key === "arrowdown" || key === "s") moveSelection("down");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, moveSelection]);

  const onViewStateChange = useCallback(
    ({
      viewState: nextState,
      interactionState,
    }: ViewStateChangeParameters<MapViewState>) => {
      const isInteracting =
        interactionState?.isDragging || interactionState?.isZooming;
      const minZoom = nextState.minZoom ?? viewState?.minZoom ?? 1;
      const maxZoom = nextState.maxZoom ?? viewState?.maxZoom ?? 8;
      const clampedZoom = Math.min(
        Math.max(nextState.zoom, minZoom),
        maxZoom
      );

      setViewState(() => ({
        ...nextState,
        zoom: clampedZoom,
        pitch: is3DMode ? TILT_ANGLE : 0,
        transitionDuration: isInteracting ? 0 : nextState.transitionDuration || 0,
      }));
    },
    [is3DMode, viewState?.maxZoom, viewState?.minZoom]
  );

  // Pre-compute base colors for all tiles to avoid per-frame calculation
  type ColorCacheEntry = {
    rgb: [number, number, number];
    alpha: number;
    lastAccess: number;
  };
  const maxColorCacheSize = Math.max(2000, gridData.length);
  const colorCacheRef = useRef<Map<string, ColorCacheEntry>>(new Map());

  const purgeColorCache = useCallback(() => {
    const cache = colorCacheRef.current;
    if (cache.size <= maxColorCacheSize) return;

    const sorted = Array.from(cache.entries()).sort(
      (a, b) => a[1].lastAccess - b[1].lastAccess
    );
    const evictionCount = Math.max(1, Math.floor(sorted.length * 0.2));

    for (let i = 0; i < evictionCount; i++) {
      cache.delete(sorted[i][0]);
    }
  }, [maxColorCacheSize]);

  // Update color cache when lighting conditions change
  useEffect(() => {
    colorCacheRef.current.clear();
  }, [
    enableLighting,
    sunVector[0],
    sunVector[1],
    sunVector[2],
    palette,
    isDark,
    hexColorMap,
    gridData.length,
  ]);

  // Memoize color computation with cache - only compute once per tile per lighting condition
  const computeTileColor = useCallback(
    (tile: HexTileComputed): { rgb: [number, number, number]; alpha: number } => {
      const cacheKey = tile.id;

      const cached = colorCacheRef.current.get(cacheKey);
      if (cached) {
        cached.lastAccess = Date.now();
        return { rgb: cached.rgb, alpha: cached.alpha };
      }

      const ownerRgb = hexColorMap[tile.id];
      if (
        ownerRgb &&
        ownerRgb.length === 3 &&
        ownerRgb.every((value) => typeof value === "number" && value >= 0 && value <= 255)
      ) {
        const entry: ColorCacheEntry = {
          rgb: ownerRgb as [number, number, number],
          alpha: 180,
          lastAccess: Date.now(),
        };
        colorCacheRef.current.set(cacheKey, entry);
        if (colorCacheRef.current.size > maxColorCacheSize) {
          purgeColorCache();
        }
        return { rgb: entry.rgb, alpha: entry.alpha };
      }

      const daylight = enableLighting
        ? getDaylightAt(tile.center[0], tile.center[1], sunVector)
        : 1;

      const t = Math.pow(daylight, 0.55);

      let r = Math.round(palette.night[0] * (1 - t) + palette.hex[0] * t);
      let g = Math.round(palette.night[1] * (1 - t) + palette.hex[1] * t);
      let b = Math.round(palette.night[2] * (1 - t) + palette.hex[2] * t);

      if (enableLighting) {
        const highlightBase = Math.max(0, (daylight - 0.6) / 0.4);
        const highlightMix = Math.min(
          1,
          Math.pow(highlightBase, 1.35) * (isDark ? 0.55 : 1.35)
        );

        if (highlightMix > 0) {
          r = clampColorValue(
            Math.round(r * (1 - highlightMix) + palette.highlight[0] * highlightMix)
          );
          g = clampColorValue(
            Math.round(g * (1 - highlightMix) + palette.highlight[1] * highlightMix)
          );
          b = clampColorValue(
            Math.round(b * (1 - highlightMix) + palette.highlight[2] * highlightMix)
          );
        }

        const shadowStrength = Math.pow(
          Math.max(0, 1 - daylight),
          isDark ? 1 : 1.35
        );

        if (shadowStrength > 0) {
          const shadowAmount = shadowStrength * (isDark ? 10 : 34);
          r = clampColorValue(Math.round(r - shadowAmount));
          g = clampColorValue(Math.round(g - shadowAmount));
          b = clampColorValue(Math.round(b - shadowAmount));
        }
      }

      const result: ColorCacheEntry = {
        rgb: [r, g, b] as [number, number, number],
        alpha: 215,
        lastAccess: Date.now(),
      };
      colorCacheRef.current.set(cacheKey, result);
      if (colorCacheRef.current.size > maxColorCacheSize) {
        purgeColorCache();
      }
      return { rgb: result.rgb, alpha: result.alpha };
    },
    [
      hexColorMap,
      enableLighting,
      sunVector,
      palette,
      isDark,
      maxColorCacheSize,
      purgeColorCache,
    ]
  );

  const lightingEffect = useMemo(() => {
    const ambientLight = new AmbientLight({
      color: [255, 255, 255],
      intensity: enableLighting ? 0.55 : 1.0,
    });

    const directionalLight = new DirectionalLight({
      color: [255, 255, 255],
      intensity: enableLighting ? 6.5 : 0.0,
      direction: sunVector,
      _shadow: false,
    });

    return new LightingEffect({ ambientLight, directionalLight });
  }, [enableLighting, sunVector]);

  // Separate static layers (map, borders, textures) from animation layers
  // This prevents full layer rebuild on every animation frame update
  const staticLayers = useMemo(() => {
    const layerList: Layer[] = [];

    if (geoData && showBackgroundMap) {
      layerList.push(
        new GeoJsonLayer({
          id: "base-map",
          data: geoData,
          filled: true,
          stroked: false,
          getFillColor: palette.land as Color,
          opacity: 0.9,
          pickable: false,
          wrapLongitude: true,
        }),
        new GeoJsonLayer({
          id: "base-borders",
          data: geoData,
          filled: false,
          stroked: true,
          lineWidthUnits: "pixels",
          getLineWidth: 1.0,
          getLineColor: palette.border as Color,
          opacity: 0.85,
          pickable: false,
          wrapLongitude: true,
        })
      );
    }

    return layerList;
  }, [geoData, showBackgroundMap, palette]);

  const textureLayers = useMemo(() => {
    if (!tileTextureOverlays.length) return [];
    return tileTextureOverlays.map(
      (overlay) =>
        new BitmapLayer({
          id: `tile-texture-${overlay.id}`,
          image: overlay.image,
          bounds: overlay.bounds,
          transparentColor: overlay.transparentColor ?? [0, 0, 0, 0],
          tintColor: overlay.tintColor ?? [255, 255, 255],
          parameters: overlay.disableDepthTest ? { depthCompare: "always" } : undefined,
          pickable: false,
          wrapLongitude: overlay.wrapLongitude ?? true,
        })
    );
  }, [tileTextureOverlays]);

  type ResourceIconDatum = {
    id: string;
    resourceKey: keyof typeof RESOURCE_ICON_MAP;
    sizeMeters: number;
    center: [number, number];
  };

  const resourceIconData = useMemo(() => {
    if (!showResourceIcons || !resourceDistribution) {
      return {
        sizeMeters: 0,
        data: [] as ResourceIconDatum[],
      };
    }

    const iconScale = 1.35;

    const data: ResourceIconDatum[] = [];
    for (const [hexId, bonus] of resourceDistribution.byHexId) {
      const tile = tileById[hexId];
      if (!tile) continue;
      const resourceKey = bonus.resourceKey as keyof typeof RESOURCE_ICON_MAP;
      if (!RESOURCE_ICON_MAP[resourceKey]) continue;

      const radiusMeters = estimateHexRadiusMeters(tile);

      data.push({
        id: `resource-${resourceKey}-${tile.id}`,
        resourceKey,
        sizeMeters: radiusMeters * iconScale,
        center: tile.center,
      });
    }

    return { sizeMeters: 0, data };
  }, [resourceDistribution, tileById, showResourceIcons]);

  const resourceIconLayer = useMemo(() => {
    if (!resourceIconData.data.length) return null;
    const zOffset = is3DMode ? 2400 : 0;

    return new IconLayer<ResourceIconDatum>({
      id: "resource-icons",
      data: resourceIconData.data,
      pickable: false,
      billboard: true,
      sizeUnits: "meters",
      sizeScale: 1,
      colorFormat: "RGBA",
      getIcon: (d) => RESOURCE_ICON_MAP[d.resourceKey] as any,
      getPosition: (d) => [d.center[0], d.center[1], zOffset],
      getSize: (d) => d.sizeMeters,
      getColor: (d) => RESOURCE_ICON_COLORS[d.resourceKey],
      wrapLongitude: true,
      parameters: { depthCompare: "always" },
    });
  }, [resourceIconData, is3DMode]);

  const hexLayer = useMemo(() => {
    if (!gridData.length) return null;

    const extrudedMaterial: Material = {
      ambient: 0.06,
      diffuse: 0.55,
      shininess: 140,
      specularColor: [255, 255, 255],
    };

    return new PolygonLayer<HexTileComputed>({
      id: "hexes",
      data: gridData,
      pickable: true,
      autoHighlight: false,
      highlightColor: [...palette.highlight, 180] as number[],
      extruded: is3DMode,
      getElevation: () => (is3DMode ? 2200 : 0),
      elevationScale: 1,
      filled: true,
      stroked: false,
      wireframe: false,
      getPolygon: (d) => d.contour,
      getFillColor: (tile) => {
        const base = computeTileColor(tile);
        return [...base.rgb, base.alpha];
      },
      material: is3DMode ? extrudedMaterial : undefined,
      wrapLongitude: true,
      updateTriggers: {
        getFillColor: [hexColorMap, enableLighting, sunVector, isDark, palette],
      },
      onHover: handleHexHover,
      onClick: (info: PickingInfo<HexTileComputed>) => {
        const id = info?.object?.id ?? null;
        if (!id || id === selectedId) return;
        setSelectedId(id);
        onHexClick?.(id);
      },
    });
  }, [
    gridData,
    is3DMode,
    palette,
    computeTileColor,
    hexColorMap,
    enableLighting,
    sunVector,
    isDark,
    handleHexHover,
    selectedId,
    onHexClick,
  ]);

  const hoverLayer = useMemo(() => {
    if (!hoveredHexId || hoveredHexId === selectedId) return null;
    const tile = tileById[hoveredHexId];
    if (!tile) return null;
    const base = computeTileColor(tile);
    const darker = darkenRgb(base.rgb, HOVER_DARKEN_FACTOR);

    return new PolygonLayer<HexTileComputed>({
      id: "hex-hover",
      data: [tile],
      filled: true,
      stroked: false,
      getFillColor: () => [...darker, base.alpha],
      getPolygon: (d) => d.contour,
      extruded: is3DMode,
      getElevation: is3DMode ? 2230 : 0,
      pickable: false,
    });
  }, [hoveredHexId, selectedId, tileById, computeTileColor, is3DMode]);

  const selectionLayer = useMemo(() => {
    if (!selectedId) return null;
    const selectedTile = tileById[selectedId];
    if (!selectedTile) return null;
    const base = computeTileColor(selectedTile);
    const darker = darkenRgb(base.rgb);

    return new PolygonLayer<HexTileComputed>({
      id: "hex-selection",
      data: [selectedTile],
      filled: true,
      stroked: false,
      getFillColor: () => [...darker, 230],
      getPolygon: (d) => d.contour,
      extruded: is3DMode,
      getElevation: is3DMode ? 2250 : 0,
      pickable: false,
    });
  }, [selectedId, tileById, computeTileColor, is3DMode]);

  const capitalRingLayer = useMemo(() => {
    if (!effectiveCapitalHexIds.length) return null;
    const data: HexCapitalRingDatum[] = [];
    const seen = new Set<string>();
    const ringColor: [number, number, number] = [214, 186, 118];
    const ringAlpha = 1;

    for (const hexId of effectiveCapitalHexIds) {
      if (!hexId || seen.has(hexId)) continue;
      const tile = tileById[hexId];
      if (!tile) continue;
      const vertices = tile.contour.slice(0, 6) as [number, number][];
      if (vertices.length !== 6) continue;
      const edgeMid: [number, number] = [
        (vertices[0][0] + vertices[1][0]) * 0.5,
        (vertices[0][1] + vertices[1][1]) * 0.5,
      ];
      const apothem = Math.hypot(
        edgeMid[0] - tile.center[0],
        edgeMid[1] - tile.center[1]
      );
      // Keep the ring clearly visible while staying inside the hex border layers.
      const ringRadius = apothem * 1.1;
      const ringWidth = apothem * 0.58;
      const ringFeather = ringWidth * 0;
      data.push({
        id: `capital-${hexId}`,
        center: tile.center,
        vertices,
        color: ringColor,
        alpha: ringAlpha,
        ringRadius,
        ringWidth,
        feather: ringFeather,
      });
      seen.add(hexId);
    }

    if (!data.length) return null;
    return new HexCapitalRingLayer({
      id: "capital-hex-rings",
      data,
    });
  }, [effectiveCapitalHexIds, tileById]);

  const resourceZoneLayers = useMemo(() => {
    if (!selectedResourceZoneBorders.length && !ownedResourceZoneBorders.length) return [];
    const layers: Layer[] = [];

    const stepDelayMs = 150;
    const fadeMs = 240;
    const wallNow =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const wallElapsed = Math.max(
      0,
      wallNow - resourceAnimStartRef.current.startWallMs
    );
    const elapsed = Math.max(
      0,
      Math.max(animTimeMs - resourceAnimStartRef.current.startMs, wallElapsed)
    );

    const selectedBorderIds = selectedResourceZoneBorders.length
      ? new Set(selectedResourceZoneBorders.map((entry) => entry.id))
      : null;
    const ownedBorders = selectedBorderIds
      ? ownedResourceZoneBorders.filter((entry) => !selectedBorderIds.has(entry.id))
      : ownedResourceZoneBorders;

    if (ownedBorders.length) {
      layers.push(
        new HexBorderLayer({
          id: "resource-zone-owned-borders",
          data: ownedBorders,
          animate: false,
          animationTimeMs: 0,
          animationStepMs: stepDelayMs,
          animationFadeMs: fadeMs,
        })
      );
    }

    if (selectedResourceZoneBorders.length) {
      layers.push(
        new HexBorderLayer({
          id: "resource-zone-selected-borders",
          data: selectedResourceZoneBorders,
          animate: true,
          animationTimeMs: elapsed,
          animationStepMs: stepDelayMs,
          animationFadeMs: fadeMs,
        })
      );
    }

    return layers;
  }, [
    selectedResourceZoneBorders,
    ownedResourceZoneBorders,
    animTimeMs,
    selectedResourceZoneKey,
  ]);

  const battleLayers = useMemo(() => {
    if (!battleVisuals.length) return [];
    const layers: Layer[] = [];
    const lineHeight = is3DMode ? 4200 : 0;

    const battleLines: BattleLineSegment[] = battleVisuals.map((battle) => ({
      id: `${battle.id}-line`,
      from: [battle.attacker.center[0], battle.attacker.center[1], lineHeight],
      to: [battle.defender.center[0], battle.defender.center[1], lineHeight],
    }));

    const arrowTips: BattleArrowTip[] = battleVisuals.map((battle) => ({
      id: `${battle.id}-tip`,
      polygon: battle.tipPolygon,
    }));

    layers.push(
      new LineLayer<BattleLineSegment>({
        id: "battle-lines",
        data: battleLines,
        widthUnits: "pixels",
        widthMinPixels: battleLineWidth,
        getWidth: () => battleLineWidth,
        getSourcePosition: (d) => d.from,
        getTargetPosition: (d) => d.to,
        getColor: () => [239, 68, 68, 230] as Color,
      })
    );

    /* ==================== BATTLE PING (20FPS THROTTLED, OPTIMIZED) ==================== */

    const cycleMs = 2600;
    const rawT = (animTimeMs % cycleMs) / cycleMs;
    const easeInOutSine = (x: number) =>
      -(Math.cos(Math.PI * x) - 1) / 2;
    const breathPhase = rawT < 0.5 ? rawT * 2 : (1 - rawT) * 2;
    const easedBreath = easeInOutSine(breathPhase);

    const zoom = visualZoom ?? 5;
    const zoomMinForPing = 2;
    const zoomMaxForPing = 8;
    const zoom01 = Math.min(
      1,
      Math.max(0, (zoom - zoomMinForPing) / (zoomMaxForPing - zoomMinForPing))
    );
    const zoomDetailBoost = zoom >= zoomMaxForPing ? 1.3 : 1;
    const zoomStepIndex = Math.round(
      (zoomMaxForPing - zoom) / VIEW_ZOOM_STEP
    );
    const level7Scale = zoomStepIndex === 6 ? 0.9 : 1;

    const coreZoomScale = 0.5 + zoom01 * 6.5;
    const coreBasePx = 9.2;
    const corePulseAmp = 0.9;
    const corePulseBase = 1;
    const corePulseRange = 0.25;
    const corePulse =
      corePulseBase + corePulseRange * (2 * easedBreath - 1);
    const coreRadiusPxRaw =
      coreBasePx * coreZoomScale * (1 - corePulseAmp + corePulse * corePulseAmp);
    const coreRadiusPx =
      Math.min(14, coreRadiusPxRaw * zoomDetailBoost) * level7Scale;
    const coreAlphaBase = 200;
    const coreAlphaPulse = 55;
    const coreAlpha = Math.min(
      255,
      Math.round(coreAlphaBase + easedBreath * coreAlphaPulse)
    );

    const ringZoomScale = 2.0 - zoom01 * 0.9;
    const ringStartMultiplier = 1.35;
    const ringStartPx = coreRadiusPx * ringStartMultiplier;
    const ringTravelBasePx = 10;
    const ringTravelPx = ringTravelBasePx * ringZoomScale * level7Scale;
    const splashPhase = Math.min(1, rawT / 0.5);
    const ringRadiusPx =
      ringStartPx + ringTravelPx * easeInOutSine(splashPhase);
    const ringFadeExponent = 2.6;
    const ringAlphaBase = 200;
    const ringAlpha =
      rawT < 0.5
        ? Math.round(
            ringAlphaBase * Math.pow(1 - splashPhase, ringFadeExponent)
          )
        : 0;
    const ringLineWidthPx = 1.4;

    layers.push(
      new ScatterplotLayer<BattleVisual>({
        id: "battle-ping-core",
        data: battleVisuals,
        radiusUnits: "pixels",
        radiusMinPixels: 0,
        radiusMaxPixels: 30,
        getRadius: () => coreRadiusPx,
        getPosition: (d) => d.defenderCenter,
        filled: true,
        stroked: false,
        getFillColor: () => [239, 68, 68, coreAlpha] as Color,
        updateTriggers: {
          getRadius: [animTimeMs, zoom],
          getFillColor: [animTimeMs],
        },
      })
    );

    layers.push(
      new ScatterplotLayer<BattleVisual>({
        id: "battle-ping-ring",
        data: battleVisuals,
        radiusUnits: "pixels",
        radiusMinPixels: 0,
        radiusMaxPixels: 140,
        getRadius: () => ringRadiusPx,
        getPosition: (d) => d.defenderCenter,
        filled: false,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: () => ringLineWidthPx,
        getLineColor: () => [239, 68, 68, ringAlpha] as Color,
        updateTriggers: {
          getRadius: [animTimeMs, zoom],
          getLineColor: [animTimeMs],
        },
      })
    );

    /* ==================== END BATTLE PING ==================== */

    if (arrowTips.length) {
      layers.push(
        new PolygonLayer<BattleArrowTip>({
          id: "battle-arrow-tips",
          data: arrowTips,
          getPolygon: (d) => d.polygon,
          filled: true,
          stroked: false,
          getFillColor: () => [239, 68, 68, 255] as Color,
        })
      );
    }

    return layers;
  }, [
    battleVisuals,
    battleLineWidth,
    animTimeMs,
    visualZoom,
    is3DMode,
  ]);

  type PrototypePaintedHex = {
    id: string;
    hexId: string;
    paintKey: string;
    contour: [number, number][];
    center: [number, number];
    pulseColor?: [number, number, number];
    fillColor: [number, number, number, number];
    borderColor: [number, number, number, number];
    innerPolygons: {
      contour: [number, number][];
      color: [number, number, number, number];
    }[];
  };

  const prototypePaintedHexes = useMemo<PrototypePaintedHex[]>(() => {
    const batches = prototypePaintBatches ?? [];
    if (!batches.length || !gridData.length) return [];

    const paintedById = new Map<string, PrototypePaintedHex>();

    const opacityForDistance = (dist: number) => {
      if (dist === 0) return 1.0;
      if (dist <= 3) return 0.7;
      if (dist <= 6) return 0.5;
      return 0.3;
    };

    for (const batch of batches) {
      const centerTile = tileById[batch.centerHexId];
      if (!centerTile) continue;

      const distances = new Map<string, number>();
      const queue: Array<{ id: string; dist: number }> = [{ id: batch.centerHexId, dist: 0 }];
      distances.set(batch.centerHexId, 0);

      while (queue.length) {
        const current = queue.shift()!;
        if (current.dist >= batch.maxDistance) continue;

        for (const neighborId of getHexNeighbors(current.id)) {
          if (distances.has(neighborId)) continue;
          if (!tileById[neighborId]) continue;
          const nextDist = current.dist + 1;
          distances.set(neighborId, nextDist);
          if (nextDist < batch.maxDistance) {
            queue.push({ id: neighborId, dist: nextDist });
          }
        }
      }

      for (const [hexId, dist] of distances) {
        const tile = tileById[hexId];
        if (!tile) continue;

        const opacity = opacityForDistance(dist);
        const alpha = Math.round(255 * clamp01(opacity));

        const fillColor: [number, number, number, number] = [
          batch.color[0],
          batch.color[1],
          batch.color[2],
          alpha,
        ];

        paintedById.set(hexId, {
          id: `${batch.id}:${hexId}`,
          hexId,
          paintKey: `${batch.color[0]},${batch.color[1]},${batch.color[2]}`,
          contour: tile.contour,
          center: tile.center,
          pulseColor: batch.pulseColor,
          fillColor,
          borderColor: [0, 0, 0, 0],
          innerPolygons: [],
        });
      }
    }

    return Array.from(paintedById.values());
  }, [prototypePaintBatches, gridData.length, tileById]);

  const prototypePaintLayers = useMemo(() => {
    if (!prototypePaintedHexes.length) return [];

    const fillLayer = new PolygonLayer<PrototypePaintedHex>({
      id: "prototype-paint-fill",
      data: prototypePaintedHexes,
      pickable: false,
      filled: true,
      stroked: false,
      getPolygon: (d) => d.contour,
      getFillColor: (d) => d.fillColor,
      wrapLongitude: true,
    });

    return [fillLayer] as Layer[];
  }, [prototypePaintedHexes]);

  const prototypeHexShaderLayers = useMemo(() => {
    const demos = prototypeHexShaderDemos ?? (prototypeHexShaderDemo ? [prototypeHexShaderDemo] : []);
    if (!demos.length) return [];

    const epsilon = 1e-6;
    const close = (a: [number, number], b: [number, number]) =>
      Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
    const findSharedEdgeIndex = (a: [number, number][], b: [number, number][]) => {
      for (let i = 0; i < a.length; i++) {
        const a1 = a[i];
        const a2 = a[(i + 1) % a.length];
        for (let j = 0; j < b.length; j++) {
          const b1 = b[j];
          const b2 = b[(j + 1) % b.length];
          if ((close(a1, b1) && close(a2, b2)) || (close(a1, b2) && close(a2, b1))) {
            return i;
          }
        }
      }
      return null;
    };

    const layers: Layer[] = [];
    for (const demo of demos) {
      const tile = tileById[demo.hexId];
      if (!tile?.contour || tile.contour.length !== 6) continue;

      const baseMask: [number, number, number, number, number, number] =
        demo.edgeMask ?? [1, 1, 1, 1, 1, 1];
      const nextMask: [number, number, number, number, number, number] = [...baseMask] as any;

      const excludedNeighbors = demo.excludeSharedEdgesWithHexIds ?? [];
      for (const neighborId of excludedNeighbors) {
        const neighborTile = tileById[neighborId];
        if (!neighborTile?.contour || neighborTile.contour.length !== 6) continue;
        const edgeIndex = findSharedEdgeIndex(tile.contour, neighborTile.contour);
        if (edgeIndex === null) continue;
        nextMask[edgeIndex] = 0;
      }

      layers.push(
        new PrototypeHexStyleLayer({
          id: `prototype-hex-style:${demo.hexId}`,
          verticesLngLat: tile.contour,
          centerLngLat: tile.center,
          patternKind: demo.patternKind,
          borderColor: demo.borderColor,
          borderMaxAlpha: demo.borderMaxAlpha,
          borderFadeRatio: demo.borderFadeRatio,
          debugFillAlpha: demo.debugFillAlpha,
          edgeMask: nextMask,
          edgeMidPower: demo.edgeMidPower,
          sideEnabled: demo.sideEnabled,
          sideDirLngLat: demo.sideDirLngLat,
          sideSoftnessRatio: demo.sideSoftnessRatio,
          noiseEnabled: demo.noiseEnabled,
          noiseScale: demo.noiseScale,
          noiseAmount: demo.noiseAmount,
          noisePaletteA: demo.noisePaletteA,
          noisePaletteB: demo.noisePaletteB,
          noiseDotScale: demo.noiseDotScale,
          noiseDotSize: demo.noiseDotSize,
          noiseThreshold: demo.noiseThreshold,
          fillColorA: demo.fillColorA,
          fillColorB: demo.fillColorB,
          fillAlpha: demo.fillAlpha,
          fillGradientPower: demo.fillGradientPower,
          fillGlossDirLngLat: demo.fillGlossDirLngLat,
          fillGlossMagnitude: demo.fillGlossMagnitude,
          fillGlossPower: demo.fillGlossPower,
          cubeEnabled: demo.cubeEnabled,
          cubeLineThickness: demo.cubeLineThickness,
          cubeLineColor: demo.cubeLineColor,
          cubeShadeBoost: demo.cubeShadeBoost,
          centerFadeInner: demo.centerFadeInner,
          centerFadeOuter: demo.centerFadeOuter,
          wrapLongitude: true,
        } as any)
      );
    }

    return layers;
  }, [prototypeHexShaderDemos, prototypeHexShaderDemo, tileById]);

  type PrototypeConnectionEdge = {
    id: string;
    from: [number, number];
    to: [number, number];
  };

  const prototypeConnectionEdges = useMemo(() => {
    if (!prototypePaintedHexes.length) return [];

    const byHexId = new Map<string, PrototypePaintedHex>();
    for (const painted of prototypePaintedHexes) {
      byHexId.set(painted.hexId, painted);
    }

    const edges: PrototypeConnectionEdge[] = [];
    const seen = new Set<string>();

    for (const painted of prototypePaintedHexes) {
      for (const neighborId of getHexNeighbors(painted.hexId)) {
        const neighbor = byHexId.get(neighborId);
        if (!neighbor) continue;
        if (neighbor.paintKey === painted.paintKey) continue;

        const a = painted.hexId < neighborId ? painted : neighbor;
        const b = painted.hexId < neighborId ? neighbor : painted;
        const pairKey = `${a.hexId}|${b.hexId}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        const shared = findSharedEdgeSegment(a.contour, b.contour);
        if (!shared) continue;

        edges.push({
          id: `prototype-connection:${pairKey}`,
          from: shared[0],
          to: shared[1],
        });
      }
    }

    return edges;
  }, [prototypePaintedHexes]);


  const prototypeConnectionLayer = useMemo(() => {
    if (!prototypeConnectionEdges.length) return null;

    return new LineLayer<PrototypeConnectionEdge>({
      id: "prototype-paint-connections",
      data: prototypeConnectionEdges,
      pickable: false,
      widthUnits: "pixels",
      widthMinPixels: 6,
      getWidth: () => 6,
      getSourcePosition: (d) => d.from,
      getTargetPosition: (d) => d.to,
      getColor: () => [70, 70, 70, 255] as Color,
      wrapLongitude: true,
    });
  }, [prototypeConnectionEdges]);

  type PrototypePinDatum = {
    id: string;
    position: [number, number, number];
    sizeMeters: number;
  };

  const prototypePinLayer = useMemo(() => {
    const batches = prototypePaintBatches ?? [];
    if (!batches.length) return null;

    const referenceTile = tileById["107-92"];
    const referenceRadiusMeters = referenceTile
      ? estimateHexRadiusMeters(referenceTile)
      : null;
    const uniformSizeMeters = referenceRadiusMeters
      ? referenceRadiusMeters * 1.65
      : 260_000;

    const data: PrototypePinDatum[] = [];
    for (const batch of batches) {
      const tile = tileById[batch.centerHexId];
      if (!tile) continue;
      data.push({
        id: `prototype-pin:${batch.id}`,
        position: [tile.center[0], tile.center[1], is3DMode ? 2600 : 0],
        sizeMeters: uniformSizeMeters,
      });
    }
    if (!data.length) return null;

    const icon = {
      url: PROTOTYPE_MAP_PIN_HOUSE_URL,
      width: 64,
      height: 64,
      anchorX: 32,
      anchorY: 32,
    };

    return new IconLayer<PrototypePinDatum>({
      id: "prototype-paint-pins",
      data,
      pickable: false,
      billboard: true,
      sizeUnits: "meters",
      sizeScale: 1,
      getIcon: () => icon as any,
      getPosition: (d) => d.position,
      getSize: (d) => d.sizeMeters,
      wrapLongitude: true,
    });
  }, [prototypePaintBatches, tileById, is3DMode]);

  type PrototypeAmbientIconDatum = {
    id: string;
    iconKey: "brick-wall" | "brick-wall-fire" | "brick-wall-shield";
    position: [number, number, number];
    sizeMeters: number;
  };

  const prototypeAmbientIconLayer = useMemo(() => {
    const batches = prototypePaintBatches ?? [];
    if (!batches.length || !gridData.length) return null;

    const iconMap = {
      "brick-wall": {
        url: PROTOTYPE_BRICK_WALL_URL,
        width: 64,
        height: 64,
        anchorX: 32,
        anchorY: 32,
      },
      "brick-wall-fire": {
        url: PROTOTYPE_BRICK_WALL_FIRE_URL,
        width: 64,
        height: 64,
        anchorX: 32,
        anchorY: 32,
      },
      "brick-wall-shield": {
        url: PROTOTYPE_BRICK_WALL_SHIELD_URL,
        width: 64,
        height: 64,
        anchorX: 32,
        anchorY: 32,
      },
    } as const;

    const referenceTile = tileById["107-92"];
    const referenceRadiusMeters = referenceTile
      ? estimateHexRadiusMeters(referenceTile)
      : null;
    const uniformSizeMeters = referenceRadiusMeters
      ? referenceRadiusMeters * 1.65
      : 260_000;

    const data: PrototypeAmbientIconDatum[] = [];
    const maxIconsPerBatch = 22;

    for (const batch of batches) {
      const centerTile = tileById[batch.centerHexId];
      if (!centerTile) continue;

      const distances = new Map<string, number>();
      const queue: Array<{ id: string; dist: number }> = [{ id: batch.centerHexId, dist: 0 }];
      distances.set(batch.centerHexId, 0);

      const maxDistanceForIcons = Math.min(batch.maxDistance, 14);
      while (queue.length) {
        const current = queue.shift()!;
        if (current.dist >= maxDistanceForIcons) continue;
        for (const neighborId of getHexNeighbors(current.id)) {
          if (distances.has(neighborId)) continue;
          if (!tileById[neighborId]) continue;
          const nextDist = current.dist + 1;
          distances.set(neighborId, nextDist);
          if (nextDist < maxDistanceForIcons) queue.push({ id: neighborId, dist: nextDist });
        }
      }

      const candidates = Array.from(distances.entries())
        .filter(([, dist]) => dist >= 2 && dist <= maxDistanceForIcons)
        .map(([hexId]) => hexId)
        .sort((a, b) => hash01(`${batch.id}:${a}`) - hash01(`${batch.id}:${b}`));

      let placed = 0;
      for (const hexId of candidates) {
        if (placed >= maxIconsPerBatch) break;
        const r = hash01(`ambient:${batch.id}:${hexId}`);
        if (r > 0.16) continue;
        const tile = tileById[hexId];
        if (!tile) continue;

        const pick = hash01(`ambient-icon:${batch.id}:${hexId}`);
        const iconKey =
          pick < 0.34
            ? ("brick-wall" as const)
            : pick < 0.67
              ? ("brick-wall-fire" as const)
              : ("brick-wall-shield" as const);

        data.push({
          id: `prototype-ambient:${batch.id}:${hexId}`,
          iconKey,
          position: [tile.center[0], tile.center[1], is3DMode ? 2500 : 0],
          sizeMeters: uniformSizeMeters,
        });
        placed += 1;
      }
    }

    if (!data.length) return null;

    return new IconLayer<PrototypeAmbientIconDatum>({
      id: "prototype-ambient-icons",
      data,
      pickable: false,
      billboard: true,
      sizeUnits: "meters",
      sizeScale: 1,
      getIcon: (d) => iconMap[d.iconKey] as any,
      getPosition: (d) => d.position,
      getSize: (d) => d.sizeMeters,
      wrapLongitude: true,
    });
  }, [prototypePaintBatches, tileById, gridData.length, is3DMode]);

  // User location pin layer
  const userLocationLayer = useMemo(() => {
    const currentHexId = drawerUserCurrentHex?.trim() ?? null;
    if (!currentHexId) return null;
    const tile = tileById[currentHexId];
    if (!tile) return null;
    const [lng, lat] = tile.center;
    const pinRadiusMeters = estimateHexRadiusMeters(tile);
    const pinSizeMeters = Math.max(12_000, pinRadiusMeters * 1.6);

    return new IconLayer({
      id: "user-location-pin",
      data: [{
        position: [lng, lat],
      }],
      iconAtlas: USER_LOCATION_PIN_ATLAS_URL,
      iconMapping: USER_LOCATION_PIN_MAPPING,
      getIcon: () => "location-pin",
      getPosition: (d: any) => d.position,
      getSize: () => pinSizeMeters,
      sizeUnits: "meters",
      sizeScale: 1,
      sizeMinPixels: 18,
      sizeMaxPixels: 52,
      pickable: false,
      billboard: true,
      wrapLongitude: true,
      parameters: { depthCompare: "always" },
      transitions: {
        getPosition: {
          duration: USER_LOCATION_ANIMATION_MS,
          easing: easeInOutCubic,
        },
      },
      updateTriggers: {
        getPosition: [lng, lat],
      },
    });
  }, [drawerUserCurrentHex, tileById]);

  const layers = useMemo(() => {
    const layerList: Layer[] = [...staticLayers];
    if (hexLayer) layerList.push(hexLayer);
    if (textureLayers.length) layerList.push(...textureLayers);
    if (resourceIconLayer) layerList.push(resourceIconLayer);
    if (prototypePaintLayers.length) layerList.push(...prototypePaintLayers);
    if (prototypeConnectionLayer) layerList.push(prototypeConnectionLayer);
    if (hoverLayer) layerList.push(hoverLayer);
    if (selectionLayer) layerList.push(selectionLayer);
    if (capitalRingLayer) layerList.push(capitalRingLayer);
    if (battleLayers.length) layerList.push(...battleLayers);
    if (prototypeHexShaderLayers.length) layerList.push(...prototypeHexShaderLayers);
    if (prototypeAmbientIconLayer) layerList.push(prototypeAmbientIconLayer);
    if (prototypePinLayer) layerList.push(prototypePinLayer);
    if (resourceZoneLayers.length) layerList.push(...resourceZoneLayers);
    if (userLocationLayer) layerList.push(userLocationLayer);
    return layerList;
  }, [
    staticLayers,
    hexLayer,
    textureLayers,
    resourceIconLayer,
    prototypePaintLayers,
    prototypeConnectionLayer,
    prototypeHexShaderLayers,
    prototypeAmbientIconLayer,
    prototypePinLayer,
    hoverLayer,
    selectionLayer,
    capitalRingLayer,
    resourceZoneLayers,
    battleLayers,
    userLocationLayer,
  ]);

  const [isMounted, setIsMounted] = React.useState(false);
  const drawerOpen = Boolean(selectedId);
  const battleListCompact = drawerOpen;
  const battleListMaxWidthClass =
    drawerOpen
      ? "max-w-[max(0px,calc(100vw-min(32rem,70vw)-3.5rem))]"
      : "max-w-[calc(100vw-2rem)]";
  const battleListZClass = "z-30";
  const shouldShowBattleList = battleListVisible && hasActiveBattles;

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const mapView = useMemo(
    () => new MapView({ id: "main-view", repeat: true, controller: true }),
    []
  );

  if (!isMounted) {
    return (
      <div
        className="relative w-full h-full overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: palette.bgWater }}
      >
        <div className="px-6 py-3 rounded-full bg-background/70 backdrop-blur-md border border-border/40 shadow-xl">
          <span className="text-xs font-mono tracking-[0.22em]">
            INITIALIZING MAP…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: palette.bgWater }}
    >
      <RegionDrawer
        open={!!selectedHex}
        hex={selectedHex}
        onClose={() => setSelectedId(null)}
        actionMode={drawerActionMode}
        onFight={drawerOnFight}
        isLoading={drawerActionLoading}
        actionResult={drawerActionResult}
        onReloadData={drawerOnReloadData}
        activeBattleId={drawerActiveBattleId ?? null}
        onUpdateRegionName={drawerOnUpdateRegionName}
        userId={drawerUserId ?? null}
        userRankTier={drawerUserRankTier}
        resourceBonus={selectedResourceBonus}
        resourceStat={selectedResourceStat}
        onTravel={drawerOnTravel}
        userCurrentHex={drawerUserCurrentHex}
        userCurrentHexName={drawerUserCurrentHexName}
        userTicketCount={drawerUserTicketCount}
        userGold={drawerUserGold}
        isFirstClaim={drawerIsFirstClaim}
      />

      <MapControls
        is3DMode={is3DMode}
        enableLighting={enableLighting}
        showBackgroundMap={showBackgroundMap}
        onToggle3D={toggle3D}
        onToggleLighting={() => setEnableLighting((p) => !p)}
        onToggleBackground={() => setShowBackgroundMap((p) => !p)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        battleListVisible={battleListVisible}
        onToggleBattleList={() => setBattleListVisible((prev) => !prev)}
      />

      {shouldShowBattleList && (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-6 flex justify-end px-4 ${battleListZClass}`}
        >
          <div
            className={`pointer-events-auto inline-flex w-max ${battleListMaxWidthClass}`}
          >
            <BattleMiniList
              battles={activeBattles}
              regionOwners={regionOwners ?? {}}
              compact={battleListCompact}
            />
          </div>
        </div>
      )}

      <PerformanceOverlay />
      <NetworkDiagnostic />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="px-6 py-3 rounded-full bg-background/70 backdrop-blur-md border border-border/40 shadow-xl">
            <span className="text-xs font-mono tracking-[0.22em]">
              LOADING MAP DATA…
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10">
        <ErrorBoundary section="DeckGLMap">
          {typeof window !== 'undefined' && !loading && gridData.length > 0 && (
            <DeckGL
              viewState={viewState}
              onViewStateChange={onViewStateChange}
              views={mapView}
              layers={layers}
              effects={[lightingEffect]}
              controller={{ inertia: true, dragRotate: is3DMode }}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

type RgbColor = [number, number, number];
type RgbaColor = [number, number, number, number];

export const TILE_TEXTURE_TYPES = [
  "terrain",
  "structure",
  "resource",
  "biome",
  "effect",
] as const;

export type TileTextureType = (typeof TILE_TEXTURE_TYPES)[number];

export type TileTextureHex = {
  hexId: string;
  image?: string;
  tintColor?: RgbColor;
  transparentColor?: RgbaColor;
  wrapLongitude?: boolean;
  disableDepthTest?: boolean;
};

export type TileTextureDefinition = {
  key: string;
  label: string;
  description?: string;
  type: TileTextureType;
  image: string;
  hexes: TileTextureHex[];
  defaultTintColor?: RgbColor;
  defaultTransparentColor?: RgbaColor;
  wrapLongitude?: boolean;
  disableDepthTest?: boolean;
};

/*
 * Terrain textures are currently disabled.
 * Leave this list empty until we ship new terrain art.
 */

export const TILE_TEXTURE_DEFINITIONS: TileTextureDefinition[] = [];
